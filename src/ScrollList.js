import { useState, useEffect, useRef } from 'react';
import './ScrollList.css';
import outputs from './amplify_outputs.json';

const NUM_ITEMS = 1000;

function ScrollList({ participantId }) {
  const [targetId, setTargetId] = useState(Math.floor(Math.random() * NUM_ITEMS));
  // countdown removed; start happens on first scroll
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [touchStartY, setTouchStartY] = useState(null);
  const [lastTouchY, setLastTouchY] = useState(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [multiplierInput, setMultiplierInput] = useState('');
  const [startTranslateY, setStartTranslateY] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(null);
  const [multiplierTarget, setMultiplierTarget] = useState(null);
  const [runCount, setRunCount] = useState(0);
  const [roundCompleted, setRoundCompleted] = useState(false);
  const timerInterval = useRef(null);
  const scrollListRef = useRef(null);
  const scrollListInnerRef = useRef(null);

  // (removed countdown-based start - starting now happens on first touch)

  // Search timer
  useEffect(() => {
    if (isSearching) {
      timerInterval.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 10);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [isSearching, startTime]);

  const handleButtonClick = (id) => {
    if (id === targetId && isSearching) {
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const scrollDistance = Math.abs(translateY - startTranslateY);
      const timestamp = new Date().toISOString();
      const multiplierUsed = activeMultiplier || (parseFloat(multiplierInput) > 0 ? parseFloat(multiplierInput) : 1);
      const targetNumber = targetId + 1;

      saveResult({ participantId, timeMs: totalTime, scrollDistance, timestamp, multiplierUsed, targetNumber });

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

      if (runBlockFinished) {
        setMultiplierTarget(null);
        setMultiplierInput('');
        setRunCount(0);
      }
    }
  };

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
    if (scrollListInnerRef.current) {
      return scrollListInnerRef.current.scrollHeight;
    }

    return 0;
  };

  const clampTranslate = (value) => {
    const contentHeight = getContentHeight();
    if (!contentHeight) {
      return Math.min(0, value);
    }

    const minTranslate = Math.min(0, containerHeight - contentHeight - 20);
    return Math.max(minTranslate, Math.min(0, value));
  };

  const transfer = (deltaY) => {
    let factor = 1;
    if (isSearching) {
      const parsed = activeMultiplier != null ? activeMultiplier : parseFloat(multiplierInput);
      factor = parsed > 0 ? parsed : 1;
    }
    setTranslateY((current) => clampTranslate(current + deltaY * factor));
  };

  const handleTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    const touchY = event.touches[0].clientY;
    setTouchStartY(touchY);
    setLastTouchY(touchY);

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
    }
  };

  const handleTouchMove = (event) => {
    if (event.touches.length !== 1) return;
    if (isSearching) {
      event.preventDefault();
    }
    const touchY = event.touches[0].clientY;
    const deltaY = touchY - lastTouchY;
    setLastTouchY(touchY);
    transfer(deltaY);
  };

  const handleTouchEnd = () => {
    setTouchStartY(null);
    setLastTouchY(null);
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${totalSeconds}.${String(milliseconds).padStart(3, '0')}s`;
  };

  return (
    <div className="scroll-list-wrapper">
      <div className="timer-panel">
        <div className="timer-content">
          <div className="multiplier-input">
            <label htmlFor="multiplier">Transfer multiplier</label>
            <input
              id="multiplier"
              type="number"
              min="0.1"
              step="0.1"
              value={multiplierInput}
              onChange={(event) => {
                const v = event.target.value;
                setMultiplierInput(v);
              }}
              disabled={isSearching || (multiplierTarget !== null && runCount < 11)}
            />
            {/* Start on scroll - no explicit Start button required */}
            <small>Multiplier einmal eingeben, dann 11 Durchlaeufe nacheinander durch Scrollen starten.</small>
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
                ? '11 Durchlaeufe abgeschlossen. Bitte neuen Multiplier eingeben, dann scrollen.'
                : 'Ziel gefunden! Liste wurde zurueckgesetzt und neue Zahl gesetzt. Scrollen startet den naechsten Durchlauf.'}
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
