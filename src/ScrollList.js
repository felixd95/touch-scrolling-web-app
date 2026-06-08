import { useState, useEffect, useRef } from 'react';
import './ScrollList.css';
import outputs from './amplify_outputs.json';

function ScrollList({ participantId }) {
  const [targetId, setTargetId] = useState(Math.floor(Math.random() * 2000));
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
      // collect result data
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const scrollDistance = Math.abs(translateY - startTranslateY);
      const timestamp = new Date().toISOString();
      const multiplierUsed = activeMultiplier || (parseFloat(multiplierInput) > 0 ? parseFloat(multiplierInput) : 1);
      // try to save result remotely, fallback to localStorage
      saveResult({ participantId, timeMs: totalTime, scrollDistance, timestamp, multiplierUsed });
    }
  };

  const saveResult = async (result) => {
    const fallbackSave = () => {
      try {
        const existing = JSON.parse(localStorage.getItem('results') || '[]');
        existing.push(result);
        localStorage.setItem('results', JSON.stringify(existing));
      } catch (e) {
        console.error('Fallback save failed', e);
      }
    };

    if (!result.participantId) {
      // no participant id available; save locally
      fallbackSave();
      return;
    }

    try {
      const resp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': outputs.data.api_key,
        },
        body: JSON.stringify({
            query: `mutation CreateResult($input: CreateResultInput!) { createResult(input: $input) { id participantId timeMs scrollDistance timestamp multiplierUsed } }`,
            variables: { input: result },
          }),
      });

      const json = await resp.json();
      if (json.errors) {
        console.warn('Server save failed, falling back to localStorage', json.errors);
        fallbackSave();
      }
    } catch (err) {
      console.error('Error saving result', err);
      fallbackSave();
    }
  };

  const handleStartNew = () => {
    setTargetId(Math.floor(Math.random() * 2000));
    setCountdown(3);
    setStartTime(null);
    setElapsedTime(null);
    setIsSearching(false);
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
    const contentHeight = 1000 * itemHeight;
    const minTranslate = Math.min(0, containerHeight - contentHeight - 20);
    return Math.max(minTranslate, Math.min(0, value));
  };

  const transfer = (deltaY) => {
    const parsed = parseFloat(multiplierInput);
    const factor = parsed > 0 ? parsed : 1;
    setTranslateY((current) => clampTranslate(current + deltaY * factor));
  };

  const handleTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    const touchY = event.touches[0].clientY;
    setTouchStartY(touchY);
    setLastTouchY(touchY);
  };

  const handleTouchMove = (event) => {
    if (!isSearching || event.touches.length !== 1) return;
    event.preventDefault();
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
                    setCountdown(3);
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
            {Array.from({ length: 1000 }, (_, i) => (
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
