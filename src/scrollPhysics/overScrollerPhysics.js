const ANDROID_SCROLL_FRICTION = 0.015;
const ANDROID_GRAVITY_EARTH = 9.80665;
const ANDROID_DECELERATION_RATE = Math.log(0.78) / Math.log(0.9);
const ANDROID_INFLEXION = 0.35;
const ANDROID_START_TENSION = 0.5;
const ANDROID_END_TENSION = 1.0;
const ANDROID_P1 = ANDROID_START_TENSION * ANDROID_INFLEXION;
const ANDROID_P2 = 1.0 - ANDROID_END_TENSION * (1.0 - ANDROID_INFLEXION);

export const ANDROID_SPLINE_SAMPLES = 100;
export const OVERSCROLL_RESISTANCE = 0.35;
export const EDGE_BALLISTIC_DECEL_PX_S2 = 2000;
export const MIN_BALLISTIC_DURATION_MS = 120;
export const MIN_SPRINGBACK_DURATION_MS = 180;
export const MAX_SPRINGBACK_DURATION_MS = 480;
// Android ViewConfiguration defaults are density-scaled distances in dp.
export const ANDROID_OVERSCROLL_DISTANCE_DP = 0;
export const ANDROID_OVERFLING_DISTANCE_DP = 6;

const getDevicePixelRatio = () => {
  if (typeof window === 'undefined') return 1;
  return Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
};

const getViewportSize = () => {
  if (typeof window === 'undefined') {
    return { widthPx: 0, heightPx: 0 };
  }

  const widthPx = Number.isFinite(window.innerWidth) ? window.innerWidth : 0;
  const heightPx = Number.isFinite(window.innerHeight) ? window.innerHeight : 0;
  return { widthPx, heightPx };
};

const isXlargeScreen = (widthPx, heightPx, devicePixelRatio) => {
  if (!(widthPx > 0) || !(heightPx > 0)) return false;
  const safeDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const minDp = Math.min(widthPx, heightPx) / safeDpr;
  // Android xlarge buckets are typically around >= 720dp minimum dimension.
  return minDp >= 720;
};

const getAndroidSizeAndDensity = (
  devicePixelRatio = getDevicePixelRatio(),
  viewport = getViewportSize()
) => {
  const safeDpr = Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const sizeAndDensity = isXlargeScreen(viewport.widthPx, viewport.heightPx, safeDpr)
    ? safeDpr * 1.5
    : safeDpr;
  return sizeAndDensity;
};

const toAndroidScaledPxInt = (dpValue, sizeAndDensity) => {
  return Math.floor(dpValue * sizeAndDensity + 0.5);
};

export const getAndroidOverscrollDistancePx = (
  devicePixelRatio = getDevicePixelRatio(),
  viewport = getViewportSize()
) => {
  const sizeAndDensity = getAndroidSizeAndDensity(devicePixelRatio, viewport);
  return toAndroidScaledPxInt(ANDROID_OVERSCROLL_DISTANCE_DP, sizeAndDensity);
};

export const getAndroidOverflingDistancePx = (
  devicePixelRatio = getDevicePixelRatio(),
  viewport = getViewportSize()
) => {
  const sizeAndDensity = getAndroidSizeAndDensity(devicePixelRatio, viewport);
  return toAndroidScaledPxInt(ANDROID_OVERFLING_DISTANCE_DP, sizeAndDensity);
};

const buildAndroidSplineTable = () => {
  const position = new Array(ANDROID_SPLINE_SAMPLES + 1).fill(0);
  const time = new Array(ANDROID_SPLINE_SAMPLES + 1).fill(0);

  let xMin = 0;
  let yMin = 0;

  for (let i = 0; i < ANDROID_SPLINE_SAMPLES; i += 1) {
    const alpha = i / ANDROID_SPLINE_SAMPLES;

    let xMax = 1;
    let x = 0;
    let tx = 0;
    let coef = 0;
    while (true) {
      x = xMin + (xMax - xMin) / 2;
      coef = 3 * x * (1 - x);
      tx = coef * ((1 - x) * ANDROID_P1 + x * ANDROID_P2) + x * x * x;
      if (Math.abs(tx - alpha) < 1e-5) break;
      if (tx > alpha) xMax = x;
      else xMin = x;
    }
    position[i] = coef * ((1 - x) * ANDROID_START_TENSION + x) + x * x * x;

    let yMax = 1;
    let y = 0;
    let dy = 0;
    while (true) {
      y = yMin + (yMax - yMin) / 2;
      coef = 3 * y * (1 - y);
      dy = coef * ((1 - y) * ANDROID_START_TENSION + y) + y * y * y;
      if (Math.abs(dy - alpha) < 1e-5) break;
      if (dy > alpha) yMax = y;
      else yMin = y;
    }
    time[i] = coef * ((1 - y) * ANDROID_P1 + y * ANDROID_P2) + y * y * y;
  }

  position[ANDROID_SPLINE_SAMPLES] = 1;
  time[ANDROID_SPLINE_SAMPLES] = 1;

  return { position, time };
};

export const ANDROID_SPLINE_TABLE = buildAndroidSplineTable();

export const getAndroidPhysicalCoeff = (devicePixelRatio = 1) => {
  const safeDpr = Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const ppi = safeDpr * 160;
  return ANDROID_GRAVITY_EARTH * 39.37 * ppi * 0.84;
};

export const getAndroidSplineDeceleration = (velocityPxPerSec, physicalCoeff) => {
  return Math.log((ANDROID_INFLEXION * Math.abs(velocityPxPerSec)) / (ANDROID_SCROLL_FRICTION * physicalCoeff));
};

export const getAndroidSplineFlingDistancePx = (velocityPxPerSec, physicalCoeff) => {
  if (!Number.isFinite(velocityPxPerSec) || velocityPxPerSec === 0) return 0;
  const deceleration = getAndroidSplineDeceleration(velocityPxPerSec, physicalCoeff);
  const decelMinusOne = ANDROID_DECELERATION_RATE - 1;
  return ANDROID_SCROLL_FRICTION * physicalCoeff * Math.exp((ANDROID_DECELERATION_RATE / decelMinusOne) * deceleration);
};

export const getAndroidSplineFlingDurationMs = (velocityPxPerSec, physicalCoeff) => {
  if (!Number.isFinite(velocityPxPerSec) || velocityPxPerSec === 0) return 0;
  const deceleration = getAndroidSplineDeceleration(velocityPxPerSec, physicalCoeff);
  const decelMinusOne = ANDROID_DECELERATION_RATE - 1;
  return 1000 * Math.exp(deceleration / decelMinusOne);
};

export const getScrollBounds = (contentHeight, containerHeight) => {
  const maxTranslate = 0;
  if (!contentHeight) {
    return { minTranslate: 0, maxTranslate };
  }

  const minTranslate = Math.min(0, containerHeight - contentHeight - 20);
  return { minTranslate, maxTranslate };
};

export const clampTranslate = (value, bounds) => {
  return Math.max(bounds.minTranslate, Math.min(bounds.maxTranslate, value));
};

export const applyOverscrollResistance = (
  value,
  bounds,
  maxOverscrollDistancePx = getAndroidOverscrollDistancePx()
) => {
  const distanceLimit = Number.isFinite(maxOverscrollDistancePx)
    ? Math.max(0, maxOverscrollDistancePx)
    : getAndroidOverscrollDistancePx();

  if (distanceLimit <= 0) {
    return clampTranslate(value, bounds);
  }

  if (value > bounds.maxTranslate) {
    const overflow = value - bounds.maxTranslate;
    return Math.min(bounds.maxTranslate + overflow * OVERSCROLL_RESISTANCE, bounds.maxTranslate + distanceLimit);
  }

  if (value < bounds.minTranslate) {
    const overflow = bounds.minTranslate - value;
    return Math.max(bounds.minTranslate - overflow * OVERSCROLL_RESISTANCE, bounds.minTranslate - distanceLimit);
  }

  return value;
};

export const getSpringbackDurationMs = (deltaPx, initialVelocityPxMs) => {
  const accelPxMs2 = EDGE_BALLISTIC_DECEL_PX_S2 / 1_000_000;
  const baseDuration = Math.sqrt((2 * Math.abs(deltaPx)) / accelPxMs2);
  const velocityContribution = Math.abs(initialVelocityPxMs) * 100;
  return Math.max(
    MIN_SPRINGBACK_DURATION_MS,
    Math.min(MAX_SPRINGBACK_DURATION_MS, baseDuration + velocityContribution)
  );
};

export const getBallisticProfile = (
  initialVelocityPxMs,
  maxOverDistancePx = getAndroidOverflingDistancePx()
) => {
  const baseDecelPxMs2 = EDGE_BALLISTIC_DECEL_PX_S2 / 1_000_000;
  const speed = Math.abs(initialVelocityPxMs);
  const overDistanceLimit = Number.isFinite(maxOverDistancePx)
    ? Math.max(0, maxOverDistancePx)
    : getAndroidOverflingDistancePx();

  if (overDistanceLimit <= 0) {
    return {
      decelMagnitude: baseDecelPxMs2,
      durationMs: 0,
    };
  }

  let decelMagnitude = baseDecelPxMs2;
  let overshootDistance = (speed * speed) / (2 * decelMagnitude);
  if (overshootDistance > overDistanceLimit) {
    overshootDistance = overDistanceLimit;
    decelMagnitude = (speed * speed) / (2 * overshootDistance);
  }

  return {
    decelMagnitude,
    durationMs: Math.max(MIN_BALLISTIC_DURATION_MS, speed / decelMagnitude),
  };
};
