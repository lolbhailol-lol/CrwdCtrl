const CampusHuntFinaleEntry = require('../../models/CampusHuntFinaleEntry');
const CampusHuntTeam = require('../../models/CampusHuntTeam');
const CampusHuntEvent = require('../../models/CampusHuntEvent');
const { getFinaleRound } = require('./finaleBootstrapService');
const { writeAudit } = require('../auditService');
const { assertCanStart, assertCanLock, assertCanFinalize } = require('../roundLifecycle');

async function buildFinaleLeaderboard(eventId, { includeAll = true } = {}) {
  const query = { eventId };
  if (!includeAll) {
    query.status = 'locked';
  }

  const entries = await CampusHuntFinaleEntry.find(query)
    .sort({ finaleScore: -1, updatedAt: 1 })
    .lean();

  const teamIds = entries.map((e) => e.teamId);
  const teams = await CampusHuntTeam.find({ _id: { $in: teamIds } })
    .select('teamCode teamName stats')
    .lean();
  const teamById = new Map(teams.map((t) => [String(t._id), t]));

  return entries.map((entry, index) => {
    const team = teamById.get(String(entry.teamId));
    return {
      rank: index + 1,
      teamId: String(entry.teamId),
      teamCode: team?.teamCode,
      teamName: team?.teamName,
      finaleScore: entry.finaleScore,
      finalScore: entry.finalScore ?? entry.finaleScore,
      status: entry.status,
      completedMissionIds: entry.completedMissionIds || [],
      promotionSource: entry.promotionSource,
      r1Rank: entry.r1Rank,
      r1Score: entry.r1Score,
    };
  });
}

async function startFinaleRound({ roundId, actor = {} }) {
  const CampusHuntRound = require('../../models/CampusHuntRound');
  const {
    releaseDueFinaleTeams,
  } = require('./finaleReleaseService');

  const round = await CampusHuntRound.findById(roundId);
  if (!round || round.name !== 'FINALE') {
    const err = new Error('Finale round not found');
    err.status = 404;
    throw err;
  }

  assertCanStart(round.status);

  if (round.scheduleStatus !== 'locked') {
    const err = new Error('Lock the Finale release schedule before starting.');
    err.status = 409;
    err.code = 'SCHEDULE_NOT_LOCKED';
    throw err;
  }

  const config = await require('../../models/CampusHuntFinaleMissionConfig')
    .findOne({ eventId: round.eventId });
  const durationMs = (config?.durationMinutes || 45) * 60 * 1000;
  const now = new Date();
  const scheduleStart = round.startsAt ? new Date(round.startsAt) : now;
  const timerAnchor = scheduleStart.getTime() > now.getTime() ? scheduleStart : now;

  round.status = 'live';
  if (!round.startsAt) round.startsAt = now;
  round.endsAt = new Date(timerAnchor.getTime() + durationMs);
  await round.save();

  // Keep entries eligible until their release wave — do not force all to playing.
  await CampusHuntEvent.findByIdAndUpdate(round.eventId, { status: 'finale' });

  await releaseDueFinaleTeams({
    eventId: round.eventId,
    actor: { actorType: 'system', actorId: 'start' },
  });

  const liveEntries = await CampusHuntFinaleEntry.find({ eventId: round.eventId })
    .select('teamId')
    .lean();
  const { publishManyTeamProgress } = require('../teamProgressBus');
  publishManyTeamProgress(liveEntries.map((row) => row.teamId));

  await writeAudit({
    eventId: round.eventId,
    ...actor,
    action: 'finale_round_started',
    targetType: 'round',
    targetId: round._id,
    after: { startsAt: round.startsAt, endsAt: round.endsAt },
  });

  return round;
}

async function lockFinaleRound({ roundId, actor = {} }) {
  const CampusHuntRound = require('../../models/CampusHuntRound');
  const round = await CampusHuntRound.findById(roundId);
  if (!round || round.name !== 'FINALE') {
    const err = new Error('Finale round not found');
    err.status = 404;
    throw err;
  }

  if (round.status === 'locked' || round.status === 'finalized') {
    return { round, alreadyLocked: true };
  }

  assertCanLock(round.status);

  round.status = 'locked';
  round.lockedAt = new Date();
  await round.save();

  const entries = await CampusHuntFinaleEntry.find({ eventId: round.eventId });
  for (const entry of entries) {
    entry.status = 'locked';
    entry.finalScore = entry.finaleScore;
    entry.lockedAt = new Date();
    entry.activeMissionId = null;
    entry.activeMissionRunId = null;
    // eslint-disable-next-line no-await-in-loop
    await entry.save();
  }

  await writeAudit({
    eventId: round.eventId,
    ...actor,
    action: 'finale_round_locked',
    targetType: 'round',
    targetId: round._id,
  });

  return { round, lockedCount: entries.length };
}

async function finalizeFinaleLeaderboard({ roundId, actor = {}, confirmLock = false }) {
  const CampusHuntRound = require('../../models/CampusHuntRound');
  const round = await CampusHuntRound.findById(roundId);
  if (!round || round.name !== 'FINALE') {
    const err = new Error('Finale round not found');
    err.status = 404;
    throw err;
  }

  if (round.status !== 'locked') {
    if (confirmLock) {
      await lockFinaleRound({ roundId, actor });
    } else {
      assertCanFinalize(round.status, { confirmLock });
    }
  }

  const fresh = await CampusHuntRound.findById(roundId);
  assertCanFinalize(fresh.status, { confirmLock: true });

  fresh.status = 'finalized';
  fresh.finalizedAt = new Date();
  await fresh.save();

  const leaderboard = await buildFinaleLeaderboard(round.eventId);

  await writeAudit({
    eventId: round.eventId,
    ...actor,
    action: 'finale_leaderboard_finalized',
    targetType: 'round',
    targetId: round._id,
    after: { winner: leaderboard[0]?.teamCode },
  });

  return { round: fresh, leaderboard };
}

module.exports = {
  buildFinaleLeaderboard,
  startFinaleRound,
  lockFinaleRound,
  finalizeFinaleLeaderboard,
};
