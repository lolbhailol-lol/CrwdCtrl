function capacityError(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

function assertCapacityCounts({
  eventCount,
  eventCapacity,
  routeCount,
  routeCapacity,
  routeKey,
  pendingCount = 1,
}) {
  if (eventCount + pendingCount > eventCapacity) {
    throw capacityError(`Event capacity reached (${eventCapacity} teams)`);
  }
  if (
    routeCapacity != null
    && routeCount != null
    && routeCount + pendingCount > routeCapacity
  ) {
    throw capacityError(`Route ${routeKey} capacity reached (${routeCapacity} teams)`);
  }
}

module.exports = { assertCapacityCounts };
