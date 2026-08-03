export function isTestingCostControlMode() {
  return ['1', 'true', 'yes', 'testing', 'test'].includes(String(process.env.CIENNA_COST_CONTROL_MODE || '').toLowerCase());
}

export function photoPreloadLimit(defaultLimit) {
  return isTestingCostControlMode() ? 0 : defaultLimit;
}

export function photoThumbnailWidth(defaultWidth) {
  if (!isTestingCostControlMode()) return defaultWidth;
  return Math.min(defaultWidth, 240);
}

export function uploadPhotoTarget() {
  if (!isTestingCostControlMode()) {
    return {
      enabled: false,
      maxWidth: null,
      quality: null,
    };
  }

  return {
    enabled: true,
    maxWidth: 900,
    quality: 58,
  };
}
