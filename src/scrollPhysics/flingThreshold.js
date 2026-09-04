export const FLING_THRESHOLD_PX_MS = 1;

export const getMinFlingVelocityPxMs = () => {
  return FLING_THRESHOLD_PX_MS;
};

export const isFlingThresholdMet = (velocityPxMs, thresholdPxMs) => {
  const effectiveThreshold = Number.isFinite(thresholdPxMs)
    ? thresholdPxMs
    : getMinFlingVelocityPxMs();
  return Math.abs(velocityPxMs) >= effectiveThreshold;
};
