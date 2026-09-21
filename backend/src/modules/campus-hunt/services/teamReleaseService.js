const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const { writeAudit } = require('./auditService');

function releaseError(message, code, status = 409, metadata = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, metadata);
  return error;
}

async function validateReleaseAssignments(team) {
  if (
    !team.startingPointId
    || !team.routeId
    || !team.scheduledStartAt
    || !team.clue1ChallengeId
    || !team.firstCheckpointId
  ) {
    throw releaseError('Team start assignment is incomplete', 'INCOMPLETE_START_ASSIGNMENT');
  }
  const [variant, checkpoint] = await Promise.all([
    CampusHuntChallenge.findOne({
      _id: team.clue1ChallengeId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 1,
      active: true,
    }),
    CampusHuntCheckpoint.findOne({
      _id: team.firstCheckpointId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      progressionKey: '1',
      active: true,
    }),
  ]);
  if (!variant || String(variant.firstCheckpointId) !== String(checkpoint?._id || '')) {
    throw releaseError('Clue 1 variant and first checkpoint assignment do not match', 'INVALID_CLUE1_ASSIGNMENT');
  }
  return { variant, checkpoint };
}

async function releaseTeamIfDue({
  team,
  now = new Date(),
  manual = false,
  actor = null,
  reason = '',
}) {
  const fresh = team?._id ? await CampusHuntTeam.findById(team._id) : null;
  if (!fresh) throw releaseError('Team not found', 'TEAM_NOT_FOUND', 404);
  if (['RELEASED', 'ACTIVE', 'COMPLETED'].includes(fresh.startStatus)) {
    return { team: fresh, released: false, alreadyReleased: true };
  }
  if (fresh.startStatus === 'CANCELLED') {
    throw releaseError('Team start is cancelled', 'START_CANCELLED');
  }
  const [round, startingPoint] = await Promise.all([
    CampusHuntRound.findById(fresh.roundId),
    CampusHuntStartingPoint.findById(fresh.startingPointId),
  ]);
  if (!round || String(round.eventId) !== String(fresh.eventId)) {
    throw releaseError('Round not found for team', 'ROUND_NOT_FOUND', 404);
  }
  if (!startingPoint || String(startingPoint.eventId) !== String(fresh.eventId)) {
    throw releaseError('Starting point not found for team', 'STARTING_POINT_NOT_FOUND', 404);
  }
  if (round.status !== 'live') {
    throw releaseError('Round has not started', 'ROUND_NOT_LIVE');
  }
  if (round.scheduleStatus !== 'locked' && !manual) {
    throw releaseError('Start schedule is not locked', 'SCHEDULE_NOT_LOCKED');
  }
  if (!manual && (round.releasesPaused || startingPoint.releasesPaused)) {
    throw releaseError('Team releases are paused', 'RELEASES_PAUSED', 409, {
      scheduledStartAt: fresh.scheduledStartAt,
    });
  }
  const scheduled = fresh.scheduledStartAt ? new Date(fresh.scheduledStartAt) : null;
  if (!manual && (!scheduled || scheduled.getTime() > now.getTime())) {
    throw releaseError('Your hunt has not started yet', 'START_NOT_DUE', 409, {
      scheduledStartAt: scheduled,
      serverTime: now,
    });
  }
  await validateReleaseAssignments(fresh);
  const released = await CampusHuntTeam.findOneAndUpdate(
    {
      _id: fresh._id,
      currentStage: 'WAITING',
      startStatus: { $in: ['WAITING', 'READY'] },
    },
    {
      $set: {
        currentStage: 'CLUE_1_ACTIVE',
        startStatus: 'RELEASED',
        actualStartAt: now,
        status: 'active',
      },
    },
    { new: true },
  );
  if (!released) {
    const current = await CampusHuntTeam.findById(fresh._id);
    return { team: current, released: false, alreadyReleased: true };
  }
  await writeAudit({
    eventId: released.eventId,
    actorType: actor?.actorType || (manual ? 'admin' : 'system'),
    actorId: actor?.actorId || 'release-service',
    actorLabel: actor?.actorLabel || (manual ? 'Admin manual release' : 'Scheduled release'),
    action: manual ? 'team_manually_released' : 'team_scheduled_released',
    targetType: 'team',
    targetId: released._id,
    reason,
    before: {
      currentStage: fresh.currentStage,
      startStatus: fresh.startStatus,
      scheduledStartAt: fresh.scheduledStartAt,
    },
    after: {
      currentStage: released.currentStage,
      startStatus: released.startStatus,
      actualStartAt: released.actualStartAt,
    },
  });
  try {
    const { publishTeamProgress } = require('./teamProgressBus');
    publishTeamProgress(released._id);
  } catch {
    /* SSE is best-effort — players still poll */
  }
  return { team: released, released: true, alreadyReleased: false };
}

async function releaseDueTeams({ eventId, roundId, now = new Date(), limit = 200 }) {
  const due = await CampusHuntTeam.find({
    eventId,
    roundId,
    currentStage: 'WAITING',
    startStatus: { $in: ['WAITING', 'READY'] },
    scheduledStartAt: { $lte: now },
  }).sort({ scheduledStartAt: 1 }).limit(limit);
  let released = 0;
  const errors = [];
  for (const team of due) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await releaseTeamIfDue({ team, now });
      if (result.released) released += 1;
    } catch (error) {
      if (!['RELEASES_PAUSED', 'ROUND_NOT_LIVE'].includes(error.code)) {
        errors.push({ teamId: String(team._id), code: error.code, message: error.message });
      }
    }
  }
  return { released, considered: due.length, errors };
}

module.exports = {
  releaseTeamIfDue,
  releaseDueTeams,
  validateReleaseAssignments,
  releaseError,
};
