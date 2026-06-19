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
  const [savedRuns, setSavedRuns] = useState(0);
  const [practiceRunDone, setPracticeRunDone] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [roundCompleted, setRoundCompleted] = useState(false);
  const timerInterval = useRef(null);
  const scrollListRef = useRef(null);

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
      const practice = !practiceRunDone;
      const finalSavedRun = practiceRunDone && savedRuns >= 9;

      if (!practice) {
        saveResult({ participantId, timeMs: totalTime, scrollDistance, timestamp, multiplierUsed, targetNumber });
        setSavedRuns((prev) => prev + 1);
      } else {
        setPracticeRunDone(true);
      }

      setIsSearching(false);
      setRoundCompleted(true);
      setActiveMultiplier(null);

      if (finalSavedRun) {
        setMultiplierTarget(null);
        setMultiplierInput('');
        setPracticeRunDone(false);
        setSavedRuns(0);
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

  const handleStartNew = () => {
    setTargetId(Math.floor(Math.random() * NUM_ITEMS));
    setStartTime(null);
    setElapsedTime(null);
    setIsSearching(false);
    setRoundCompleted(false);
    setTranslateY(0);
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

  const clampTranslate = (value) => {
    const itemHeight = 44; // approximate button height plus gap
    const contentHeight = NUM_ITEMS * itemHeight;
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
    const mult = parsed > 0 ? parsed : 1;
    const isNewMultiplier = multiplierTarget === null || mult !== multiplierTarget;
    const multiplierDone = practiceRunDone && savedRuns >= 10;

    if (!isSearching && (!multiplierDone || isNewMultiplier)) {
      if (isNewMultiplier) {
        setMultiplierTarget(mult);
        setSavedRuns(0);
        setPracticeRunDone(false);
        setRunCount(1);
      } else {
        setRunCount((prev) => prev + 1);
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
              disabled={isSearching}
            />
            {/* Start on scroll - no explicit Start button required */}
            <small>Der Durchlauf startet, sobald du mit dem Scrollen beginnst.</small>
          </div>

          <div className="countdown-display">
            <h3>Find:</h3>
            <div className="target-number">{targetId + 1}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
              {runCount > 0 ? `Durchlauf ${runCount} von 11` : 'Bereit für den ersten Durchlauf.'}
            </div>
          </div>

          {isSearching && (
            <div className="timer">Time: {formatTime(elapsedTime || 0)}</div>
          )}

          {roundCompleted && !isSearching && (
            <div style={{ marginTop: 12, color: '#0a6', fontWeight: 'bold' }}>
              Ziel gefunden! Bitte gib einen neuen Multiplier ein. Scrollen startet den nächsten Durchlauf.
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
          <div className="scroll-list-inner" style={{ transform: `translateY(${translateY}px)` }}>
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
