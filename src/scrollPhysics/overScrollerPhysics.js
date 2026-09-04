// Physical earth gravity in m/s^2. Used to approximate Android's physical model.
const ANDROID_GRAVITY_EARTH_FIXED = 9.80665;
// Fixed display density used in fling-scale physical coefficient.
const ANDROID_FIXED_PPI = 460;
// Android's look-and-feel tuning constant used in the physical coefficient C.
const ANDROID_PHYSICAL_COEFF_TUNING_FIXED = 0.84;
// Cubic Bezier control tension at the beginning of the spline curve.
const ANDROID_START_TENSION_FIXED = 0.5;
// Cubic Bezier control tension at the end of the spline curve.
const ANDROID_END_TENSION_FIXED = 1.0;
// Android default deceleration rate r = ln(0.78) / ln(0.9).
const ANDROID_DECELERATION_RATE_FIXED = Math.log(0.78) / Math.log(0.9);

export const FLING_PHYSICS_CONFIG = {
  // Dimensionless drag factor used by Android's fling equations.
  // Higher values increase braking and shorten fling distance.
  scrollFriction: 0.015,
  // Dimensionless deceleration rate r used in D(v0), T(v0).
  // Must stay > 1 to keep exponents well-defined.
  decelerationRate: ANDROID_DECELERATION_RATE_FIXED,
  // Android inflexion factor that shifts where the spline transitions
  // from fast initial movement to stronger deceleration.
  inflexion: 0.35,
};

export const FLING_PHYSICS_BOUNDS = {
  scrollFriction: {
    min: 0.005,
    max: 0.05,
  },
  decelerationRate: {
    min: 1.2,
    max: 4.0,
  },
  inflexion: {
    min: 0.15,
    max: 0.65,
  },
};

const getDecelerationRate = () => {
  const rate = Number(FLING_PHYSICS_CONFIG.decelerationRate);
  return Number.isFinite(rate) && rate > 1 ? rate : ANDROID_DECELERATION_RATE_FIXED;
};

// Precomputed Bezier control points derived from inflexion/tension.
// They are used to generate the normalized position/time spline table.
const ANDROID_P1 = ANDROID_START_TENSION_FIXED * FLING_PHYSICS_CONFIG.inflexion;
const ANDROID_P2 = 1.0 - ANDROID_END_TENSION_FIXED * (1.0 - FLING_PHYSICS_CONFIG.inflexion);

// Number of lookup samples for the spline table (0..100).
export const ANDROID_SPLINE_SAMPLES = 100;
// Maximum visual overscroll distance allowed beyond content bounds.
export const OVER_SCROLL_DISTANCE_PX = 120;
// Compression factor when dragging beyond bounds (rubber-band effect).
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
  void devicePixelRatio;
  return ANDROID_GRAVITY_EARTH_FIXED
    * 39.37
    * ANDROID_FIXED_PPI
    * ANDROID_PHYSICAL_COEFF_TUNING_FIXED;
};

export const getAndroidSplineDeceleration = (velocityPxPerSec, physicalCoeff) => {
  const friction = Number(FLING_PHYSICS_CONFIG.scrollFriction);
  const inflexion = Number(FLING_PHYSICS_CONFIG.inflexion);
  if (!(friction > 0) || !(inflexion > 0) || !(physicalCoeff > 0)) return Number.NEGATIVE_INFINITY;
  return Math.log(
    (inflexion * Math.abs(velocityPxPerSec))
      / (friction * physicalCoeff)
  );
};

export const getAndroidSplineFlingDistancePx = (velocityPxPerSec, physicalCoeff) => {
  if (!Number.isFinite(velocityPxPerSec) || velocityPxPerSec === 0) return 0;
  const effectiveCoeff = Number.isFinite(physicalCoeff)
    ? physicalCoeff
    : getAndroidPhysicalCoeff(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  const friction = Number(FLING_PHYSICS_CONFIG.scrollFriction);
  const inflexion = Number(FLING_PHYSICS_CONFIG.inflexion);
  const decelerationRate = getDecelerationRate();
  if (!(friction > 0) || !(inflexion > 0) || !(effectiveCoeff > 0) || !(decelerationRate > 1)) return 0;

  const ratio = (inflexion * Math.abs(velocityPxPerSec)) / (friction * effectiveCoeff);
  if (!(ratio > 0)) return 0;

  return friction * effectiveCoeff * Math.pow(ratio, decelerationRate / (decelerationRate - 1));
};

export const getAndroidSplineFlingDurationMs = (velocityPxPerSec, physicalCoeff) => {
  if (!Number.isFinite(velocityPxPerSec) || velocityPxPerSec === 0) return 0;
  const effectiveCoeff = Number.isFinite(physicalCoeff)
    ? physicalCoeff
    : getAndroidPhysicalCoeff(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  const friction = Number(FLING_PHYSICS_CONFIG.scrollFriction);
  const inflexion = Number(FLING_PHYSICS_CONFIG.inflexion);
  const decelerationRate = getDecelerationRate();
  if (!(friction > 0) || !(inflexion > 0) || !(effectiveCoeff > 0) || !(decelerationRate > 1)) return 0;

  const ratio = (inflexion * Math.abs(velocityPxPerSec)) / (friction * effectiveCoeff);
  if (!(ratio > 0)) return 0;

  return 1000 * Math.pow(ratio, 1 / (decelerationRate - 1));
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
