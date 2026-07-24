// Android ViewConfiguration defaults in dp/s.
const MINIMUM_FLING_VELOCITY_DP_PER_SEC = 50;
const MAXIMUM_FLING_VELOCITY_DP_PER_SEC = 8000;

const getDevicePixelRatio = () => {
  if (typeof window === 'undefined') return 1;
  return Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
};

const dpPerSecToPxPerMs = (dpPerSec, devicePixelRatio = getDevicePixelRatio()) => {
  const pxPerSec = dpPerSec * devicePixelRatio;
  return pxPerSec / 1000;
};

export const getMinFlingVelocityPxMs = (devicePixelRatio = getDevicePixelRatio()) => {
  return dpPerSecToPxPerMs(MINIMUM_FLING_VELOCITY_DP_PER_SEC, devicePixelRatio);
};

export const getMaxFlingVelocityPxMs = (devicePixelRatio = getDevicePixelRatio()) => {
  return dpPerSecToPxPerMs(MAXIMUM_FLING_VELOCITY_DP_PER_SEC, devicePixelRatio);
};

export const isFlingThresholdMet = (velocityPxMs, thresholdPxMs) => {
  const effectiveThreshold = Number.isFinite(thresholdPxMs)
    ? thresholdPxMs
    : getMinFlingVelocityPxMs();
  return Math.abs(velocityPxMs) >= effectiveThreshold;
};

export const clampFlingVelocityPxMs = (velocityPxMs, maxVelocityPxMs) => {
  const effectiveMax = Number.isFinite(maxVelocityPxMs)
    ? maxVelocityPxMs
    : getMaxFlingVelocityPxMs();
  return Math.max(-effectiveMax, Math.min(effectiveMax, velocityPxMs));
};
