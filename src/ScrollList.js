import { useState, useEffect, useRef, useCallback } from 'react';
import './ScrollList.css';
import outputs from './amplify_outputs.json';
import {
  getMinFlingVelocityPxMs,
  isFlingThresholdMet,
  clampFlingVelocityPxMs,
} from './scrollPhysics/flingThreshold';
import {
  FLING_PHYSICS_CONFIG,
  FLING_PHYSICS_BOUNDS,
  ANDROID_SPLINE_SAMPLES,
  ANDROID_SPLINE_TABLE,
  OVER_SCROLL_DISTANCE_PX,
  getAndroidPhysicalCoeff,
  getAndroidSplineFlingDistancePx,
  getAndroidSplineFlingDurationMs,
  getScrollBounds as getOverScrollerBounds,
  clampTranslate as clampTranslateFromBounds,
  applyOverscrollResistance as applyOverscrollResistanceToBounds,
} from './scrollPhysics/overScrollerPhysics';

const NUM_ITEMS = 330;
const RUNS_PER_BLOCK = 10;
const RANDOM_BOOTSTRAP_ATTEMPT_LIMIT = RUNS_PER_BLOCK * 3;
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
  scrollFriction: String(FLING_PHYSICS_CONFIG.scrollFriction),
  x1: String(FLING_PHYSICS_CONFIG.x1),
  x2: String(FLING_PHYSICS_CONFIG.x2),
  inflexion: String(FLING_PHYSICS_CONFIG.inflexion),
  physicalCoeffTuning: String(FLING_PHYSICS_CONFIG.physicalCoeffTuning),
  maxLaunchVelocityPxMs: String(FLING_PHYSICS_CONFIG.maxLaunchVelocityPxMs),
  decay: '0.98',
  flickDistanceThreshold: '6',
};

const getRandomInRange = (min, max) => min + Math.random() * (max - min);

const createRandomParameterSet = (attemptCount = 0) => ({
  scrollFriction: Number(getRandomInRange(
    FLING_PHYSICS_BOUNDS.scrollFriction.min,
    FLING_PHYSICS_BOUNDS.scrollFriction.max,
  ).toFixed(5)),
  x1: Number(getRandomInRange(
    FLING_PHYSICS_BOUNDS.x1.min,
    FLING_PHYSICS_BOUNDS.x1.max,
  ).toFixed(3)),
  x2: Number(getRandomInRange(
    FLING_PHYSICS_BOUNDS.x2.min,
    FLING_PHYSICS_BOUNDS.x2.max,
  ).toFixed(3)),
  inflexion: Number(getRandomInRange(
    FLING_PHYSICS_BOUNDS.inflexion.min,
    FLING_PHYSICS_BOUNDS.inflexion.max,
  ).toFixed(3)),
  physicalCoeffTuning: Number(getRandomInRange(
    FLING_PHYSICS_BOUNDS.physicalCoeffTuning.min,
    FLING_PHYSICS_BOUNDS.physicalCoeffTuning.max,
  ).toFixed(3)),
  maxLaunchVelocityPxMs: Number(getRandomInRange(
    FLING_PHYSICS_BOUNDS.maxLaunchVelocityPxMs.min,
    FLING_PHYSICS_BOUNDS.maxLaunchVelocityPxMs.max,
  ).toFixed(2)),
  blockSize: RUNS_PER_BLOCK,
  status: 'ready',
  source: 'random-initial-parameter-set',
  generatedFromAttemptCount: attemptCount,
  completedBlockCount: Math.floor(attemptCount / RUNS_PER_BLOCK),
});

const getAttemptCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const isBootstrapPhase = (attemptCount) => getAttemptCount(attemptCount) < RANDOM_BOOTSTRAP_ATTEMPT_LIMIT;

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
  const [, setRoundCompleted] = useState(false);
  const [, setCurrentParameterSet] = useState(null);
  const [startTranslateY, setStartTranslateY] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(null);
  const [multiplierTarget, setMultiplierTarget] = useState(null);
  const [runCount, setRunCount] = useState(0);
  const [awaitingNextParameterSet, setAwaitingNextParameterSet] = useState(false);
  const [awaitingBlockStartConfirmation, setAwaitingBlockStartConfirmation] = useState(false);
  const [parametersReadyForNextBlock, setParametersReadyForNextBlock] = useState(true);
  const [parameterSyncError, setParameterSyncError] = useState('');
  const [nextParameterSet, setNextParameterSet] = useState(null);
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

  const applyCurrentParameterSet = useCallback((rawParameterSet) => {
    const normalizedParameterSet = normalizeParameterSet(rawParameterSet);
    if (!normalizedParameterSet) return false;

    const parameterSet = normalizedParameterSet.parameters && typeof normalizedParameterSet.parameters === 'object'
      ? normalizedParameterSet.parameters
      : normalizedParameterSet;

    const parsedScrollFriction = Number(parameterSet.scrollFriction);
    const parsedX1 = Number(parameterSet.x1 ?? parameterSet.a);
    const parsedX2 = Number(parameterSet.x2 ?? parameterSet.b);
    const parsedInflexion = Number(parameterSet.inflexion);
    const parsedPhysicalCoeffTuning = Number(parameterSet.physicalCoeffTuning);
    const parsedMaxLaunchVelocityPxMs = Number(parameterSet.maxLaunchVelocityPxMs);

    const hasCompletePhysicsConfig = [
      parsedScrollFriction,
      parsedX1,
      parsedX2,
      parsedInflexion,
      parsedPhysicalCoeffTuning,
      parsedMaxLaunchVelocityPxMs,
    ].every((value) => Number.isFinite(value));

    if (!hasCompletePhysicsConfig) return false;

    FLING_PHYSICS_CONFIG.scrollFriction = parsedScrollFriction;
    FLING_PHYSICS_CONFIG.x1 = parsedX1;
    FLING_PHYSICS_CONFIG.x2 = parsedX2;
    FLING_PHYSICS_CONFIG.inflexion = parsedInflexion;
    FLING_PHYSICS_CONFIG.physicalCoeffTuning = parsedPhysicalCoeffTuning;
    FLING_PHYSICS_CONFIG.maxLaunchVelocityPxMs = parsedMaxLaunchVelocityPxMs;

    const rawX1 = parameterSet.x1 ?? parameterSet.a;
    const rawX2 = parameterSet.x2 ?? parameterSet.b;

    setX1Input(toInputString(rawX1, DEFAULT_PARAMETER_SET.x1));
    setX2Input(toInputString(rawX2, DEFAULT_PARAMETER_SET.x2));
    setDecayInput(toInputString(parameterSet.decay, DEFAULT_PARAMETER_SET.decay));
    setFlickDistanceThresholdInput(
      toInputString(parameterSet.flickDistanceThreshold, DEFAULT_PARAMETER_SET.flickDistanceThreshold)
    );
    return true;
  }, [setX1Input, setX2Input, setDecayInput, setFlickDistanceThresholdInput]);

  const loadParticipantState = useCallback(async () => {
    if (!participantId) return null;

    const resp = await fetch(outputs.data.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
      body: JSON.stringify({
        query: `query ListParticipants($filter: ModelParticipantFilterInput) { listParticipants(filter: $filter) { items { id attempts currentParameterSet nextParameterSet } } }`,
        variables: { filter: { id: { eq: participantId } } },
      }),
    });

    const json = await resp.json();
    return json.data?.listParticipants?.items?.[0] || null;
  }, [participantId]);

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

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const updateParticipantParameterSets = async (updatedSets) => {
    if (!participantId) return null;

    const resp = await fetch(outputs.data.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
      body: JSON.stringify({
        query: `mutation UpdateParticipant($input: UpdateParticipantInput!) { updateParticipant(input: $input) { id currentParameterSet nextParameterSet } }`,
        variables: { input: { id: participantId, ...updatedSets } },
      }),
    });

    const json = await resp.json();
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message || 'Failed to update participant parameter sets');
    }

    return json.data?.updateParticipant || null;
  };

  const synchronizeNextParameterSet = async (attemptCount) => {
    const immediateParameterSet = await triggerNextParameterSetUpdate(attemptCount);
    if (immediateParameterSet) {
      setNextParameterSet(immediateParameterSet);
      return true;
    }

    for (let retry = 0; retry < 5; retry += 1) {
      await wait(500);
      const participant = await loadParticipantState();
      const nextSet = normalizeParameterSet(participant?.nextParameterSet);
      if (nextSet) {
        setNextParameterSet(nextSet);
        return true;
      }
    }

    return false;
  };

  const getStoredAttemptsCount = (participantState) => {
    const rawAttempts = participantState?.attempts;
    if (!rawAttempts) return 0;

    if (Array.isArray(rawAttempts)) return rawAttempts.length;

    if (typeof rawAttempts === 'string') {
      try {
        const parsed = JSON.parse(rawAttempts);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch (error) {
        return 0;
      }
    }

    return 0;
  };

  const handleRefreshParameterStatus = async () => {
    if (!participantId) return;

    setAwaitingNextParameterSet(true);
    setParameterSyncError('');

    try {
      const participant = await loadParticipantState();
      const nextSet = normalizeParameterSet(participant?.nextParameterSet);

      if (nextSet) {
        setNextParameterSet(nextSet);
        setAwaitingNextParameterSet(false);
        setAwaitingBlockStartConfirmation(true);
        return;
      }

      const attemptsCount = getStoredAttemptsCount(participant);
      if (isBootstrapPhase(attemptsCount)) {
        const randomParameterSet = createRandomParameterSet(attemptsCount);
        await updateParticipantParameterSets({ nextParameterSet: JSON.stringify(randomParameterSet) });
        setNextParameterSet(randomParameterSet);
        setAwaitingNextParameterSet(false);
        setAwaitingBlockStartConfirmation(true);
        return;
      }

      setAwaitingNextParameterSet(false);
      setParameterSyncError('Parameter-Update ausstehend: bitte erneut prüfen.');
    } catch (error) {
      console.error('Error refreshing parameter status', error);
      setAwaitingNextParameterSet(false);
      setParameterSyncError('Parameter konnten nicht geladen werden. Bitte erneut prüfen.');
    }
  };

  useEffect(() => {
    const loadParticipantParameters = async () => {
      if (!participantId) return;

      try {
        const participant = await loadParticipantState();
        const currentSet = normalizeParameterSet(participant?.currentParameterSet);
        const nextSet = normalizeParameterSet(participant?.nextParameterSet);
        let activeSet = currentSet;
        let pendingNext = nextSet;

        if (!activeSet && nextSet) {
          applyCurrentParameterSet(nextSet);
          activeSet = nextSet;
          pendingNext = null;
        } else if (activeSet) {
          applyCurrentParameterSet(activeSet);
        }

        setNextParameterSet(pendingNext);
        setParametersReadyForNextBlock(!pendingNext);
        setParameterSyncError('');
      } catch (error) {
        console.error('Error loading participant parameters', error);
      }
    };

    loadParticipantParameters();
  }, [participantId, applyCurrentParameterSet, loadParticipantState]);

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

      const attemptsBeforeAppend = arr.length;
      const blockIndex = Math.floor(attemptsBeforeAppend / RUNS_PER_BLOCK) + 1;
      const attemptInBlock = (attemptsBeforeAppend % RUNS_PER_BLOCK) + 1;
      const normalizedTargetNumber = Number.isFinite(Number(result.targetNumber))
        ? Math.trunc(Number(result.targetNumber))
        : null;
      const normalizedBlockParameterSet =
        result.blockParameterSet && typeof result.blockParameterSet === 'object'
          ? result.blockParameterSet
          : null;

      const enrichedResult = {
        ...result,
        blockIndex,
        attemptInBlock,
        targetNumber: normalizedTargetNumber,
        blockParameterSet: normalizedBlockParameterSet,
      };

      // Persist each attempt as a Result item; if backend schema is older, gracefully retry with base fields.
      const resultInputBase = {
        participantId: result.participantId,
        timeMs: String(result.timeMs ?? ''),
        scrollDistance: String(result.scrollDistance ?? ''),
        timestamp: String(result.timestamp ?? ''),
        multiplierUsed: String(result.multiplierUsed ?? ''),
      };
      const resultInputExtended = {
        ...resultInputBase,
        targetNumber: normalizedTargetNumber,
        blockIndex,
        attemptInBlock,
        blockParameterSet: normalizedBlockParameterSet,
      };

      const createResultRequest = async (input) => {
        const createResultResp = await fetch(outputs.data.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
          body: JSON.stringify({
            query: `mutation CreateResult($input: CreateResultInput!) { createResult(input: $input) { id participantId } }`,
            variables: { input },
          }),
        });
        return createResultResp.json();
      };

      let createResultJson = await createResultRequest(resultInputExtended);
      if (createResultJson.errors?.length) {
        createResultJson = await createResultRequest(resultInputBase);
      }
      if (createResultJson.errors?.length) {
        throw new Error(createResultJson.errors[0]?.message || 'Failed to persist result item');
      }

      if (arr.length >= 100) arr.shift();
      arr.push(enrichedResult);

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
    return applyOverscrollResistanceToBounds(value, bounds, OVER_SCROLL_DISTANCE_PX);
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

  const startMomentum = (initialVelocityPxMs) => {
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
        animationRef.current = null;
        velocityRef.current = 0;
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

    if (awaitingNextParameterSet || awaitingBlockStartConfirmation || !parametersReadyForNextBlock) {
      setLastTouchY(null);
      touchStatsRef.current.active = false;
      return;
    }

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

    const flingVelocityThresholdPxMs = getMinFlingVelocityPxMs();
    const meetsFlingThreshold = isFlingThresholdMet(fingerVelocityPxMs, flingVelocityThresholdPxMs);

    let launchVelocity = 0;
    if (meetsFlingThreshold) {
      launchVelocity = fingerVelocityPxMs;
    }
    launchVelocity = clampFlingVelocityPxMs(launchVelocity, FLING_PHYSICS_CONFIG.maxLaunchVelocityPxMs);

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
      startMomentum(launchVelocity);
    } else {
      const currentTranslate = translateYRef.current;
      const clampedTranslate = clampTranslate(currentTranslate);
      if (Math.abs(currentTranslate - clampedTranslate) > 0.5) {
        setTranslateY(clampedTranslate);
        translateYRef.current = clampedTranslate;
        observeTargetMetrics(clampedTranslate);
      }
      velocityRef.current = 0;
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
        blockParameterSet: {
          scrollFriction: FLING_PHYSICS_CONFIG.scrollFriction,
          x1: FLING_PHYSICS_CONFIG.x1,
          x2: FLING_PHYSICS_CONFIG.x2,
          inflexion: FLING_PHYSICS_CONFIG.inflexion,
          physicalCoeffTuning: FLING_PHYSICS_CONFIG.physicalCoeffTuning,
          maxLaunchVelocityPxMs: FLING_PHYSICS_CONFIG.maxLaunchVelocityPxMs,
        },
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
        setParametersReadyForNextBlock(false);
        setParameterSyncError('');
        setMultiplierTarget(null);
        setRunCount(0);

        let receivedUpdatedParameters = false;
        const attemptsCount = getAttemptCount(saveOutcome?.attemptsCount);
        if (saveOutcome?.savedRemotely) {
          try {
            if (isBootstrapPhase(attemptsCount)) {
              const randomParameterSet = createRandomParameterSet(attemptsCount);
              await updateParticipantParameterSets({ nextParameterSet: JSON.stringify(randomParameterSet) });
              setNextParameterSet(randomParameterSet);
              receivedUpdatedParameters = true;
            } else {
              receivedUpdatedParameters = await synchronizeNextParameterSet(attemptsCount);
            }
          } catch (error) {
            console.error('Error setting next parameter set after block finish', error);
            if (isBootstrapPhase(attemptsCount)) {
              const randomParameterSet = createRandomParameterSet(attemptsCount);
              setNextParameterSet(randomParameterSet);
              receivedUpdatedParameters = true;
            }
          }
        } else if (isBootstrapPhase(attemptsCount)) {
          const randomParameterSet = createRandomParameterSet(attemptsCount);
          setNextParameterSet(randomParameterSet);
          receivedUpdatedParameters = true;
        }

        if (receivedUpdatedParameters) {
          setAwaitingNextParameterSet(false);
          setAwaitingBlockStartConfirmation(true);
        } else {
          setAwaitingNextParameterSet(false);
          setParameterSyncError('Parameter-Update ausstehend: Der nächste 10er-Block bleibt gesperrt, bis neue Parameter geladen wurden.');
        }
      }
    }
  };

  const handleConfirmNextBlockStart = async () => {
    if (!nextParameterSet || !participantId) {
      setAwaitingBlockStartConfirmation(false);
      setParameterSyncError('Keine neuen Parameter zum Starten des nächsten Blocks vorhanden.');
      return;
    }

    try {
      const serializedNext = JSON.stringify(nextParameterSet);
      await updateParticipantParameterSets({
        currentParameterSet: serializedNext,
        nextParameterSet: null,
      });
      applyCurrentParameterSet(nextParameterSet);
      setCurrentParameterSet(nextParameterSet);
      setNextParameterSet(null);
      setAwaitingBlockStartConfirmation(false);
      setParametersReadyForNextBlock(true);
      setRoundCompleted(false);
      setParameterSyncError('');
    } catch (error) {
      console.error('Error promoting next parameter set', error);
      setParameterSyncError('Fehler beim Aktivieren des neuen Parametersatzes. Bitte erneut versuchen.');
    }
  };

  const targetPositionRatio = getTargetPositionRatio();
  const currentPositionRatio = getCurrentPositionRatio();
  const currentFlingThresholdPxMs = getMinFlingVelocityPxMs();
  const currentDecelerationRate = Math.log(FLING_PHYSICS_CONFIG.x1) / Math.log(FLING_PHYSICS_CONFIG.x2);
  const showParameterDialog = awaitingNextParameterSet || awaitingBlockStartConfirmation || Boolean(parameterSyncError);
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

          <div className="current-parameters">
            <div className="parameters-title">Aktuelle Parameter</div>
            <div className="parameter-line">scrollFriction: {FLING_PHYSICS_CONFIG.scrollFriction.toFixed(4)}</div>
            <div className="parameter-line">x1: {FLING_PHYSICS_CONFIG.x1.toFixed(3)}</div>
            <div className="parameter-line">x2: {FLING_PHYSICS_CONFIG.x2.toFixed(3)}</div>
            <div className="parameter-line">inflexion: {FLING_PHYSICS_CONFIG.inflexion.toFixed(3)}</div>
            <div className="parameter-line">physicalCoeffTuning: {FLING_PHYSICS_CONFIG.physicalCoeffTuning.toFixed(3)}</div>
            <div className="parameter-line">maxLaunchVelocity: {FLING_PHYSICS_CONFIG.maxLaunchVelocityPxMs.toFixed(2)} px/ms</div>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: '#4c5967', lineHeight: 1.5 }}>
            <div>Speed: {formatVelocity(liveInstantVelocityPxMs)} px/ms</div>
            <div>Regression: {formatVelocity(liveRegressionVelocityPxMs)} px/ms</div>
            <div>Threshold={formatVelocity(currentFlingThresholdPxMs)} px/msy</div>
            <div>scrollFriction={FLING_PHYSICS_CONFIG.scrollFriction.toFixed(4)}</div>
            <div>x1={FLING_PHYSICS_CONFIG.x1.toFixed(2)}</div>
            <div>x2={FLING_PHYSICS_CONFIG.x2.toFixed(2)}</div>
            <div>inflexion={FLING_PHYSICS_CONFIG.inflexion.toFixed(2)}</div>
            <div>physicalCoeffTuning={FLING_PHYSICS_CONFIG.physicalCoeffTuning.toFixed(2)}</div>
            <div>maxLaunchVelocity={FLING_PHYSICS_CONFIG.maxLaunchVelocityPxMs.toFixed(2)} px/ms</div>
            <div>decelerationRate={currentDecelerationRate.toFixed(6)}</div>
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

      {showParameterDialog && (
        <div className="block-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="next-block-dialog-title">
          <div className="block-confirm-dialog">
            <h3 id="next-block-dialog-title">
              {awaitingBlockStartConfirmation ? 'Neuer Block bereit' : 'Parameter-Update'}
            </h3>
            <p>
              {awaitingBlockStartConfirmation
                ? 'Neue Parameter sind da. Starte den nächsten 10er-Block.'
                : (parameterSyncError || 'Parameter werden geladen. Bitte warten.')}
            </p>
            {awaitingBlockStartConfirmation ? (
              <button type="button" className="block-confirm-button" onClick={handleConfirmNextBlockStart}>
                Nächsten Durchlauf starten
              </button>
            ) : (
              <button
                type="button"
                className="block-confirm-button"
                onClick={handleRefreshParameterStatus}
                disabled={awaitingNextParameterSet}
              >
                {awaitingNextParameterSet ? 'Prüfe...' : 'Erneut prüfen'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ScrollList;
