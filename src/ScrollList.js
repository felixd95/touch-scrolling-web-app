import { useState, useEffect, useRef } from 'react';
import './ScrollList.css';
import outputs from './amplify_outputs.json';

const NUM_ITEMS = 1000;

function ScrollList({ participantId }) {
  const [targetId, setTargetId] = useState(Math.floor(Math.random() * NUM_ITEMS));
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [lastTouchY, setLastTouchY] = useState(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [multiplierInput, setMultiplierInput] = useState('');
  const [residualFactorInput, setResidualFactorInput] = useState('1.0');
  const [decayInput, setDecayInput] = useState('0.95');
  const [startTranslateY, setStartTranslateY] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(null);
  const [multiplierTarget, setMultiplierTarget] = useState(null);
  const [runCount, setRunCount] = useState(0);
  const [roundCompleted, setRoundCompleted] = useState(false);

  const timerInterval = useRef(null);
  const scrollListRef = useRef(null);
  const scrollListInnerRef = useRef(null);
  const animationRef = useRef(null);
  const velocityRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const residualVelocityRef = useRef(0);
  const touchStatsRef = useRef({
    active: false,
    startTime: 0,
    startTranslateY: 0,
    pathDistancePx: 0,
    maxSpeedPxMs: 0,
  });
  const trialMetricsRef = useRef(null);

  const DRAG_GAIN = 1.0;
  const DEFAULT_DECAY = 0.95;
  const MIN_VELOCITY = 0.02;
  const ANDROID_MAX_LAUNCH_VELOCITY = 40;

  useEffect(() => {
    if (isSearching) {
      timerInterval.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 10);
    } else if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSearching, startTime]);

  const saveResult = async (result) => {
    const fallbackSave = () => {
      try {
        // store per-participant attempts mapping
        const existingMap = JSON.parse(localStorage.getItem('participantResults') || '{}');
        const pid = result.participantId || 'anonymous';
        const arr = existingMap[pid] || [];
        // maintain up to 100 entries
        if (arr.length >= 100) arr.shift();
        arr.push(result);
        existingMap[pid] = arr;
        localStorage.setItem('participantResults', JSON.stringify(existingMap));
      } catch (e) {
        console.error('Fallback save failed', e);
      }
    };

    if (!result.participantId) {
      fallbackSave();
      return;
    }

    try {
      // fetch current participant attempts
      const qresp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
        body: JSON.stringify({
          query: `query ListParticipants($filter: ModelParticipantFilterInput) { listParticipants(filter: $filter) { items { id attempts } } }`,
          variables: { filter: { id: { eq: result.participantId } } },
        }),
      });
      const qjson = await qresp.json();
      const existing = (qjson.data?.listParticipants?.items[0]?.attempts) || null;
      let arr = [];
      try { arr = existing ? JSON.parse(existing) : []; } catch (e) { arr = []; }
      if (arr.length >= 100) arr.shift();
      arr.push(result);

      // update participant attempts
      const updResp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
        body: JSON.stringify({
          query: `mutation UpdateParticipant($input: UpdateParticipantInput!) { updateParticipant(input: $input) { id attempts } }`,
          variables: { input: { id: result.participantId, attempts: JSON.stringify(arr) } },
        }),
      });
      const updJson = await updResp.json();
      if (updJson.errors) {
        console.warn('Update failed, falling back to localStorage', updJson.errors);
        fallbackSave();
      }
    } catch (err) {
      console.error('Error saving result', err);
      fallbackSave();
    }
  };

  useEffect(() => {
    const updateHeight = () => {
      if (scrollListRef.current) {
        setContainerHeight(scrollListRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const getContentHeight = () => {
    return scrollListInnerRef.current ? scrollListInnerRef.current.scrollHeight : 0;
  };

  const getItemPitchPx = () => {
    const inner = scrollListInnerRef.current;
    if (!inner || inner.children.length < 2) return null;
    const first = inner.children[0];
    const second = inner.children[1];
    const pitch = second.offsetTop - first.offsetTop;
    return pitch > 0 ? pitch : null;
  };

  const getSignedDistanceToTargetPx = (translateValue) => {
    const inner = scrollListInnerRef.current;
    if (!inner || !inner.children || !inner.children[targetId]) return null;
    const targetEl = inner.children[targetId];
    const containerCenterY = containerHeight / 2;
    const targetCenterY = targetEl.offsetTop + translateValue + targetEl.clientHeight / 2;
    return targetCenterY - containerCenterY;
  };

  const observeTargetMetrics = (translateValue) => {
    const trial = trialMetricsRef.current;
    if (!trial) return;

    const signedDistance = getSignedDistanceToTargetPx(translateValue);
    if (signedDistance == null) return;

    const currentSign = Math.sign(signedDistance);
    const initialSign = trial.initialTargetSign;
    const nowOvershot = initialSign !== 0 && currentSign !== 0 && currentSign !== initialSign;

    if (!trial.wasOvershot && nowOvershot) {
      trial.overshootCount += 1;
      trial.didOvershoot = true;
    }

    if (nowOvershot) {
      trial.maxOvershootDistancePx = Math.max(trial.maxOvershootDistancePx, Math.abs(signedDistance));
    }

    trial.wasOvershot = nowOvershot;
  };

  const beginTrialMetrics = (translateValue) => {
    const signedDistance = getSignedDistanceToTargetPx(translateValue) || 0;
    const itemPitch = getItemPitchPx();
    trialMetricsRef.current = {
      flicks: [],
      switchbackCount: 0,
      overshootCount: 0,
      maxOvershootDistancePx: 0,
      didOvershoot: false,
      wasOvershot: false,
      initialTargetSign: Math.sign(signedDistance),
      lastFlickDirection: null,
      startDistancePx: Math.abs(signedDistance),
      startDistanceItems: itemPitch ? Math.abs(signedDistance) / itemPitch : null,
    };
    observeTargetMetrics(translateValue);
  };

  const clampTranslate = (value) => {
    const contentHeight = getContentHeight();
    if (!contentHeight) return Math.min(0, value);
    const minTranslate = Math.min(0, containerHeight - contentHeight - 20);
    return Math.max(minTranslate, Math.min(0, value));
  };

  const stopMomentum = () => {
    residualVelocityRef.current = velocityRef.current;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    velocityRef.current = 0;
  };

  const applyDrag = (deltaY) => {
    setTranslateY((current) => {
      const next = clampTranslate(current + deltaY * DRAG_GAIN);
      observeTargetMetrics(next);
      return next;
    });
  };

  const startMomentum = () => {
    let velocity = velocityRef.current;
    if (Math.abs(velocity) < MIN_VELOCITY) return;

    const parsedDecay = parseFloat(decayInput);
    const decay = Number.isFinite(parsedDecay)
      ? Math.max(0.7, Math.min(0.999, parsedDecay))
      : DEFAULT_DECAY;

    const step = () => {
      velocity *= decay;

      if (Math.abs(velocity) < MIN_VELOCITY) {
        animationRef.current = null;
        return;
      }

      setTranslateY((current) => {
        const next = clampTranslate(current + velocity * 16);
        if (next === current) {
          velocity = 0;
        }
        observeTargetMetrics(next);
        return next;
      });

      velocityRef.current = velocity;
      if (Math.abs(velocity) < MIN_VELOCITY) {
        animationRef.current = null;
        return;
      }
      animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);
  };

  const handleTouchStart = (event) => {
    if (event.touches.length !== 1) return;

    stopMomentum();

    const touchY = event.touches[0].clientY;
    const now = performance.now();

    setLastTouchY(touchY);
    lastMoveTimeRef.current = now;
    velocityRef.current = 0;

    const parsed = parseFloat(multiplierInput);
    const canStartNewBlock = multiplierTarget === null;

    if (canStartNewBlock && !(parsed > 0)) {
      return;
    }

    if (!isSearching && runCount < 11) {
      const mult = canStartNewBlock ? parsed : multiplierTarget;
      if (canStartNewBlock) {
        setMultiplierTarget(mult);
      }

      setActiveMultiplier(mult);
      setStartTime(Date.now());
      setStartTranslateY(translateY);
      setIsSearching(true);
      setRoundCompleted(false);
      residualVelocityRef.current = 0;
      beginTrialMetrics(translateY);
    }

    if (isSearching || (!isSearching && runCount < 11 && !(canStartNewBlock && !(parsed > 0)))) {
      touchStatsRef.current = {
        active: true,
        startTime: now,
        startTranslateY: translateY,
        pathDistancePx: 0,
        maxSpeedPxMs: 0,
      };
    }
  };

  const handleTouchMove = (event) => {
    if (event.touches.length !== 1) return;
    if (isSearching) event.preventDefault();

    if (lastTouchY === null) return;

    const touchY = event.touches[0].clientY;
    const now = performance.now();
    const deltaY = touchY - lastTouchY;
    const dt = Math.max(now - lastMoveTimeRef.current, 1);

    applyDrag(deltaY);

    const instantVelocity = deltaY / dt;
    velocityRef.current = 0.8 * velocityRef.current + 0.2 * instantVelocity;

    if (touchStatsRef.current.active) {
      const absSpeed = Math.abs(instantVelocity);
      touchStatsRef.current.pathDistancePx += Math.abs(deltaY);
      touchStatsRef.current.maxSpeedPxMs = Math.max(touchStatsRef.current.maxSpeedPxMs, absSpeed);
    }

    setLastTouchY(touchY);
    lastMoveTimeRef.current = now;
  };

  const handleTouchEnd = () => {
    const endNow = performance.now();

    const flickMultiplier =
      activeMultiplier != null
        ? activeMultiplier
        : (parseFloat(multiplierInput) > 0 ? parseFloat(multiplierInput) : 1);

    const residualFactor = parseFloat(residualFactorInput) >= 0 ? parseFloat(residualFactorInput) : 1;

    let launchVelocity = velocityRef.current * flickMultiplier + residualVelocityRef.current * residualFactor;
    launchVelocity = Math.max(-ANDROID_MAX_LAUNCH_VELOCITY, Math.min(ANDROID_MAX_LAUNCH_VELOCITY, launchVelocity));

    if (touchStatsRef.current.active && trialMetricsRef.current) {
      const gestureDurationMs = Math.max(endNow - touchStatsRef.current.startTime, 1);
      const netDistancePx = translateY - touchStatsRef.current.startTranslateY;
      let direction = 'none';
      if (netDistancePx < 0) direction = 'up';
      if (netDistancePx > 0) direction = 'down';

      if (direction === 'none') {
        if (launchVelocity < 0) direction = 'up';
        if (launchVelocity > 0) direction = 'down';
      }

      const averageSpeedPxMs = touchStatsRef.current.pathDistancePx / gestureDurationMs;
      const flickMetric = {
        direction,
        distancePx: touchStatsRef.current.pathDistancePx,
        durationMs: gestureDurationMs,
        avgSpeedPxMs: averageSpeedPxMs,
        maxSpeedPxMs: touchStatsRef.current.maxSpeedPxMs,
      };

      const pitch = getItemPitchPx();
      if (pitch) {
        flickMetric.distanceItems = touchStatsRef.current.pathDistancePx / pitch;
      }

      const trial = trialMetricsRef.current;
      if (direction !== 'none' && trial.lastFlickDirection && trial.lastFlickDirection !== direction) {
        trial.switchbackCount += 1;
      }
      if (direction !== 'none') {
        trial.lastFlickDirection = direction;
      }
      trial.flicks.push(flickMetric);
    }

    velocityRef.current = launchVelocity;
    residualVelocityRef.current = launchVelocity;
    startMomentum();

    touchStatsRef.current.active = false;
    setLastTouchY(null);
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${totalSeconds}.${String(milliseconds).padStart(3, '0')}s`;
  };

  const handleButtonClick = (id) => {
    if (id === targetId && isSearching) {
      stopMomentum();

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const scrollDistance = Math.abs(translateY - startTranslateY);
      const timestamp = new Date().toISOString();
      const multiplierUsed =
        activeMultiplier || (parseFloat(multiplierInput) > 0 ? parseFloat(multiplierInput) : 1);
      const targetNumber = targetId + 1;
      const trial = trialMetricsRef.current;

      saveResult({
        participantId,
        timeMs: totalTime,
        scrollDistance,
        timestamp,
        multiplierUsed,
        targetNumber,
        clutchCount: trial?.flicks?.length || 0,
        flickCount: trial?.flicks?.length || 0,
        flicks: trial?.flicks || [],
        overshoot: {
          didOvershoot: trial?.didOvershoot || false,
          count: trial?.overshootCount || 0,
          maxDistancePx: trial?.maxOvershootDistancePx || 0,
        },
        switchbackCount: trial?.switchbackCount || 0,
        startDistancePx: trial?.startDistancePx || 0,
        startDistanceItems: trial?.startDistanceItems ?? null,
      });

      const nextRunCount = runCount + 1;
      const runBlockFinished = nextRunCount >= 11;

      setIsSearching(false);
      setRoundCompleted(true);
      setActiveMultiplier(null);
      setRunCount(nextRunCount);
      setTargetId(Math.floor(Math.random() * NUM_ITEMS));
      setTranslateY(0);
      setStartTime(null);
      setElapsedTime(null);
      residualVelocityRef.current = 0;
      trialMetricsRef.current = null;
      touchStatsRef.current.active = false;

      if (runBlockFinished) {
        setMultiplierTarget(null);
        setMultiplierInput('');
        setRunCount(0);
      }
    }
  };

  return (
    <div className="scroll-list-wrapper">
      <div className="timer-panel">
        <div className="timer-content">
          <div className="multiplier-input">
            <h4 style={{ margin: 0, textAlign: 'left', fontSize: 16 }}>Parameterwahl</h4>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label htmlFor="multiplier">Flick multiplier</label>
                <input
                  id="multiplier"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={multiplierInput}
                  onChange={(event) => setMultiplierInput(event.target.value)}
                  disabled={isSearching || (multiplierTarget !== null && runCount < 11)}
                />
              </div>

              <div>
                <label htmlFor="residualFactor">Flick addition factor</label>
                <input
                  id="residualFactor"
                  type="number"
                  min="0"
                  step="0.1"
                  value={residualFactorInput}
                  onChange={(event) => setResidualFactorInput(event.target.value)}
                  disabled={isSearching || (multiplierTarget !== null && runCount < 11)}
                />
              </div>

              <div>
                <label htmlFor="decay">Flick stop speed (decay)</label>
                <input
                  id="decay"
                  type="number"
                  min="0.7"
                  max="0.999"
                  step="0.001"
                  value={decayInput}
                  onChange={(event) => setDecayInput(event.target.value)}
                  disabled={isSearching || (multiplierTarget !== null && runCount < 11)}
                />
              </div>
            </div>
          </div>

          <div className="countdown-display">
            <h3>Find:</h3>
            <div className="target-number">{targetId + 1}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
              {isSearching
                ? `Durchlauf ${runCount + 1} von 11 laeuft.`
                : runCount > 0
                  ? `${runCount} von 11 Durchlaeufen abgeschlossen.`
                  : 'Bereit fuer den ersten Durchlauf.'}
            </div>
          </div>

          {isSearching && (
            <div className="timer">Time: {formatTime(elapsedTime || 0)}</div>
          )}

          {roundCompleted && !isSearching && (
            <div style={{ marginTop: 12, color: '#0a6', fontWeight: 'bold' }}>
              {multiplierTarget === null
                ? '11 Durchlaeufe abgeschlossen. Bitte neuen Flick-Multiplier eingeben.'
                : 'Ziel gefunden! Scrollen startet den naechsten Durchlauf.'}
            </div>
          )}
        </div>
      </div>

      <div className="scroll-list-container">
        <div
          className="scroll-list"
          ref={scrollListRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div ref={scrollListInnerRef} className="scroll-list-inner" style={{ transform: `translateY(${translateY}px)` }}>
            {Array.from({ length: NUM_ITEMS }, (_, i) => (
              <button
                key={i}
                className={`list-item ${i === targetId ? 'target' : ''} ${
                  i === targetId && !isSearching ? 'found' : ''
                }`}
                onClick={() => handleButtonClick(i)}
                disabled={!isSearching}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScrollList;
