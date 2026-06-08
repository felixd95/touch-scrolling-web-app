import { useState, useEffect, useRef } from 'react';
import './ScrollList.css';

function ScrollList() {
  const [targetId, setTargetId] = useState(Math.floor(Math.random() * 2000));
  const [countdown, setCountdown] = useState(3);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const timerInterval = useRef(null);
  const countdownInterval = useRef(null);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      countdownInterval.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setStartTime(Date.now());
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
    }
  };

  const handleStartNew = () => {
    setTargetId(Math.floor(Math.random() * 2000));
    setCountdown(3);
    setStartTime(null);
    setElapsedTime(null);
    setIsSearching(false);
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
        <div className="scroll-list">
          {Array.from({ length: 2000 }, (_, i) => (
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
  );
}

export default ScrollList;
