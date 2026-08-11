const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntRound = require('../models/CampusHuntRound');

async function findTeamForUser(eventId, userId) {
  return CampusHuntTeam.findOne({
    eventId,
    $or: [{ leaderUserId: userId }, { memberUserIds: userId }],
  });
}

/** Reject users already assigned to another team in this event. */
async function assertUsersAvailableForEvent(eventId, userIds, { excludeTeamId } = {}) {
  const ids = [...new Set((userIds || []).map(String).filter(Boolean))];
  if (!ids.length) return;
  const q = {
    eventId,
    $or: [
      { leaderUserId: { $in: ids } },
      { memberUserIds: { $in: ids } },
    ],
  };
  if (excludeTeamId) q._id = { $ne: excludeTeamId };
  const conflict = await CampusHuntTeam.findOne(q).select('teamCode leaderUserId memberUserIds');
  if (!conflict) return;
  const taken = new Set(conflict.allMemberIds());
  const hit = ids.find((id) => taken.has(id));
  const err = new Error(
    hit
      ? `User already assigned to team ${conflict.teamCode}`
      : `A user is already assigned to team ${conflict.teamCode}`,
  );
  err.status = 409;
  err.code = 'USER_ALREADY_ON_TEAM';
  throw err;
}

async function getMyTeamPayload(eventId, userId) {
  const team = await findTeamForUser(eventId, userId);
  if (!team) return null;
  return {
    team,
    isLeader: team.isLeader(userId),
  };
}

function publicTeamView(team, { isLeader = false, start = null, userId = null } = {}) {
  if (!team) return null;

  let myName = '';
  let mySlot = null;
  if (isLeader) {
    myName = team.leaderName
      || team.accessPack?.leader?.name
      || 'Leader';
    mySlot = 0;
  } else if (userId) {
    const idx = (team.memberUserIds || []).findIndex((id) => String(id) === String(userId));
    if (idx >= 0) {
      myName = team.memberNames?.[idx]
        || team.accessPack?.scanners?.[idx]?.name
        || `Player ${idx + 1}`;
      mySlot = idx + 1;
    } else {
      myName = 'Player';
    }
  }

  return {
    id: String(team._id),
    eventId: String(team.eventId),
    roundId: team.roundId ? String(team.roundId) : null,
    routeId: team.routeId ? String(team.routeId) : null,
    startingPointId: team.startingPointId ? String(team.startingPointId) : null,
    startingPoint: start?.startingPoint || null,
    scheduledStartAt: team.scheduledStartAt || null,
    actualStartAt: team.actualStartAt || null,
    startStatus: team.startStatus || 'WAITING',
    releasePaused: Boolean(start?.releasePaused),
    teamCode: team.teamCode,
    teamName: team.teamName,
    leaderName: team.leaderName
      || team.accessPack?.leader?.name
      || '',
    memberNames: Array.isArray(team.memberNames) ? team.memberNames : [],
    currentScore: team.currentScore,
    startingScore: team.startingScore ?? 100,
    finalScore: team.finalScore ?? null,
    status: team.status,
    currentStage: team.currentStage,
    competitionPhase: team.competitionPhase || 'round1',
    finaleEntryId: team.finaleEntryId ? String(team.finaleEntryId) : null,
    scoreLockedAt: team.scoreLockedAt,
    finishedAt: team.finishedAt,
    stats: {
      hintsUsed: team.stats?.hintsUsed || 0,
      failedAttempts: team.stats?.failedAttempts || 0,
      totalCompletionMs: team.stats?.totalCompletionMs ?? null,
    },
    lastCheckpointNumber: team.lastCheckpointNumber ?? null,
    isLeader,
    myRole: isLeader ? 'leader' : 'player',
    myName,
    mySlot,
    memberCount: 1 + (team.memberUserIds?.length || 0),
  };
}

async function ensureRoundLive(roundId) {
  const round = await CampusHuntRound.findById(roundId);
  if (!round) {
    const err = new Error('Round not found');
    err.status = 404;
    throw err;
  }
  return round;
}

async function ensureEvent(eventId) {
  const event = await CampusHuntEvent.findById(eventId);
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }
  return event;
}

/**
 * Conditional stage update — prevents races / illegal jumps.
 */
async function transitionTeamStage(teamId, fromStage, toStage, extraUpdate = {}) {
  const updated = await CampusHuntTeam.findOneAndUpdate(
    { _id: teamId, currentStage: fromStage },
    { $set: { currentStage: toStage, ...extraUpdate } },
    { new: true },
  );
  return updated;
}

module.exports = {
  findTeamForUser,
  assertUsersAvailableForEvent,
  getMyTeamPayload,
  publicTeamView,
  ensureRoundLive,
  ensureEvent,
  transitionTeamStage,
};
