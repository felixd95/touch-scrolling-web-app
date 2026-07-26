const ANDROID_GRAVITY_EARTH_FIXED = 9.80665;
const ANDROID_START_TENSION_FIXED = 0.5;
const ANDROID_END_TENSION_FIXED = 1.0;

export const FLING_PHYSICS_CONFIG = {
  scrollFriction: 0.015,
  decelerationRate: Math.log(0.78) / Math.log(0.9),
  inflexion: 0.35,
  physicalCoeffTuning: 0.84,
  maxLaunchVelocityPxMs: 40,
};

const ANDROID_P1 = ANDROID_START_TENSION_FIXED * FLING_PHYSICS_CONFIG.inflexion;
const ANDROID_P2 = 1.0 - ANDROID_END_TENSION_FIXED * (1.0 - FLING_PHYSICS_CONFIG.inflexion);

export const ANDROID_SPLINE_SAMPLES = 100;
export const OVER_SCROLL_DISTANCE_PX = 120;
export const OVERSCROLL_RESISTANCE = 0.35;

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
    position[i] = coef * ((1 - x) * ANDROID_START_TENSION_FIXED + x) + x * x * x;

    let yMax = 1;
    let y = 0;
    let dy = 0;
    while (true) {
      y = yMin + (yMax - yMin) / 2;
      coef = 3 * y * (1 - y);
      dy = coef * ((1 - y) * ANDROID_START_TENSION_FIXED + y) + y * y * y;
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
  return ANDROID_GRAVITY_EARTH_FIXED * 39.37 * ppi * FLING_PHYSICS_CONFIG.physicalCoeffTuning;
};

export const getAndroidSplineDeceleration = (velocityPxPerSec, physicalCoeff) => {
  return Math.log(
    (FLING_PHYSICS_CONFIG.inflexion * Math.abs(velocityPxPerSec))
      / (FLING_PHYSICS_CONFIG.scrollFriction * physicalCoeff)
  );
};

export const getAndroidSplineFlingDistancePx = (velocityPxPerSec, physicalCoeff) => {
  if (!Number.isFinite(velocityPxPerSec) || velocityPxPerSec === 0) return 0;
  const effectiveCoeff = Number.isFinite(physicalCoeff)
    ? physicalCoeff
    : getAndroidPhysicalCoeff(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  const deceleration = getAndroidSplineDeceleration(velocityPxPerSec, effectiveCoeff);
  const decelMinusOne = FLING_PHYSICS_CONFIG.decelerationRate - 1;
  return FLING_PHYSICS_CONFIG.scrollFriction * effectiveCoeff * Math.exp(
    (FLING_PHYSICS_CONFIG.decelerationRate / decelMinusOne) * deceleration
  );
};

export const getAndroidSplineFlingDurationMs = (velocityPxPerSec, physicalCoeff) => {
  if (!Number.isFinite(velocityPxPerSec) || velocityPxPerSec === 0) return 0;
  const effectiveCoeff = Number.isFinite(physicalCoeff)
    ? physicalCoeff
    : getAndroidPhysicalCoeff(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  const deceleration = getAndroidSplineDeceleration(velocityPxPerSec, effectiveCoeff);
  const decelMinusOne = FLING_PHYSICS_CONFIG.decelerationRate - 1;
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
  overscrollDistancePx = OVER_SCROLL_DISTANCE_PX
) => {
  if (value > bounds.maxTranslate) {
    const overflow = value - bounds.maxTranslate;
    return Math.min(
      bounds.maxTranslate + overflow * OVERSCROLL_RESISTANCE,
      bounds.maxTranslate + overscrollDistancePx
    );
  }

  if (value < bounds.minTranslate) {
    const overflow = bounds.minTranslate - value;
    return Math.max(
      bounds.minTranslate - overflow * OVERSCROLL_RESISTANCE,
      bounds.minTranslate - overscrollDistancePx
    );
  }

  return value;
};
