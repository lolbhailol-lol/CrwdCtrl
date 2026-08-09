const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const { writeAudit } = require('./auditService');

function scheduleError(message, code = 'INVALID_START_SCHEDULE', status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function sortByCode(rows, key) {
  return [...rows].sort((a, b) => String(a[key]).localeCompare(
    String(b[key]),
    undefined,
    { numeric: true },
  ));
}

function buildDeterministicSchedule({
  teams,
  startingPoints,
  routes,
  variants,
  startsAt,
  releaseIntervalMinutes = 2,
  assignmentStrategy = 'route_balanced',
}) {
  const sortedTeams = sortByCode(teams, 'teamCode');
  const points = [...startingPoints]
    .filter((point) => point.active !== false)
    .sort((a, b) => (a.displayOrder - b.displayOrder)
      || String(a.code).localeCompare(String(b.code)));
  const sortedRoutes = sortByCode(routes.filter((route) => route.active !== false), 'routeKey');
  const base = new Date(startsAt);
  if (Number.isNaN(base.getTime())) throw scheduleError('A valid event start time is required');
  if (!points.length) throw scheduleError('Create at least one active starting point');
  if (!sortedRoutes.length) throw scheduleError('Create at least one active route');
  const totalCapacity = points.reduce((sum, point) => sum + Number(point.capacity || 0), 0);
  if (sortedTeams.length > totalCapacity) {
    throw scheduleError(
      `Starting point capacity is ${totalCapacity}, but ${sortedTeams.length} teams need assignment`,
      'START_CAPACITY_EXCEEDED',
    );
  }

  const pointSlots = [];
  for (const point of points) {
    for (let slot = 0; slot < point.capacity; slot += 1) pointSlots.push({ point, slot });
  }

  return sortedTeams.map((team, index) => {
    const { point, slot } = pointSlots[index];
    let route = sortedRoutes.find((item) => String(item._id) === String(team.routeId || ''));
    if (assignmentStrategy === 'route_balanced' || !route) {
      route = sortedRoutes[index % sortedRoutes.length];
    }
    const eligibleVariants = variants
      .filter((variant) => (
        variant.active !== false
        && Number(variant.challengeNumber) === 1
        && String(variant.routeId) === String(route._id)
        && (!variant.startingPointId || String(variant.startingPointId) === String(point._id))
        && variant.firstCheckpointId
      ))
      .sort((a, b) => String(a.variantKey).localeCompare(String(b.variantKey)));
    const variant = eligibleVariants.length
      ? eligibleVariants[slot % eligibleVariants.length]
      : null;
    return {
      teamId: String(team._id),
      teamCode: team.teamCode,
      startingPointId: String(point._id),
      startingPointCode: point.code,
      routeId: String(route._id),
      routeKey: route.routeKey,
      scheduledStartAt: new Date(base.getTime() + slot * releaseIntervalMinutes * 60 * 1000),
      clue1ChallengeId: variant ? String(variant._id) : null,
      clue1VariantKey: variant?.variantKey || null,
      firstCheckpointId: variant?.firstCheckpointId
        ? String(variant.firstCheckpointId)
        : null,
      complete: Boolean(variant?.firstCheckpointId),
    };
  });
}

async function previewSchedule({
  eventId,
  roundId,
  startsAt,
  releaseIntervalMinutes,
  assignmentStrategy,
}) {
  const [round, teams, startingPoints, routes, variants] = await Promise.all([
    CampusHuntRound.findOne({ _id: roundId, eventId }),
    CampusHuntTeam.find({ eventId }).select('_id teamCode routeId'),
    CampusHuntStartingPoint.find({ eventId, roundId, active: true }),
    CampusHuntRoute.find({ eventId, active: true }),
    CampusHuntChallenge.find({ eventId, roundId, challengeNumber: 1, active: true }),
  ]);
  if (!round) throw scheduleError('Round not found', 'ROUND_NOT_FOUND', 404);
  const interval = Number(releaseIntervalMinutes || round.releaseIntervalMinutes || 2);
  if (!Number.isInteger(interval) || interval < 1) {
    throw scheduleError('Release interval must be at least 1 minute', 'INVALID_RELEASE_INTERVAL', 400);
  }
  const strategy = assignmentStrategy || round.assignmentStrategy || 'route_balanced';
  if (!['sequential', 'route_balanced'].includes(strategy)) {
    throw scheduleError('Invalid assignment strategy', 'INVALID_ASSIGNMENT_STRATEGY', 400);
  }
  const assignments = buildDeterministicSchedule({
    teams,
    startingPoints,
    routes,
    variants,
    startsAt: startsAt || round.startsAt,
    releaseIntervalMinutes: interval,
    assignmentStrategy: strategy,
  });
  return { round, assignments, releaseIntervalMinutes: interval, assignmentStrategy: strategy };
}

async function generateSchedule(options) {
  const result = await previewSchedule(options);
  const { round, assignments } = result;
  if (round.status !== 'scheduled' && options.confirm !== true) {
    throw scheduleError('Regenerating a live/locked round requires confirm: true');
  }
  for (const assignment of assignments) {
    // eslint-disable-next-line no-await-in-loop
    const before = await CampusHuntTeam.findById(assignment.teamId)
      .select('startingPointId routeId scheduledStartAt clue1ChallengeId firstCheckpointId')
      .lean();
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntTeam.updateOne(
      { _id: assignment.teamId, eventId: options.eventId },
      {
        $set: {
          startingPointId: assignment.startingPointId,
          roundId: round._id,
          routeId: assignment.routeId,
          scheduledStartAt: assignment.scheduledStartAt,
          clue1ChallengeId: assignment.clue1ChallengeId,
          firstCheckpointId: assignment.firstCheckpointId,
          startStatus: 'WAITING',
          currentStage: 'WAITING',
        },
        $unset: { actualStartAt: 1 },
      },
    );
    // eslint-disable-next-line no-await-in-loop
    await writeAudit({
      eventId: options.eventId,
      ...options.actor,
      action: 'team_start_assignment_generated',
      targetType: 'team',
      targetId: assignment.teamId,
      reason: options.reason || '',
      before,
      after: {
        startingPointId: assignment.startingPointId,
        routeId: assignment.routeId,
        scheduledStartAt: assignment.scheduledStartAt,
        clue1ChallengeId: assignment.clue1ChallengeId,
        firstCheckpointId: assignment.firstCheckpointId,
      },
    });
  }
  round.startsAt = new Date(options.startsAt || round.startsAt);
  round.releaseIntervalMinutes = result.releaseIntervalMinutes;
  round.assignmentStrategy = result.assignmentStrategy;
  round.scheduleStatus = 'draft';
  round.scheduleLockedAt = undefined;
  await round.save();
  await writeAudit({
    eventId: options.eventId,
    ...options.actor,
    action: 'start_schedule_generated',
    targetType: 'round',
    targetId: round._id,
    reason: options.reason || '',
    after: {
      teams: assignments.length,
      startsAt: round.startsAt,
      releaseIntervalMinutes: result.releaseIntervalMinutes,
      assignmentStrategy: result.assignmentStrategy,
    },
  });
  return result;
}

async function lockSchedule({ eventId, roundId, actor, reason }) {
  const [round, teams] = await Promise.all([
    CampusHuntRound.findOne({ _id: roundId, eventId }),
    CampusHuntTeam.find({ eventId, roundId }),
  ]);
  if (!round) throw scheduleError('Round not found', 'ROUND_NOT_FOUND', 404);
  if (!teams.length) throw scheduleError('No teams assigned to this round');
  const incomplete = teams.filter((team) => (
    !team.startingPointId
    || !team.routeId
    || !team.scheduledStartAt
    || !team.clue1ChallengeId
    || !team.firstCheckpointId
  ));
  if (incomplete.length) {
    throw scheduleError(
      `${incomplete.length} teams have incomplete start assignments`,
      'INCOMPLETE_START_ASSIGNMENTS',
    );
  }
  const pointIds = [...new Set(teams.map((team) => String(team.startingPointId)))];
  const points = await CampusHuntStartingPoint.find({ _id: { $in: pointIds }, active: true });
  if (points.length !== pointIds.length) {
    throw scheduleError('One or more assigned starting points are inactive or missing');
  }
  for (const point of points) {
    const count = teams.filter((team) => String(team.startingPointId) === String(point._id)).length;
    if (count > point.capacity) {
      throw scheduleError(`${point.code} exceeds capacity ${point.capacity}`, 'START_CAPACITY_EXCEEDED');
    }
  }
  const [variants, checkpoints] = await Promise.all([
    CampusHuntChallenge.countDocuments({
      _id: { $in: teams.map((team) => team.clue1ChallengeId) },
      active: true,
      challengeNumber: 1,
    }),
    CampusHuntCheckpoint.countDocuments({
      _id: { $in: teams.map((team) => team.firstCheckpointId) },
      active: true,
      progressionKey: '1',
    }),
  ]);
  if (variants < new Set(teams.map((team) => String(team.clue1ChallengeId))).size) {
    throw scheduleError('One or more Clue 1 variants are inactive or invalid');
  }
  if (checkpoints < new Set(teams.map((team) => String(team.firstCheckpointId))).size) {
    throw scheduleError('One or more first checkpoints are inactive or invalid');
  }
  await CampusHuntTeam.updateMany(
    { eventId, roundId, startStatus: { $ne: 'CANCELLED' } },
    { $set: { startStatus: 'READY', currentStage: 'WAITING' } },
  );
  round.scheduleStatus = 'locked';
  round.scheduleLockedAt = new Date();
  await round.save();
  await writeAudit({
    eventId,
    ...actor,
    action: 'start_schedule_locked',
    targetType: 'round',
    targetId: round._id,
    reason: reason || '',
    after: { teams: teams.length, scheduleLockedAt: round.scheduleLockedAt },
  });
  return { round, teamsReady: teams.length };
}

module.exports = {
  buildDeterministicSchedule,
  previewSchedule,
  generateSchedule,
  lockSchedule,
  scheduleError,
};
