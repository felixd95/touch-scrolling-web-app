import { useState, useEffect, useRef } from 'react';
import './ScrollList.css';
import outputs from './amplify_outputs.json';

const NUM_ITEMS = 1000;
const RUNS_PER_BLOCK = 10;

const DEFAULT_PARAMETER_SET = {
  a: '0.1',
  b: '0.5',
  k: '1.0',
  alpha: '1.0',
  beta: '0.5',
  decay: '0.95',
  flickVelocityThreshold: '0.2',
  flickDistanceThreshold: '12',
};

function ScrollList({ participantId }) {
  const [targetId, setTargetId] = useState(Math.floor(Math.random() * NUM_ITEMS));
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [lastTouchY, setLastTouchY] = useState(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [aInput, setAInput] = useState('0.1');
  const [bInput, setBInput] = useState('0.5');
  const [kInput, setKInput] = useState('1.0');
  const [alphaInput, setAlphaInput] = useState('1.0');
  const [betaInput, setBetaInput] = useState('0.5');
  const [decayInput, setDecayInput] = useState('0.95');
  const [flickVelocityThresholdInput, setFlickVelocityThresholdInput] = useState('0.2');
  const [flickDistanceThresholdInput, setFlickDistanceThresholdInput] = useState('12');
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

  const toInputString = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : fallback;
  };

  const applyNextParameterSet = (rawParameterSet) => {
    if (!rawParameterSet || typeof rawParameterSet !== 'object') return false;

    const parameterSet = rawParameterSet.parameters && typeof rawParameterSet.parameters === 'object'
      ? rawParameterSet.parameters
      : rawParameterSet;

    setAInput(toInputString(parameterSet.a, DEFAULT_PARAMETER_SET.a));
    setBInput(toInputString(parameterSet.b, DEFAULT_PARAMETER_SET.b));
    setKInput(toInputString(parameterSet.k, DEFAULT_PARAMETER_SET.k));
    setAlphaInput(toInputString(parameterSet.alpha, DEFAULT_PARAMETER_SET.alpha));
    setBetaInput(toInputString(parameterSet.beta, DEFAULT_PARAMETER_SET.beta));
    setDecayInput(toInputString(parameterSet.decay, DEFAULT_PARAMETER_SET.decay));
    setFlickVelocityThresholdInput(
      toInputString(parameterSet.flickVelocityThreshold, DEFAULT_PARAMETER_SET.flickVelocityThreshold)
    );
    setFlickDistanceThresholdInput(
      toInputString(parameterSet.flickDistanceThreshold, DEFAULT_PARAMETER_SET.flickDistanceThreshold)
    );
    return true;
  };

  useEffect(() => {
    const loadNextParameterSet = async () => {
      if (!participantId) return;

      try {
        const resp = await fetch(outputs.data.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
          body: JSON.stringify({
            query: `query ListParticipants($filter: ModelParticipantFilterInput) { listParticipants(filter: $filter) { items { id nextParameterSet } } }`,
            variables: { filter: { id: { eq: participantId } } },
          }),
        });
        const json = await resp.json();
        const nextParameterSet = json.data?.listParticipants?.items?.[0]?.nextParameterSet;
        applyNextParameterSet(nextParameterSet);
      } catch (error) {
        console.error('Error loading next parameter set', error);
      }
    };

    if (!isSearching && multiplierTarget === null) {
      loadNextParameterSet();
    }
  }, [participantId, isSearching, multiplierTarget]);

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

  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  const getTargetPositionRatio = () => {
    if (NUM_ITEMS <= 1) return 0;
    return clamp01(targetId / (NUM_ITEMS - 1));
  };

  const getCurrentPositionRatio = () => {
    const inner = scrollListInnerRef.current;
    if (!inner || inner.children.length < 2 || containerHeight <= 0 || NUM_ITEMS <= 1) return 0;

    const first = inner.children[0];
    const second = inner.children[1];
    const pitch = second.offsetTop - first.offsetTop;
    if (!(pitch > 0)) return 0;

    const firstCenterInner = first.offsetTop + first.clientHeight / 2;
    const centerInInnerSpace = containerHeight / 2 - translateY;
    const centeredIndex = (centerInInnerSpace - firstCenterInner) / pitch;

    return clamp01(centeredIndex / (NUM_ITEMS - 1));
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

    const parsedA = parseFloat(aInput);
    const canStartNewBlock = multiplierTarget === null;

    if (canStartNewBlock && !(parsedA >= 0)) {
      return;
    }

    if (!isSearching && runCount < RUNS_PER_BLOCK) {
      const mult = canStartNewBlock ? parsedA : multiplierTarget;
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

    if (isSearching || (!isSearching && runCount < RUNS_PER_BLOCK && !(canStartNewBlock && !(parsedA >= 0)))) {
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

    const a = activeMultiplier != null ? activeMultiplier : (parseFloat(aInput) >= 0 ? parseFloat(aInput) : 0.1);
    const b = parseFloat(bInput) >= 0 ? parseFloat(bInput) : 0.5;
    const k = parseFloat(kInput) >= 0 ? parseFloat(kInput) : 1.0;
    const alpha = parseFloat(alphaInput) >= 0 ? parseFloat(alphaInput) : 1.0;
    const beta = parseFloat(betaInput) >= 0 ? parseFloat(betaInput) : 0.5;
    const flickVelocityThreshold =
      parseFloat(flickVelocityThresholdInput) >= 0 ? parseFloat(flickVelocityThresholdInput) : 0.2;
    const flickDistanceThreshold =
      parseFloat(flickDistanceThresholdInput) >= 0 ? parseFloat(flickDistanceThresholdInput) : 12;

    const gestureDistancePx = touchStatsRef.current.active ? touchStatsRef.current.pathDistancePx : 0;
    const hasFlickVelocity = Math.abs(velocityRef.current) >= flickVelocityThreshold;
    const hasFlickDistance = gestureDistancePx >= flickDistanceThreshold;
    const isFlick = hasFlickVelocity && hasFlickDistance;

    let launchVelocity = 0;
    if (isFlick) {
      launchVelocity = velocityRef.current * (a + b * alpha) + residualVelocityRef.current * beta;
      launchVelocity = Math.max(-ANDROID_MAX_LAUNCH_VELOCITY, Math.min(ANDROID_MAX_LAUNCH_VELOCITY, launchVelocity));
    }

    if (touchStatsRef.current.active && trialMetricsRef.current && isFlick) {
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
    if (isFlick) {
      startMomentum();
    }

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
      const multiplierUsed = activeMultiplier || (parseFloat(aInput) >= 0 ? parseFloat(aInput) : 0.1);
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
        flickThresholds: {
          velocityPxMs:
            parseFloat(flickVelocityThresholdInput) >= 0 ? parseFloat(flickVelocityThresholdInput) : 0.2,
          distancePx: parseFloat(flickDistanceThresholdInput) >= 0 ? parseFloat(flickDistanceThresholdInput) : 12,
        },
        decayFactor: parseFloat(decayInput) >= 0.7 ? parseFloat(decayInput) : DEFAULT_DECAY,
        paperParams: {
          a: parseFloat(aInput) >= 0 ? parseFloat(aInput) : 0.1,
          b: parseFloat(bInput) >= 0 ? parseFloat(bInput) : 0.5,
          k: parseFloat(kInput) >= 0 ? parseFloat(kInput) : 1.0,
          alpha: parseFloat(alphaInput) >= 0 ? parseFloat(alphaInput) : 1.0,
          beta: parseFloat(betaInput) >= 0 ? parseFloat(betaInput) : 0.5,
        },
      });

      const nextRunCount = runCount + 1;
  const runBlockFinished = nextRunCount >= RUNS_PER_BLOCK;

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
        setRunCount(0);
      }
    }
  };

  const targetPositionRatio = getTargetPositionRatio();
  const currentPositionRatio = getCurrentPositionRatio();

  return (
    <div className="scroll-list-wrapper">
      <div className="timer-panel">
        <div className="timer-content">
          <div className="countdown-display">
            <h3>Find:</h3>
            <div className="target-number">{targetId + 1}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
              {isSearching
                ? `Durchlauf ${runCount + 1} von ${RUNS_PER_BLOCK} laeuft.`
                : runCount > 0
                  ? `${runCount} von ${RUNS_PER_BLOCK} Durchlaeufen abgeschlossen.`
                  : 'Bereit fuer den ersten Durchlauf.'}
            </div>
          </div>

          {isSearching && (
            <div className="timer">Time: {formatTime(elapsedTime || 0)}</div>
          )}

          {roundCompleted && !isSearching && (
            <div style={{ marginTop: 12, color: '#0a6', fontWeight: 'bold' }}>
              {multiplierTarget === null
                ? `${RUNS_PER_BLOCK} Durchlaeufe abgeschlossen. Naechster Parametersatz kann geladen werden.`
                : 'Ziel gefunden! Scrollen startet den naechsten Durchlauf.'}
            </div>
          )}
        </div>
      </div>

      <div className="distance-feedback" aria-hidden="true">
        <div className="distance-track">
          <div
            className="distance-marker distance-marker-target"
            style={{ top: `${targetPositionRatio * 100}%` }}
            title="Target"
          />
          <div
            className="distance-marker distance-marker-current"
            style={{ top: `${currentPositionRatio * 100}%` }}
            title="Current Position"
          />
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
                onTouchEnd={(event) => {
                  if (i === targetId) {
                    event.stopPropagation();
                    handleButtonClick(i);
                  }
                }}
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
