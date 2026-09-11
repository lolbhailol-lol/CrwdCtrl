function lifecycleError(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertCanStart(status) {
  if (status === 'finalized') throw lifecycleError('Finalized Round 1 cannot be restarted');
  if (status === 'locked') throw lifecycleError('Use the explicit reopen action for a locked round');
}

function assertCanLock(status) {
  if (status !== 'live') throw lifecycleError('Only a live round can be locked');
}

function assertCanReopen(status, { confirm, resetProgress } = {}) {
  if (status === 'finalized') throw lifecycleError('Finalized rounds cannot be reopened');
  if (status !== 'locked') throw lifecycleError('Only a locked round can be reopened');
  if (confirm !== true || resetProgress !== true) {
    throw lifecycleError('Reopen requires confirm and resetProgress', 400);
  }
}

function assertCanFinalize(status, { confirmLock } = {}) {
  if (status === 'finalized') throw lifecycleError('Round already finalized');
  if (status !== 'locked' && confirmLock !== true) {
    throw lifecycleError('Finalize requires a locked round or confirmLock: true');
  }
}

function buildActivationFilter(eventId, { teamIds = [], routeIds = [] } = {}) {
  const filter = {
    eventId,
    currentStage: 'WAITING',
    routeId: { $exists: true, $ne: null },
  };
  if (teamIds.length) filter._id = { $in: teamIds };
  if (routeIds.length) filter.routeId = { $in: routeIds };
  return filter;
}

module.exports = {
  assertCanStart,
  assertCanLock,
  assertCanReopen,
  assertCanFinalize,
  buildActivationFilter,
};
