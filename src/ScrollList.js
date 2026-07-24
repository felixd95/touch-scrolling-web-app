import { useState, useEffect, useRef } from 'react';
import './ScrollList.css';
import outputs from './amplify_outputs.json';
import {
  getMinFlingVelocityPxMs,
  getMaxFlingVelocityPxMs,
  isFlingThresholdMet,
  clampFlingVelocityPxMs,
} from './scrollPhysics/flingThreshold';
import {
  ANDROID_SPLINE_SAMPLES,
  ANDROID_SPLINE_TABLE,
  getAndroidPhysicalCoeff,
  getAndroidSplineFlingDistancePx,
  getAndroidSplineFlingDurationMs,
  getScrollBounds as getOverScrollerBounds,
  clampTranslate as clampTranslateFromBounds,
  applyOverscrollResistance as applyOverscrollResistanceToBounds,
  getAndroidOverscrollDistancePx,
  getAndroidOverflingDistancePx,
  getSpringbackDurationMs,
  getBallisticProfile,
} from './scrollPhysics/overScrollerPhysics';

const NUM_ITEMS = 330;
const RUNS_PER_BLOCK = 10;
const ANDROID_SAMPLE_WINDOW_MS = 100;
const ANDROID_MAX_SAMPLES = 20;
const FIXED_TARGET_NUMBERS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];

const createShuffledTargetNumbers = () => {
  const shuffled = [...FIXED_TARGET_NUMBERS];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

const DEFAULT_PARAMETER_SET = {
  x1: '1',
  x2: '1',
  decay: '0.98',
  flickDistanceThreshold: '6',
};

function ScrollList({ participantId, scrollHandPreference = 'right' }) {
  const [targetSequence, setTargetSequence] = useState(() => createShuffledTargetNumbers());
  const [targetIndex, setTargetIndex] = useState(0);
  const [practiceRunCompleted, setPracticeRunCompleted] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [lastTouchY, setLastTouchY] = useState(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [x1Input, setX1Input] = useState('1');
  const [x2Input, setX2Input] = useState('1');
  const [decayInput, setDecayInput] = useState('0.98');
  const [flickDistanceThresholdInput, setFlickDistanceThresholdInput] = useState('6');
  const [startTranslateY, setStartTranslateY] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(null);
  const [multiplierTarget, setMultiplierTarget] = useState(null);
  const [runCount, setRunCount] = useState(0);
  const [roundCompleted, setRoundCompleted] = useState(false);
  const [awaitingNextParameterSet, setAwaitingNextParameterSet] = useState(false);
  const [awaitingBlockStartConfirmation, setAwaitingBlockStartConfirmation] = useState(false);
  const [parameterSyncError, setParameterSyncError] = useState('');
  const [liveInstantVelocityPxMs, setLiveInstantVelocityPxMs] = useState(0);
  const [liveRegressionVelocityPxMs, setLiveRegressionVelocityPxMs] = useState(0);

  const targetNumber = practiceRunCompleted
    ? (targetSequence[targetIndex] ?? targetSequence[0] ?? FIXED_TARGET_NUMBERS[0])
    : 180;
  const targetId = targetNumber - 1;

  const scrollListRef = useRef(null);
  const scrollListInnerRef = useRef(null);
  const animationRef = useRef(null);
  const translateYRef = useRef(0);
  const velocityRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const residualVelocityRef = useRef(0);
  const touchSamplesRef = useRef([]);
  const touchStatsRef = useRef({
    active: false,
    startTime: 0,
    startTranslateY: 0,
    pathDistancePx: 0,
    maxSpeedPxMs: 0,
  });
  const trialMetricsRef = useRef(null);

  const DEFAULT_DECAY = 0.98;
  const MAX_EFFECTIVE_DECAY = 0.98;

  const toInputString = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : fallback;
  };

  const normalizeParameterSet = (rawParameterSet) => {
    if (!rawParameterSet) return null;

    if (typeof rawParameterSet === 'string') {
      try {
        return JSON.parse(rawParameterSet);
      } catch (error) {
        return null;
      }
    }

    return typeof rawParameterSet === 'object' ? rawParameterSet : null;
  };

  const applyNextParameterSet = (rawParameterSet) => {
    const normalizedParameterSet = normalizeParameterSet(rawParameterSet);
    if (!normalizedParameterSet) return false;

    const parameterSet = normalizedParameterSet.parameters && typeof normalizedParameterSet.parameters === 'object'
      ? normalizedParameterSet.parameters
      : normalizedParameterSet;
    const rawX1 = parameterSet.x1 ?? parameterSet.a;
    const rawX2 = parameterSet.x2 ?? parameterSet.b;

    setX1Input(toInputString(rawX1, DEFAULT_PARAMETER_SET.x1));
    setX2Input(toInputString(rawX2, DEFAULT_PARAMETER_SET.x2));
    setDecayInput(toInputString(parameterSet.decay, DEFAULT_PARAMETER_SET.decay));
    setFlickDistanceThresholdInput(
      toInputString(parameterSet.flickDistanceThreshold, DEFAULT_PARAMETER_SET.flickDistanceThreshold)
    );
    return true;
  };

  const loadParticipantState = async () => {
    if (!participantId) return null;

    const resp = await fetch(outputs.data.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
      body: JSON.stringify({
        query: `query ListParticipants($filter: ModelParticipantFilterInput) { listParticipants(filter: $filter) { items { id attempts nextParameterSet } } }`,
        variables: { filter: { id: { eq: participantId } } },
      }),
    });

    const json = await resp.json();
    return json.data?.listParticipants?.items?.[0] || null;
  };

  const getAttemptCount = (attemptsRaw) => {
    if (Array.isArray(attemptsRaw)) return attemptsRaw.length;

    if (typeof attemptsRaw === 'string') {
      try {
        const parsed = JSON.parse(attemptsRaw);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch (error) {
        return 0;
      }
    }

    return 0;
  };

  const triggerNextParameterSetUpdate = async (attemptCount) => {
    const resp = await fetch(outputs.data.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
      body: JSON.stringify({
        query: `mutation TriggerNextParameterSet($participantId: ID!, $attemptCount: Int!) { triggerNextParameterSet(participantId: $participantId, attemptCount: $attemptCount) { nextParameterSet } }`,
        variables: { participantId, attemptCount },
      }),
    });

    const json = await resp.json();
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message || 'Failed to trigger next parameter set');
    }

    return normalizeParameterSet(json.data?.triggerNextParameterSet?.nextParameterSet);
  };

  useEffect(() => {
    const loadNextParameterSet = async () => {
      if (!participantId) return;

      try {
        const participant = await loadParticipantState();
        const nextParameterSet = participant?.nextParameterSet;
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
    translateYRef.current = translateY;
  }, [translateY]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

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
      return { attemptsCount: 0, savedRemotely: false };
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
        return { attemptsCount: arr.length, savedRemotely: false };
      }

      return { attemptsCount: arr.length, savedRemotely: true };
    } catch (err) {
      console.error('Error saving result', err);
      fallbackSave();
      return { attemptsCount: 0, savedRemotely: false };
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

  const pushTouchSample = (timeMs, yPx) => {
    const samples = touchSamplesRef.current;
    samples.push({ timeMs, yPx });

    const minTime = timeMs - ANDROID_SAMPLE_WINDOW_MS;
    while (samples.length > 0 && samples[0].timeMs < minTime) {
      samples.shift();
    }
    while (samples.length > ANDROID_MAX_SAMPLES) {
      samples.shift();
    }
  };

  const getRegressionVelocityPxMs = () => {
    const samples = touchSamplesRef.current;
    if (!samples || samples.length < 2) return 0;

    const n = samples.length;
    let sumT = 0;
    let sumY = 0;
    for (const sample of samples) {
      sumT += sample.timeMs;
      sumY += sample.yPx;
    }

    const meanT = sumT / n;
    const meanY = sumY / n;

    let numerator = 0;
    let denominator = 0;
    for (const sample of samples) {
      const dt = sample.timeMs - meanT;
      numerator += dt * (sample.yPx - meanY);
      denominator += dt * dt;
    }

    if (denominator <= 0) return 0;
    return numerator / denominator;
  };

  const formatVelocity = (value) => {
    return Number.isFinite(value) ? value.toFixed(4) : '0.0000';
  };

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

  const getScrollBounds = () => {
    const contentHeight = getContentHeight();
    return getOverScrollerBounds(contentHeight, containerHeight);
  };

  const clampTranslate = (value) => {
    const bounds = getScrollBounds();
    return clampTranslateFromBounds(value, bounds);
  };

  const applyOverscrollResistance = (value) => {
    const bounds = getScrollBounds();
    const overscrollDistancePx = getAndroidOverscrollDistancePx(
      typeof window !== 'undefined' ? window.devicePixelRatio : 1
    );
    return applyOverscrollResistanceToBounds(value, bounds, overscrollDistancePx);
  };

  const startSpringback = (startValue, targetValue, initialVelocityPxMs = 0) => {
    const delta = targetValue - startValue;
    if (Math.abs(delta) < 0.5) {
      const clamped = clampTranslate(startValue);
      setTranslateY(clamped);
      translateYRef.current = clamped;
      velocityRef.current = 0;
      return;
    }

    const durationMs = getSpringbackDurationMs(delta, initialVelocityPxMs);
    const startedAt = performance.now();

    const step = (now) => {
      const t = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
      const ease = 3 * t * t - 2 * t * t * t;
      const next = startValue + delta * ease;

      setTranslateY(next);
      translateYRef.current = next;
      observeTargetMetrics(next);

      const deriv = (6 * t - 6 * t * t) / durationMs;
      velocityRef.current = delta * deriv;

      if (t >= 1) {
        animationRef.current = null;
        velocityRef.current = 0;
        const clamped = clampTranslate(targetValue);
        setTranslateY(clamped);
        translateYRef.current = clamped;
        observeTargetMetrics(clamped);
        return;
      }

      animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);
  };

  const startBallisticPhase = (startValue, initialVelocityPxMs, edgeValue, overflingDistancePx = 0) => {
    if (!Number.isFinite(initialVelocityPxMs) || Math.abs(initialVelocityPxMs) < 1e-4) {
      startSpringback(startValue, edgeValue);
      return;
    }

    if (!(overflingDistancePx > 0)) {
      startSpringback(startValue, edgeValue, initialVelocityPxMs);
      return;
    }

    const direction = Math.sign(initialVelocityPxMs);
    const { decelMagnitude, durationMs } = getBallisticProfile(initialVelocityPxMs, overflingDistancePx);

    const decel = -direction * decelMagnitude;
    const startedAt = performance.now();

    const step = (now) => {
      const elapsedMs = now - startedAt;
      const clampedElapsed = Math.min(durationMs, elapsedMs);
      const next = startValue + initialVelocityPxMs * clampedElapsed + 0.5 * decel * clampedElapsed * clampedElapsed;
      const nextVelocity = initialVelocityPxMs + decel * clampedElapsed;

      setTranslateY(next);
      translateYRef.current = next;
      observeTargetMetrics(next);
      velocityRef.current = nextVelocity;

      if (elapsedMs >= durationMs) {
        animationRef.current = null;
        startSpringback(next, edgeValue, nextVelocity);
        return;
      }

      animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);
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
      const next = applyOverscrollResistance(current + deltaY);
      translateYRef.current = next;
      observeTargetMetrics(next);
      return next;
    });
  };

  const startMomentum = (initialVelocityPxMs, overflingDistancePx = 0) => {
    const initialVelocityPxPerSec = initialVelocityPxMs * 1000;
    const physicalCoeff = getAndroidPhysicalCoeff(
      typeof window !== 'undefined' ? window.devicePixelRatio : 1
    );
    const totalDistancePx = getAndroidSplineFlingDistancePx(initialVelocityPxPerSec, physicalCoeff);
    const durationMs = getAndroidSplineFlingDurationMs(initialVelocityPxPerSec, physicalCoeff);

    if (!(durationMs > 0) || !(totalDistancePx > 0)) {
      velocityRef.current = 0;
      return;
    }

    const flingDirection = Math.sign(initialVelocityPxMs) || 1;
    const signedDistancePx = totalDistancePx * flingDirection;
    const startTranslateValue = translateYRef.current;
    const startTime = performance.now();
    const { minTranslate, maxTranslate } = getScrollBounds();

    const step = (now) => {
      const elapsedMs = now - startTime;
      const t = Math.max(0, Math.min(1, elapsedMs / durationMs));
      const index = Math.min(ANDROID_SPLINE_SAMPLES - 1, Math.floor(ANDROID_SPLINE_SAMPLES * t));
      const tInf = index / ANDROID_SPLINE_SAMPLES;
      const tSup = (index + 1) / ANDROID_SPLINE_SAMPLES;
      const dInf = ANDROID_SPLINE_TABLE.position[index];
      const dSup = ANDROID_SPLINE_TABLE.position[index + 1];
      const velocityCoef = (dSup - dInf) / (tSup - tInf);
      const distanceCoef = dInf + (t - tInf) * velocityCoef;

      const desiredTranslate = startTranslateValue + signedDistancePx * distanceCoef;
      const nextTranslate = desiredTranslate;

      if (nextTranslate < minTranslate || nextTranslate > maxTranslate) {
        const edgeValue = nextTranslate > maxTranslate ? maxTranslate : minTranslate;
        setTranslateY(edgeValue);
        translateYRef.current = edgeValue;
        observeTargetMetrics(edgeValue);

        const velocityAtEdgePxMs = velocityCoef * signedDistancePx / durationMs;
        animationRef.current = null;
        startBallisticPhase(edgeValue, velocityAtEdgePxMs, edgeValue, overflingDistancePx);
        return;
      }

      setTranslateY(nextTranslate);
      translateYRef.current = nextTranslate;
      observeTargetMetrics(nextTranslate);

      velocityRef.current = (velocityCoef * signedDistancePx / durationMs);

      if (t >= 1) {
        animationRef.current = null;
        velocityRef.current = 0;
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
    touchSamplesRef.current = [];
    setLiveInstantVelocityPxMs(0);
    setLiveRegressionVelocityPxMs(0);
    pushTouchSample(now, touchY);

    const parsedX1 = parseFloat(x1Input);
    const canStartNewBlock = multiplierTarget === null;

    if (awaitingNextParameterSet) {
      return;
    }

    if (awaitingBlockStartConfirmation) {
      return;
    }

    if (canStartNewBlock && !(parsedX1 >= 0)) {
      return;
    }

    if (!isSearching && runCount < RUNS_PER_BLOCK) {
      const mult = canStartNewBlock ? parsedX1 : multiplierTarget;
      if (canStartNewBlock) {
        setMultiplierTarget(mult);
      }

      setActiveMultiplier(mult);
      setStartTime(Date.now());
      setStartTranslateY(translateY);
      setIsSearching(true);
      setRoundCompleted(false);
      setParameterSyncError('');
      residualVelocityRef.current = 0;
      beginTrialMetrics(translateY);
    }

    if (isSearching || (!isSearching && runCount < RUNS_PER_BLOCK && !(canStartNewBlock && !(parsedX1 >= 0)))) {
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
    pushTouchSample(now, touchY);
    setLiveInstantVelocityPxMs(instantVelocity);
    setLiveRegressionVelocityPxMs(getRegressionVelocityPxMs());

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

    pushTouchSample(endNow, lastTouchY == null ? 0 : lastTouchY);
    const fingerVelocityPxMs = getRegressionVelocityPxMs();
    setLiveInstantVelocityPxMs(0);
    setLiveRegressionVelocityPxMs(fingerVelocityPxMs);

    const regressionMagnitudePxMs = Math.abs(fingerVelocityPxMs);
    const flingVelocityThresholdPxMs = getMinFlingVelocityPxMs();
    const maxFlingVelocityPxMs = getMaxFlingVelocityPxMs();
    const meetsFlingThreshold = isFlingThresholdMet(fingerVelocityPxMs, flingVelocityThresholdPxMs);

    let launchVelocity = 0;
    if (meetsFlingThreshold) {
      launchVelocity = fingerVelocityPxMs;
    }
    launchVelocity = clampFlingVelocityPxMs(launchVelocity, maxFlingVelocityPxMs);

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
    if (meetsFlingThreshold && Math.abs(launchVelocity) > 0) {
      const overflingDistancePx = getAndroidOverflingDistancePx(
        typeof window !== 'undefined' ? window.devicePixelRatio : 1
      );
      startMomentum(launchVelocity, overflingDistancePx);
    } else {
      const currentTranslate = translateYRef.current;
      const clampedTranslate = clampTranslate(currentTranslate);
      if (Math.abs(currentTranslate - clampedTranslate) > 0.5) {
        startSpringback(currentTranslate, clampedTranslate, launchVelocity);
      }
    }

    touchStatsRef.current.active = false;
    setLastTouchY(null);
  };

  const handleButtonClick = async (id) => {
    if (id === targetId && isSearching) {
      stopMomentum();

      if (!practiceRunCompleted) {
        setPracticeRunCompleted(true);
        setTargetSequence(createShuffledTargetNumbers());
        setTargetIndex(0);
        setIsSearching(false);
        setRoundCompleted(false);
        setActiveMultiplier(null);
        setMultiplierTarget(null);
        setRunCount(0);
        setTranslateY(0);
        setStartTime(null);
        residualVelocityRef.current = 0;
        trialMetricsRef.current = null;
        touchStatsRef.current.active = false;
        setParameterSyncError('');
        return;
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const scrollDistance = Math.abs(translateY - startTranslateY);
      const timestamp = new Date().toISOString();
      const x1 = activeMultiplier != null ? activeMultiplier : (parseFloat(x1Input) >= 0 ? parseFloat(x1Input) : 0.1);
      const x2 = parseFloat(x2Input) >= 0 ? parseFloat(x2Input) : 0.5;
      const parsedDecay = parseFloat(decayInput);
      const decay = Number.isFinite(parsedDecay)
        ? Math.max(0.7, Math.min(MAX_EFFECTIVE_DECAY, parsedDecay))
        : DEFAULT_DECAY;
      const fingerVelocityPxMs = getRegressionVelocityPxMs();
      const flingThresholdPxMs = getMinFlingVelocityPxMs();
      const multiplierUsed = activeMultiplier || (parseFloat(x1Input) >= 0 ? parseFloat(x1Input) : 0.1);
      const trial = trialMetricsRef.current;

      const saveOutcome = await saveResult({
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
          velocityPxMs: flingThresholdPxMs,
          distancePx: parseFloat(flickDistanceThresholdInput) >= 0 ? parseFloat(flickDistanceThresholdInput) : 6,
        },
        decayFactor: decay,
        fingerVelocityPxMs,
        paperParams: {
          a: x1,
          b: x2,
          x1,
          x2,
        },
      });

      const nextRunCount = runCount + 1;
      const runBlockFinished = nextRunCount >= RUNS_PER_BLOCK;
      setIsSearching(false);
      setRoundCompleted(true);
      setActiveMultiplier(null);
      setRunCount(nextRunCount);
      if (runBlockFinished) {
        setTargetSequence(createShuffledTargetNumbers());
        setTargetIndex(0);
      } else {
        setTargetIndex(nextRunCount);
      }
      setTranslateY(0);
      setStartTime(null);
      residualVelocityRef.current = 0;
      trialMetricsRef.current = null;
      touchStatsRef.current.active = false;

      if (runBlockFinished) {
        setAwaitingNextParameterSet(true);
        setAwaitingBlockStartConfirmation(false);
        setParameterSyncError('');
        setMultiplierTarget(null);
        setRunCount(0);

        let receivedUpdatedParameters = false;
        if (saveOutcome?.savedRemotely) {
          try {
            const nextParameterSet = await triggerNextParameterSetUpdate(saveOutcome.attemptsCount);
            receivedUpdatedParameters = applyNextParameterSet(nextParameterSet);
          } catch (error) {
            console.error('Error triggering next parameter set update', error);
          }
        }

        setAwaitingNextParameterSet(false);

        if (receivedUpdatedParameters) {
          setAwaitingBlockStartConfirmation(true);
        } else {
          setParameterSyncError('Neue Parameter wurden noch nicht vom Backend bereitgestellt. Bitte kurz warten und erneut versuchen.');
        }
      }
    }
  };

  const handleConfirmNextBlockStart = () => {
    setAwaitingBlockStartConfirmation(false);
    setRoundCompleted(false);
    setParameterSyncError('');
  };

  const targetPositionRatio = getTargetPositionRatio();
  const currentPositionRatio = getCurrentPositionRatio();
  const currentFlingThresholdPxMs = getMinFlingVelocityPxMs();
  const completedRunsForProgress = awaitingNextParameterSet || awaitingBlockStartConfirmation
    ? RUNS_PER_BLOCK
    : Math.min(runCount, RUNS_PER_BLOCK);
  const wrapperClassName = `scroll-list-wrapper ${scrollHandPreference === 'left' ? 'left-hand' : 'right-hand'}`;

  return (
    <div className={wrapperClassName}>
      <div className="safe-area-progress" aria-label={`Fortschritt ${completedRunsForProgress} von ${RUNS_PER_BLOCK}`}>
        <div className="safe-area-progress-track" role="img" aria-hidden="true">
          {Array.from({ length: RUNS_PER_BLOCK }, (_, index) => (
            <span
              key={`progress-pill-${index}`}
              className={`safe-area-progress-pill ${index < completedRunsForProgress ? 'is-complete' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="timer-panel">
        <div className="timer-content">
          <div className="countdown-display">
            <h3>Find:</h3>
            <div className="target-number">{targetNumber}</div>
          </div>

          {parameterSyncError && !isSearching && (
            <div style={{ marginTop: 12, color: '#b04a00', fontWeight: 'bold' }}>
              {parameterSyncError}
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: 12, color: '#4c5967', lineHeight: 1.5 }}>
            <div>Speed: {formatVelocity(liveInstantVelocityPxMs)} px/ms</div>
            <div>Regression: {formatVelocity(liveRegressionVelocityPxMs)} px/ms</div>
            <div>Threshold={formatVelocity(currentFlingThresholdPxMs)} px/msy</div>
          </div>
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

      {awaitingBlockStartConfirmation && (
        <div className="block-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="next-block-dialog-title">
          <div className="block-confirm-dialog">
            <span id="next-block-dialog-title" className="sr-only">Neuer Block bereit</span>
            <button type="button" className="block-confirm-button" onClick={handleConfirmNextBlockStart}>
              Nächsten Durchlauf starten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScrollList;
