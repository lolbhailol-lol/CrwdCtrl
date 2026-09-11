/**
 * Gate Campus Hunt routes when CAMPUS_HUNT_ENABLED is not true.
 */
function isCampusHuntEnabled() {
  return String(process.env.CAMPUS_HUNT_ENABLED || '').toLowerCase() === 'true';
}

function featureEnabled(req, res, next) {
  if (!isCampusHuntEnabled()) {
    return res.status(404).json({
      success: false,
      message: 'Campus Hunt is not enabled',
      code: 'CAMPUS_HUNT_DISABLED',
    });
  }
  return next();
}

/** Status endpoint may answer even when disabled. */
function attachFeatureFlag(req, res, next) {
  req.campusHuntEnabled = isCampusHuntEnabled();
  return next();
}

module.exports = {
  isCampusHuntEnabled,
  featureEnabled,
  attachFeatureFlag,
};
