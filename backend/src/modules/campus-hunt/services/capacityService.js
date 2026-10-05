/**
 * Event / route team capacity helpers.
 */

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

function sortByTeamCode(teams) {
  return [...teams].sort((a, b) => (
    String(a.teamCode || '').localeCompare(String(b.teamCode || ''), undefined, { numeric: true })
  ));
}

/**
 * Delete teams beyond event.teamCapacity (keep first N by team code).
 * Also clears related progress / verifications / issues for removed teams.
 * Fixes leftover 40-team bootstraps after capacity is lowered to 20.
 *
 * @param {string|object} eventId
 * @param {number} [capacityOverride]
 * @returns {Promise<{ kept: number, removed: number, removedCodes: string[] }>}
 */
async function pruneExcessTeams(eventId, capacityOverride) {
  const CampusHuntEvent = require('../models/CampusHuntEvent');
  const CampusHuntTeam = require('../models/CampusHuntTeam');
  const CampusHuntTeamProgress = require('../models/CampusHuntTeamProgress');
  const CampusHuntCheckpointVerification = require('../models/CampusHuntCheckpointVerification');
  const CampusHuntIssueReport = require('../models/CampusHuntIssueReport');
  const CampusHuntOfflineInstall = require('../models/CampusHuntOfflineInstall');

  const event = await CampusHuntEvent.findById(eventId).select('teamCapacity').lean();
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }

  const capacity = Math.max(
    1,
    Number(capacityOverride != null ? capacityOverride : event.teamCapacity) || 20,
  );
  const teams = sortByTeamCode(
    await CampusHuntTeam.find({ eventId }).select('_id teamCode').lean(),
  );
  if (teams.length <= capacity) {
    return { kept: teams.length, removed: 0, removedCodes: [] };
  }

  const keep = teams.slice(0, capacity);
  const drop = teams.slice(capacity);
  const dropIds = drop.map((t) => t._id);
  const removedCodes = drop.map((t) => String(t.teamCode || '').toUpperCase()).filter(Boolean);

  await Promise.all([
    CampusHuntTeamProgress.deleteMany({ teamId: { $in: dropIds } }),
    CampusHuntCheckpointVerification.deleteMany({ teamId: { $in: dropIds } }),
    CampusHuntIssueReport.deleteMany({ teamId: { $in: dropIds } }),
    CampusHuntOfflineInstall.deleteMany({
      eventId,
      teamCode: { $in: removedCodes },
    }).catch(() => null),
    CampusHuntTeam.deleteMany({ _id: { $in: dropIds } }),
  ]);

  return {
    kept: keep.length,
    removed: drop.length,
    removedCodes,
  };
}

module.exports = {
  assertCapacityCounts,
  pruneExcessTeams,
  sortByTeamCode,
};
