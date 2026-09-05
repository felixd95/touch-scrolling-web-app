export const FLING_THRESHOLD_PX_MS = 1;
export const MAX_FLING_VELOCITY_PX_MS = 40;

export const getMinFlingVelocityPxMs = () => {
  return FLING_THRESHOLD_PX_MS;
};

export const getMaxFlingVelocityPxMs = () => {
  return MAX_FLING_VELOCITY_PX_MS;
};

export const isFlingThresholdMet = (velocityPxMs) => {
  return Math.abs(velocityPxMs) >= getMinFlingVelocityPxMs();
};

export const clampFlingVelocityPxMs = (velocityPxMs) => {
  if (!Number.isFinite(velocityPxMs)) {
    return 0;
  }

  const maxVelocityPxMs = getMaxFlingVelocityPxMs();
  return Math.max(-maxVelocityPxMs, Math.min(maxVelocityPxMs, velocityPxMs));
};
