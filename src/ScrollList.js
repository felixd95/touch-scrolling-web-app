import { useState, useEffect, useRef, useCallback } from 'react';
import './ScrollList.css';
import outputs from './backend_config.json';
import {
  clampFlingVelocityPxMs,
  isFlingThresholdMet,
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
  rebuildAndroidSplineTableFromConfig,
  getScrollBounds as getOverScrollerBounds,
  clampTranslate as clampTranslateFromBounds,
  applyOverscrollResistance as applyOverscrollResistanceToBounds,
} from './scrollPhysics/overScrollerPhysics';

const NUM_ITEMS = 330;
const ITEMS_PER_SCREEN = 15;
const RUNS_PER_BLOCK = 10;
const RANDOM_BOOTSTRAP_ATTEMPT_LIMIT = RUNS_PER_BLOCK * 3;
const ANDROID_SAMPLE_WINDOW_MS = 100;
const ANDROID_MAX_SAMPLES = 20;
const FIXED_TARGET_NUMBERS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
const DEFAULT_DECELERATION_RATE = Math.log(0.78) / Math.log(0.9);

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
  decelerationRate: String(FLING_PHYSICS_CONFIG.decelerationRate),
  inflexion: String(FLING_PHYSICS_CONFIG.inflexion),
  decay: '0.98',
  flickDistanceThreshold: '6',
};

const getRandomInRange = (min, max) => min + Math.random() * (max - min);

const createRandomParameterSet = (attemptCount = 0) => ({
  scrollFriction: Number(getRandomInRange(
    FLING_PHYSICS_BOUNDS.scrollFriction.min,
    FLING_PHYSICS_BOUNDS.scrollFriction.max,
  ).toFixed(5)),
  decelerationRate: Number(getRandomInRange(
    FLING_PHYSICS_BOUNDS.decelerationRate.min,
    FLING_PHYSICS_BOUNDS.decelerationRate.max,
  ).toFixed(3)),
  inflexion: Number(getRandomInRange(
    FLING_PHYSICS_BOUNDS.inflexion.min,
    FLING_PHYSICS_BOUNDS.inflexion.max,
  ).toFixed(3)),
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

const isNextParameterSetForAttemptCount = (parameterSet, expectedAttemptCount) => {
  if (!parameterSet || typeof parameterSet !== 'object') return false;

  const generatedFromAttemptCount = Number(parameterSet.generatedFromAttemptCount);
  if (!Number.isFinite(generatedFromAttemptCount)) {
    return false;
  }

  return generatedFromAttemptCount === getAttemptCount(expectedAttemptCount);
};

const normalizeAttemptBlocks = (rawAttempts) => {
  if (!rawAttempts) return [];

  let parsed = rawAttempts;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (error) {
      return [];
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return [];

  const looksLikeBlockStructure = parsed.some((entry) =>
    entry && typeof entry === 'object' && Array.isArray(entry.attempts)
  );

  if (looksLikeBlockStructure) {
    return parsed
      .filter((entry) => entry && typeof entry === 'object' && Array.isArray(entry.attempts))
      .map((entry, index) => ({
        runNumber: Number.isFinite(Number(entry.runNumber)) ? Math.trunc(Number(entry.runNumber)) : index + 1,
        parameterSet:
          entry.parameterSet && typeof entry.parameterSet === 'object'
            ? entry.parameterSet
            : null,
        attempts: entry.attempts.filter((attempt) => attempt && typeof attempt === 'object'),
      }));
  }

  const blocks = [];
  parsed.forEach((attempt, index) => {
    if (!attempt || typeof attempt !== 'object') return;

    const runNumber = Math.floor(index / RUNS_PER_BLOCK) + 1;
    const attemptInBlock = (index % RUNS_PER_BLOCK) + 1;
    let block = blocks[blocks.length - 1];

    if (!block || block.runNumber !== runNumber) {
      block = {
        runNumber,
        parameterSet:
          attempt.blockParameterSet && typeof attempt.blockParameterSet === 'object'
            ? attempt.blockParameterSet
            : null,
        attempts: [],
      };
      blocks.push(block);
    }

    block.attempts.push({
      ...attempt,
      blockIndex: runNumber,
      attemptInBlock: Number.isFinite(Number(attempt.attemptInBlock))
        ? Math.trunc(Number(attempt.attemptInBlock))
        : attemptInBlock,
    });
  });

  return blocks;
};

const countAttemptsInBlocks = (blocks) =>
  blocks.reduce((sum, block) => sum + (Array.isArray(block?.attempts) ? block.attempts.length : 0), 0);

function ScrollList({ participantId, mode = 'study', onExitTestEnvironment }) {
  const isTestMode = mode === 'test';
  const [targetSequence, setTargetSequence] = useState(() => createShuffledTargetNumbers());
  const [targetIndex, setTargetIndex] = useState(0);
  const [practiceRunCompleted, setPracticeRunCompleted] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [lastTouchY, setLastTouchY] = useState(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [decelerationRateInput, setDecelerationRateInput] = useState('1');
  const [decayInput, setDecayInput] = useState('0.98');
  const [, setFlickDistanceThresholdInput] = useState('6');
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
  const [pendingBlockAttempts, setPendingBlockAttempts] = useState([]);
  const [testScrollFriction, setTestScrollFriction] = useState(() => Number(FLING_PHYSICS_CONFIG.scrollFriction));
  const [testDecelerationRate, setTestDecelerationRate] = useState(() => Number(FLING_PHYSICS_CONFIG.decelerationRate));
  const [testInflexion, setTestInflexion] = useState(() => Number(FLING_PHYSICS_CONFIG.inflexion));
  const [isTestParameterPopupOpen, setIsTestParameterPopupOpen] = useState(false);

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
    const parsedInflexion = Number(parameterSet.inflexion);

    let parsedDecelerationRate = Number(parameterSet.decelerationRate);
    if (!Number.isFinite(parsedDecelerationRate)) {
      const parsedX1 = Number(parameterSet.x1 ?? parameterSet.a);
      const parsedX2 = Number(parameterSet.x2 ?? parameterSet.b);
      if (Number.isFinite(parsedX1) && Number.isFinite(parsedX2) && parsedX1 > 0 && parsedX2 > 0 && parsedX2 !== 1) {
        parsedDecelerationRate = Math.log(parsedX1) / Math.log(parsedX2);
      }
    }

    const hasCompletePhysicsConfig = [
      parsedScrollFriction,
      parsedInflexion,
      parsedDecelerationRate,
    ].every((value) => Number.isFinite(value));

    if (!hasCompletePhysicsConfig) return false;

    FLING_PHYSICS_CONFIG.scrollFriction = parsedScrollFriction;
    FLING_PHYSICS_CONFIG.decelerationRate = parsedDecelerationRate > 1
      ? parsedDecelerationRate
      : DEFAULT_DECELERATION_RATE;
    FLING_PHYSICS_CONFIG.inflexion = parsedInflexion;
    rebuildAndroidSplineTableFromConfig();

    setDecelerationRateInput(
      toInputString(parsedDecelerationRate, DEFAULT_PARAMETER_SET.decelerationRate)
    );
    setDecayInput(toInputString(parameterSet.decay, DEFAULT_PARAMETER_SET.decay));
    setFlickDistanceThresholdInput(
      toInputString(parameterSet.flickDistanceThreshold, DEFAULT_PARAMETER_SET.flickDistanceThreshold)
    );
    return true;
  }, [setDecelerationRateInput, setDecayInput, setFlickDistanceThresholdInput]);

  const loadParticipantState = useCallback(async () => {
    if (isTestMode || !participantId) return null;

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
  }, [participantId, isTestMode]);

  const triggerNextParameterSetUpdate = async (attemptCount) => {
    if (isTestMode || !participantId) return null;

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
    if (isTestMode || !participantId) return null;

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
    if (isTestMode) return false;

    try {
      const immediateParameterSet = await triggerNextParameterSetUpdate(attemptCount);
      if (isNextParameterSetForAttemptCount(immediateParameterSet, attemptCount)) {
        setNextParameterSet(immediateParameterSet);
        return true;
      }
    } catch (error) {
      // AppSync can time out while Lambda continues in the background.
      // Continue polling DynamoDB-backed participant state instead of failing fast.
      console.warn('triggerNextParameterSet returned an error; continue polling participant state', error);
    }

    while (true) {
      await wait(500);
      try {
        const participant = await loadParticipantState();
        const nextSet = normalizeParameterSet(participant?.nextParameterSet);
        if (isNextParameterSetForAttemptCount(nextSet, attemptCount)) {
          setNextParameterSet(nextSet);
          return true;
        }
      } catch (error) {
        console.warn('Error while polling participant nextParameterSet; retrying', error);
      }
    }
  };

  const getStoredAttemptsCount = (participantState) => {
    const rawAttempts = participantState?.attempts;
    if (!rawAttempts) return 0;

    const blocks = normalizeAttemptBlocks(rawAttempts);
    return countAttemptsInBlocks(blocks);
  };

  const handleRefreshParameterStatus = async () => {
    if (isTestMode) return;
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
      if (isTestMode) {
        setNextParameterSet(null);
        setAwaitingNextParameterSet(false);
        setAwaitingBlockStartConfirmation(false);
        setParametersReadyForNextBlock(true);
        setParameterSyncError('');
        return;
      }
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
  }, [participantId, applyCurrentParameterSet, loadParticipantState, isTestMode]);

  useEffect(() => {
    if (!isTestMode) return;

    const clampedScrollFriction = Math.max(
      FLING_PHYSICS_BOUNDS.scrollFriction.min,
      Math.min(FLING_PHYSICS_BOUNDS.scrollFriction.max, Number(testScrollFriction))
    );
    const clampedDecelerationRate = Math.max(
      FLING_PHYSICS_BOUNDS.decelerationRate.min,
      Math.min(FLING_PHYSICS_BOUNDS.decelerationRate.max, Number(testDecelerationRate))
    );
    const clampedInflexion = Math.max(
      FLING_PHYSICS_BOUNDS.inflexion.min,
      Math.min(FLING_PHYSICS_BOUNDS.inflexion.max, Number(testInflexion))
    );

    FLING_PHYSICS_CONFIG.scrollFriction = clampedScrollFriction;
    FLING_PHYSICS_CONFIG.decelerationRate = clampedDecelerationRate;
    FLING_PHYSICS_CONFIG.inflexion = clampedInflexion;
    rebuildAndroidSplineTableFromConfig();

    // Ensure parameter changes are immediately noticeable in test mode.
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    velocityRef.current = 0;
    residualVelocityRef.current = 0;

    setDecelerationRateInput(String(clampedDecelerationRate));
    setDecayInput(DEFAULT_PARAMETER_SET.decay);
    setFlickDistanceThresholdInput(DEFAULT_PARAMETER_SET.flickDistanceThreshold);
  }, [
    isTestMode,
    testScrollFriction,
    testDecelerationRate,
    testInflexion,
    setDecelerationRateInput,
    setDecayInput,
    setFlickDistanceThresholdInput,
  ]);

  useEffect(() => {
    translateYRef.current = translateY;
  }, [translateY]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const saveResult = async ({ participantId: saveParticipantId, blockAttempts, blockParameterSet }) => {
    if (!saveParticipantId) {
      return {
        attemptsCount: 0,
        savedRemotely: false,
        error: 'Keine participantId gesetzt. Backend-Speicherung nicht moeglich.',
      };
    }

    if (!Array.isArray(blockAttempts) || blockAttempts.length === 0) {
      return {
        attemptsCount: 0,
        savedRemotely: false,
        error: 'Keine Blockdaten zum Speichern vorhanden.',
      };
    }

    try {
      // fetch current participant attempts
      const qresp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
        body: JSON.stringify({
          query: `query ListParticipants($filter: ModelParticipantFilterInput) { listParticipants(filter: $filter) { items { id attempts } } }`,
          variables: { filter: { id: { eq: saveParticipantId } } },
        }),
      });
      const qjson = await qresp.json();
      if (Array.isArray(qjson.errors) && qjson.errors.length > 0) {
        throw new Error(qjson.errors[0]?.message || 'ListParticipants failed');
      }

      const participantItem = qjson.data?.listParticipants?.items?.[0] || null;
      if (!participantItem?.id) {
        throw new Error('Participant not found in backend while saving attempt');
      }

      const existing = participantItem.attempts || null;
      const existingBlocks = normalizeAttemptBlocks(existing);
      const attemptsBeforeAppend = countAttemptsInBlocks(existingBlocks);
      const blockIndex = Math.floor(attemptsBeforeAppend / RUNS_PER_BLOCK) + 1;

      const nextBlock = {
        runNumber: blockIndex,
        parameterSet: blockParameterSet && typeof blockParameterSet === 'object' ? blockParameterSet : null,
        attempts: blockAttempts.map((attempt, index) => ({
          attemptInBlock: index + 1,
          targetNumber: Number.isFinite(Number(attempt?.targetNumber))
            ? Math.trunc(Number(attempt.targetNumber))
            : null,
          timeMs: Number(attempt?.timeMs ?? 0),
          scrollDistance: Number(attempt?.scrollDistance ?? 0),
          timestamp: attempt?.timestamp,
        })),
      };

      // Append block atomically in backend so each user attempts JSON grows block by block.
      const appendResp = await fetch(outputs.data.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': outputs.data.api_key },
        body: JSON.stringify({
          query: `mutation AppendParticipantAttemptBlock($participantId: ID!, $block: AWSJSON!) { appendParticipantAttemptBlock(participantId: $participantId, block: $block) { id attempts } }`,
          variables: { participantId: saveParticipantId, block: JSON.stringify(nextBlock) },
        }),
      });
      const appendJson = await appendResp.json();
      if (Array.isArray(appendJson.errors) && appendJson.errors.length > 0) {
        throw new Error(appendJson.errors[0]?.message || 'appendParticipantAttemptBlock failed');
      }

      const updatedAttempts = appendJson.data?.appendParticipantAttemptBlock?.attempts;
      const attemptsAfterAppend = updatedAttempts
        ? countAttemptsInBlocks(normalizeAttemptBlocks(updatedAttempts))
        : attemptsBeforeAppend + blockAttempts.length;

      return { attemptsCount: attemptsAfterAppend, savedRemotely: true };
    } catch (err) {
      console.error('Error saving result', err);
      return {
        attemptsCount: 0,
        savedRemotely: false,
        error: err?.message || 'Unbekannter Backend-Fehler beim Speichern',
      };
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

  // Faithful port of Android's default VelocityTracker strategy ("lsq2"):
  // a degree-2 least-squares fit y(t) = B0 + B1*t + B2*t^2 with time measured
  // relative to the most recent sample (t = 0), reporting B1 (the instantaneous
  // slope at release) as the velocity. Uniform sample weighting; the 100 ms /
  // 20-sample horizon is already enforced by pushTouchSample. Uses the normal
  // equations (Cramer's rule) instead of QR — mathematically the same result.
  const getLsq2VelocityPxMs = () => {
    const samples = touchSamplesRef.current;
    if (!samples || samples.length < 2) return 0;
    // A quadratic fit needs at least 3 points; otherwise fall back to lsq1.
    if (samples.length < 3) return getRegressionVelocityPxMs();

    // Time relative to the newest sample so that B1 is the slope at release.
    const t0 = samples[samples.length - 1].timeMs;

    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (const sample of samples) {
      const t = sample.timeMs - t0;
      const y = sample.yPx;
      const t2 = t * t;
      s0 += 1;
      s1 += t;
      s2 += t2;
      s3 += t2 * t;
      s4 += t2 * t2;
      b0 += y;
      b1 += t * y;
      b2 += t2 * y;
    }

    // Normal equations A * [B0, B1, B2]^T = b, solved via Cramer's rule.
    const det =
      s0 * (s2 * s4 - s3 * s3) -
      s1 * (s1 * s4 - s3 * s2) +
      s2 * (s1 * s3 - s2 * s2);

    // Degenerate configuration (e.g. collinear timestamps): fall back to lsq1.
    if (Math.abs(det) < 1e-9) return getRegressionVelocityPxMs();

    const numB1 =
      s0 * (b1 * s4 - b2 * s3) -
      b0 * (s1 * s4 - s3 * s2) +
      s2 * (s1 * b2 - b1 * s2);

    return numB1 / det; // px/ms, same unit as getRegressionVelocityPxMs
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
    pushTouchSample(now, touchY);

    const parsedDecelerationRate = parseFloat(decelerationRateInput);
    const canStartNewBlock = multiplierTarget === null;

    if (canStartNewBlock && !(parsedDecelerationRate >= 0)) {
      return;
    }

    if (!isSearching && runCount < RUNS_PER_BLOCK) {
      const mult = canStartNewBlock ? parsedDecelerationRate : multiplierTarget;
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

    if (
      isSearching
      || (!isSearching
        && runCount < RUNS_PER_BLOCK
        && !(canStartNewBlock && !(parsedDecelerationRate >= 0)))
    ) {
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

    // The list container already uses `touch-action: none` to prevent the
    // browser's native scroll handling. Calling `preventDefault()` in the React
    // touchmove handler here is ignored by passive listeners and triggers the
    // browser warning in DevTools.
    if (lastTouchY === null) return;

    const touchY = event.touches[0].clientY;
    const now = performance.now();
    const deltaY = touchY - lastTouchY;
    const dt = Math.max(now - lastMoveTimeRef.current, 1);

    applyDrag(deltaY);

    const instantVelocity = deltaY / dt;
    velocityRef.current = 0.8 * velocityRef.current + 0.2 * instantVelocity;
    pushTouchSample(now, touchY);

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
    const fingerVelocityPxMs = getLsq2VelocityPxMs();

    const meetsFlingThreshold = isFlingThresholdMet(fingerVelocityPxMs);

    let launchVelocity = 0;
    if (meetsFlingThreshold) {
      launchVelocity = clampFlingVelocityPxMs(fingerVelocityPxMs);
    }

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
      const decelerationRate = activeMultiplier != null
        ? activeMultiplier
        : (parseFloat(decelerationRateInput) >= 0 ? parseFloat(decelerationRateInput) : 0.1);
      const parsedDecay = parseFloat(decayInput);
      const decay = Number.isFinite(parsedDecay)
        ? Math.max(0.7, Math.min(MAX_EFFECTIVE_DECAY, parsedDecay))
        : DEFAULT_DECAY;
      const fingerVelocityPxMs = getLsq2VelocityPxMs();
      const trialMetrics = trialMetricsRef.current;
      const currentAttempt = {
        targetNumber,
        timeMs: totalTime,
        scrollDistance,
        timestamp,
        overshootCount: trialMetrics ? trialMetrics.overshootCount : 0,
        maxOvershootDistancePx: trialMetrics ? trialMetrics.maxOvershootDistancePx : 0,
        didOvershoot: trialMetrics ? trialMetrics.didOvershoot : false,
      };

      const nextPendingBlockAttempts = [...pendingBlockAttempts, currentAttempt];
      setPendingBlockAttempts(nextPendingBlockAttempts);

      let saveOutcome = { attemptsCount: 0, savedRemotely: true };

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
        if (isTestMode) {
          setPendingBlockAttempts([]);
          setAwaitingNextParameterSet(false);
          setAwaitingBlockStartConfirmation(false);
          setParametersReadyForNextBlock(true);
          setParameterSyncError('');
          setMultiplierTarget(null);
          setRunCount(0);
          return;
        }

        saveOutcome = await saveResult({
          participantId,
          blockAttempts: nextPendingBlockAttempts,
          blockParameterSet: {
            scrollFriction: FLING_PHYSICS_CONFIG.scrollFriction,
            decelerationRate: FLING_PHYSICS_CONFIG.decelerationRate,
            inflexion: FLING_PHYSICS_CONFIG.inflexion,
            decay,
            fingerVelocityPxMs,
            decelerationRateInputValue: decelerationRate,
          },
        });

        if (!saveOutcome?.savedRemotely) {
          setIsSearching(false);
          setRoundCompleted(false);
          setActiveMultiplier(null);
          setStartTime(null);
          residualVelocityRef.current = 0;
          trialMetricsRef.current = null;
          touchStatsRef.current.active = false;
          setAwaitingNextParameterSet(false);
          setAwaitingBlockStartConfirmation(false);
          setParametersReadyForNextBlock(false);
          setParameterSyncError(
            `Backend-Speichern fehlgeschlagen. Der Versuch wurde nicht uebernommen. Grund: ${saveOutcome?.error || 'Unbekannter Fehler'}`
          );
          return;
        }

        setPendingBlockAttempts([]);
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
  const showParameterDialog = !isTestMode && (awaitingNextParameterSet || awaitingBlockStartConfirmation || Boolean(parameterSyncError));
  const completedRunsForProgress = awaitingNextParameterSet || awaitingBlockStartConfirmation
    ? RUNS_PER_BLOCK
    : Math.min(runCount, RUNS_PER_BLOCK);
  const listItemHeightPx = containerHeight > 0 ? containerHeight / ITEMS_PER_SCREEN : null;
  const wrapperStyle = listItemHeightPx ? { '--list-item-height': `${listItemHeightPx}px` } : undefined;

  const renderDistanceFeedback = (side) => (
    <div className="distance-feedback" aria-hidden="true">
      <div className="distance-track">
        <div
          className="distance-marker distance-marker-target"
          style={{ top: `${targetPositionRatio * 100}%` }}
          title={`Target (${side})`}
        />
        <div
          className="distance-marker distance-marker-current"
          style={{ top: `${currentPositionRatio * 100}%` }}
          title={`Current Position (${side})`}
        />
      </div>
    </div>
  );

  return (
    <div className="scroll-list-wrapper" style={wrapperStyle}>
      {isTestMode && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 6,
            display: 'flex',
            gap: 0,
            alignItems: 'center',
          }}
        >
          <button type="button" className="nav-button" onClick={onExitTestEnvironment}>Zurück</button>
        </div>
      )}

      {!isTestMode && (
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
      )}

      <div className="target-banner">
        <span className="target-banner-label">Find:</span>
        <span className="target-banner-value">{targetNumber}</span>
      </div>

      <div className="scroll-list-row">
        {renderDistanceFeedback('left')}

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

        {renderDistanceFeedback('right')}
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

      {isTestMode && (
        <>
          <button
            type="button"
            className="test-parameter-trigger"
            onClick={() => setIsTestParameterPopupOpen(true)}
          >
            Parameter
          </button>

          {isTestParameterPopupOpen && (
            <div
              className="test-parameter-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="test-parameter-popup-title"
              onClick={() => setIsTestParameterPopupOpen(false)}
            >
              <div className="test-parameter-dialog" onClick={(event) => event.stopPropagation()}>
                <div className="test-parameter-dialog-header">
                  <h3 id="test-parameter-popup-title">Parameter</h3>
                  <button
                    type="button"
                    className="test-parameter-close"
                    onClick={() => setIsTestParameterPopupOpen(false)}
                    aria-label="Popup schließen"
                  >
                    ×
                  </button>
                </div>

                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  scrollFriction: {Number(testScrollFriction).toFixed(5)}
                  <input
                    type="range"
                    min={FLING_PHYSICS_BOUNDS.scrollFriction.min}
                    max={FLING_PHYSICS_BOUNDS.scrollFriction.max}
                    step="0.0005"
                    value={testScrollFriction}
                    onChange={(event) => setTestScrollFriction(Number(event.target.value))}
                  />
                </label>

                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  decelerationRate: {Number(testDecelerationRate).toFixed(3)}
                  <input
                    type="range"
                    min={FLING_PHYSICS_BOUNDS.decelerationRate.min}
                    max={FLING_PHYSICS_BOUNDS.decelerationRate.max}
                    step="0.01"
                    value={testDecelerationRate}
                    onChange={(event) => setTestDecelerationRate(Number(event.target.value))}
                  />
                </label>

                <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  inflexion: {Number(testInflexion).toFixed(3)}
                  <input
                    type="range"
                    min={FLING_PHYSICS_BOUNDS.inflexion.min}
                    max={FLING_PHYSICS_BOUNDS.inflexion.max}
                    step="0.001"
                    value={testInflexion}
                    onChange={(event) => setTestInflexion(Number(event.target.value))}
                  />
                </label>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ScrollList;
