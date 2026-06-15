import { useState, useEffect, useRef } from 'react';
import './ScrollList.css';
import outputs from './amplify_outputs.json';

const NUM_ITEMS = 1000;

function ScrollList({ participantId }) {
  const [targetId, setTargetId] = useState(Math.floor(Math.random() * NUM_ITEMS));
  const [countdown, setCountdown] = useState(null);
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
  const [roundCompleted, setRoundCompleted] = useState(false);
  const timerInterval = useRef(null);
  const countdownInterval = useRef(null);
  const scrollListRef = useRef(null);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      countdownInterval.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setStartTime(Date.now());
      setStartTranslateY(translateY);
      setActiveMultiplier(parseFloat(multiplierInput) > 0 ? parseFloat(multiplierInput) : 1);
      setIsSearching(true);
      setCountdown(-1); // Set to -1 to stop countdown
    }

    return () => {
      if (countdownInterval.current) {
        clearTimeout(countdownInterval.current);
      }
    };
  }, [countdown]);

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
      setIsSearching(false);
      setRoundCompleted(true);
      setActiveMultiplier(null);
      setMultiplierInput('');
      setCountdown(null);
      // collect result data
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const scrollDistance = Math.abs(translateY - startTranslateY);
      const timestamp = new Date().toISOString();
      const multiplierUsed = activeMultiplier || (parseFloat(multiplierInput) > 0 ? parseFloat(multiplierInput) : 1);
      const targetNumber = targetId + 1;
      // try to save result remotely, fallback to localStorage
      saveResult({ participantId, timeMs: totalTime, scrollDistance, timestamp, multiplierUsed, targetNumber });
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
    setCountdown(3);
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
      const parsed = parseFloat(multiplierInput);
      factor = parsed > 0 ? parsed : 1;
    }
    setTranslateY((current) => clampTranslate(current + deltaY * factor));
  };

  const handleTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    const touchY = event.touches[0].clientY;
    setTouchStartY(touchY);
    setLastTouchY(touchY);
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
              disabled={isSearching || (countdown !== null && countdown > 0)}
            />
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const parsed = parseFloat(multiplierInput);
                  if (!isNaN(parsed) && parsed > 0 && countdown === null && !isSearching) {
                    handleStartNew();
                  }
                }}
                disabled={isSearching || (countdown !== null && countdown > 0)}
              >
                Start
              </button>
            </div>
            <small>Wird nach Ablauf des Countdowns verwendet.</small>
          </div>

          <div className="countdown-display">
            <h3>Find:</h3>
            <div className="target-number">{targetId + 1}</div>
            {countdown > 0 && (
              <div className="countdown-text">Starting in {countdown}...</div>
            )}
          </div>

          {isSearching && (
            <div className="timer">Time: {formatTime(elapsedTime || 0)}</div>
          )}

          {roundCompleted && !isSearching && countdown === null && (
            <div style={{ marginTop: 12, color: '#0a6', fontWeight: 'bold' }}>
              Ziel gefunden! Bitte gib einen neuen Multiplier ein und drücke Start für den nächsten Durchlauf.
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
