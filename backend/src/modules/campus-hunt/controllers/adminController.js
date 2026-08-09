const mongoose = require('mongoose');
const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntTeamProgress = require('../models/CampusHuntTeamProgress');
const CampusHuntCheckpointVerification = require('../models/CampusHuntCheckpointVerification');
const CampusHuntIssueReport = require('../models/CampusHuntIssueReport');
const CampusHuntAuditLog = require('../models/CampusHuntAuditLog');
const CampusHuntVolunteerAccess = require('../models/CampusHuntVolunteerAccess');
const {
  validateEventCreate,
  validateTeamCreate,
  validateStartingPoint,
  validateStartSchedule,
} = require('../validators/adminValidators');
const { buildLeaderboard } = require('../services/leaderboardService');
const { completeCheckpoint } = require('../services/checkpointService');
const { writeAudit } = require('../services/auditService');
const { resolvePolicy, resolveAwardPoints } = require('../services/compensationService');
const { applyManualPenalty, removeManualPenalty } = require('../services/scoringService');
const { DEFAULT_SCORING_CONFIG } = require('../constants');
const { encryptCredential, decryptCredential } = require('../utils/credentialCipher');
const {
  assertCanStart,
  assertCanLock,
  assertCanReopen,
  assertCanFinalize,
} = require('../services/roundLifecycle');
const { assertCapacityCounts } = require('../services/capacityService');
const {
  previewSchedule,
  generateSchedule,
  lockSchedule,
} = require('../services/startScheduleService');
const { releaseTeamIfDue, releaseDueTeams } = require('../services/teamReleaseService');

function adminActor(req) {
  return {
    actorType: 'admin',
    actorId: req.user?.email || 'admin',
    actorLabel: req.user?.email || 'admin',
  };
}

async function listEvents(req, res, next) {
  try {
    const events = await CampusHuntEvent.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: { events } });
  } catch (err) {
    return next(err);
  }
}

async function createEvent(req, res, next) {
  try {
    const payload = validateEventCreate(req.body);
    if (!payload.scoringConfig) {
      payload.scoringConfig = { ...DEFAULT_SCORING_CONFIG };
    }
    const event = await CampusHuntEvent.create(payload);
    const round = await CampusHuntRound.create({
      eventId: event._id,
      roundNumber: 1,
      name: 'THE_HUNT',
      status: 'scheduled',
      qualification: {
        topNDirectFinale: 8,
        nextRoundName: 'MAUT_KA_KUVA',
      },
    });
    await writeAudit({
      eventId: event._id,
      ...adminActor(req),
      action: 'event_created',
      targetType: 'event',
      targetId: event._id,
      after: payload,
    });
    return res.status(201).json({ success: true, data: { event, round } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Event slug already exists' });
    }
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

async function updateEvent(req, res, next) {
  try {
    const allowed = {};
    const fields = [
      'name',
      'college',
      'date',
      'status',
      'teamCapacity',
      'teamSize',
      'startingScore',
      'featureNotes',
      'scoringConfig',
      'publicLeaderboardLive',
    ];
    for (const key of fields) {
      if (req.body[key] !== undefined) allowed[key] = req.body[key];
    }
    if (allowed.publicLeaderboardLive !== undefined) {
      allowed.publicLeaderboardLive = allowed.publicLeaderboardLive === true;
    }
    const event = await CampusHuntEvent.findByIdAndUpdate(
      req.params.eventId,
      { $set: allowed },
      { new: true, runValidators: true },
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    await writeAudit({
      eventId: event._id,
      ...adminActor(req),
      action: 'event_updated',
      targetType: 'event',
      targetId: event._id,
      after: allowed,
      reason: req.body.reason || '',
    });
    return res.json({ success: true, data: { event } });
  } catch (err) {
    return next(err);
  }
}

async function deleteEvent(req, res, next) {
  try {
    const event = await CampusHuntEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventId = event._id;
    const teams = await CampusHuntTeam.find({ eventId }).select('_id').lean();
    const teamIds = teams.map((t) => t._id);

    await Promise.all([
      CampusHuntTeamProgress.deleteMany({ teamId: { $in: teamIds } }),
      CampusHuntCheckpointVerification.deleteMany({ eventId }),
      CampusHuntIssueReport.deleteMany({ eventId }),
      CampusHuntAuditLog.deleteMany({ eventId }),
      CampusHuntVolunteerAccess.deleteMany({ eventId }),
      CampusHuntChallenge.deleteMany({ eventId }),
      CampusHuntCheckpoint.deleteMany({ eventId }),
      CampusHuntStartingPoint.deleteMany({ eventId }),
      CampusHuntTeam.deleteMany({ eventId }),
      CampusHuntRoute.deleteMany({ eventId }),
      CampusHuntRound.deleteMany({ eventId }),
      CampusHuntEvent.deleteOne({ _id: eventId }),
    ]);

    return res.json({
      success: true,
      data: {
        deletedEventId: String(eventId),
        slug: event.slug,
        college: event.college,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function getEventOverview(req, res, next) {
  try {
    const { eventId } = req.params;
    const event = await CampusHuntEvent.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const [rounds, teams, issues, checkpoints, routes, challenges, volunteers] = await Promise.all([
      CampusHuntRound.find({ eventId }),
      CampusHuntTeam.find({ eventId })
        .select('status currentStage currentScore finishedAt routeId startingPointId scheduledStartAt clue1ChallengeId firstCheckpointId leaderUserId memberUserIds accessPack'),
      CampusHuntIssueReport.countDocuments({ eventId, status: 'open' }),
      CampusHuntCheckpoint.find({ eventId }).select('checkpointKey progressionKey active locationName routeId'),
      CampusHuntRoute.find({ eventId }).select('routeKey name teamSlots active'),
      CampusHuntChallenge.find({ eventId, active: true }).select('challengeNumber routeId'),
      CampusHuntVolunteerAccess.find({ eventId, enabled: true }).select('checkpointIds'),
    ]);

    const activeTeams = teams.filter((t) => t.status === 'active' || (t.currentStage !== 'WAITING' && t.currentStage !== 'SCORE_LOCKED')).length;
    const finishedTeams = teams.filter((t) => t.currentStage === 'SCORE_LOCKED').length;
    const routeReadiness = routes.map((route) => {
      const routeId = String(route._id);
      const assignedTeams = teams.filter((team) => String(team.routeId || '') === routeId).length;
      const challengeNumbers = new Set(
        challenges
          .filter((challenge) => String(challenge.routeId) === routeId)
          .map((challenge) => challenge.challengeNumber),
      );
      const checkpointKeys = new Set(
        checkpoints
          .filter((checkpoint) => String(checkpoint.routeId) === routeId && checkpoint.active)
          .map((checkpoint) => checkpoint.progressionKey || checkpoint.checkpointKey),
      );
      const placeholderLocations = checkpoints.filter((checkpoint) => (
        String(checkpoint.routeId) === routeId
        && /Route\s+[A-Z0-9]+\s+(Checkpoint|Finish Zone)/i.test(checkpoint.locationName || '')
      )).length;
      return {
        id: routeId,
        routeKey: route.routeKey,
        name: route.name,
        active: route.active,
        teamSlots: route.teamSlots,
        assignedTeams,
        challengesConfigured: challengeNumbers.size,
        checkpointsConfigured: checkpointKeys.size,
        placeholderLocations,
        ready: route.active
          && challengeNumbers.size >= 4
          && checkpointKeys.size >= 4
          && placeholderLocations === 0,
      };
    });
    const teamsReady = teams.filter((team) => (
      team.routeId
      && team.leaderUserId
      && team.memberUserIds?.length === 3
      && team.accessPack?.leader?.loginEmail
      && team.accessPack?.scanners?.length === 3
    )).length;
    const roundOne = rounds.find((round) => Number(round.roundNumber) === 1);
    const startAssignmentsReady = teams.filter((team) => (
      team.startingPointId
      && team.routeId
      && team.scheduledStartAt
      && team.clue1ChallengeId
      && team.firstCheckpointId
    )).length;
    const readiness = {
      ready: teams.length > 0
        && teamsReady === teams.length
        && startAssignmentsReady === teams.length
        && roundOne?.scheduleStatus === 'locked'
        && routeReadiness.some((route) => route.ready)
        && volunteers.length > 0,
      teamsReady,
      teamsTotal: teams.length,
      startAssignmentsReady,
      scheduleLocked: roundOne?.scheduleStatus === 'locked',
      unassignedTeams: teams.filter((team) => !team.routeId).length,
      routesReady: routeReadiness.filter((route) => route.ready).length,
      routesTotal: routeReadiness.length,
      volunteersConfigured: volunteers.length,
      routeReadiness,
    };

    return res.json({
      success: true,
      data: {
        event,
        rounds,
        counts: {
          teams: teams.length,
          activeTeams,
          finishedTeams,
          openIssues: issues,
        },
        checkpoints,
        readiness,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function createRound(req, res, next) {
  try {
    const { eventId } = req.params;
    const round = await CampusHuntRound.create({
      eventId,
      roundNumber: req.body.roundNumber ?? 1,
      name: req.body.name || 'THE_HUNT',
      status: req.body.status || 'scheduled',
      startsAt: req.body.startsAt,
      endsAt: req.body.endsAt,
      qualification: req.body.qualification,
    });
    await writeAudit({
      eventId,
      ...adminActor(req),
      action: 'round_created',
      targetType: 'round',
      targetId: round._id,
      after: round.toObject(),
    });
    return res.status(201).json({ success: true, data: { round } });
  } catch (err) {
    return next(err);
  }
}

async function updateRound(req, res, next) {
  try {
    const round = await CampusHuntRound.findById(req.params.roundId);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });
    const before = round.toObject();
    const scheduleFields = ['startsAt', 'releaseIntervalMinutes', 'assignmentStrategy'];
    const changesSchedule = scheduleFields.some((field) => req.body[field] != null);
    if (
      changesSchedule
      && (round.scheduleStatus === 'locked' || round.status === 'live')
      && req.body.confirm !== true
    ) {
      return res.status(409).json({
        success: false,
        message: 'Changing a locked/live round schedule requires confirm: true',
      });
    }
    for (const field of ['name', 'startsAt', 'endsAt', 'releaseIntervalMinutes', 'assignmentStrategy']) {
      if (req.body[field] != null) round[field] = req.body[field];
    }
    if (req.body.qualification != null) round.qualification = req.body.qualification;
    if (changesSchedule) {
      round.scheduleStatus = 'draft';
      round.scheduleLockedAt = undefined;
    }
    await round.save();
    await writeAudit({
      eventId: round.eventId,
      ...adminActor(req),
      action: 'round_updated',
      targetType: 'round',
      targetId: round._id,
      reason: req.body.reason || '',
      before,
      after: round.toObject(),
    });
    return res.json({ success: true, data: { round } });
  } catch (err) {
    return next(err);
  }
}

async function createRoute(req, res, next) {
  try {
    const route = await CampusHuntRoute.create({
      eventId: req.params.eventId,
      routeKey: String(req.body.routeKey || '').toUpperCase(),
      name: req.body.name,
      teamSlots: req.body.teamSlots ?? 10,
      active: req.body.active !== false,
    });
    return res.status(201).json({ success: true, data: { route } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Route already exists' });
    }
    return next(err);
  }
}

async function listRoutes(req, res, next) {
  try {
    const routes = await CampusHuntRoute.find({ eventId: req.params.eventId });
    return res.json({ success: true, data: { routes } });
  } catch (err) {
    return next(err);
  }
}

async function assertTeamCapacity(event, routeId, pendingCount = 1) {
  const eventCount = await CampusHuntTeam.countDocuments({ eventId: event._id });
  assertCapacityCounts({
    eventCount,
    eventCapacity: event.teamCapacity,
    pendingCount,
  });
  if (routeId) {
    const route = await CampusHuntRoute.findOne({ _id: routeId, eventId: event._id });
    if (!route || !route.active) {
      const err = new Error('Selected route is missing or inactive');
      err.status = 400;
      throw err;
    }
    const routeCount = await CampusHuntTeam.countDocuments({ eventId: event._id, routeId });
    assertCapacityCounts({
      eventCount,
      eventCapacity: event.teamCapacity,
      routeCount,
      routeCapacity: route.teamSlots,
      routeKey: route.routeKey,
      pendingCount,
    });
  }
}

async function updateRoute(req, res, next) {
  try {
    const route = await CampusHuntRoute.findById(req.params.routeId);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    if (req.body.routeKey != null) route.routeKey = String(req.body.routeKey).trim().toUpperCase();
    if (req.body.name != null) route.name = String(req.body.name).trim();
    if (req.body.teamSlots != null) route.teamSlots = Math.max(1, Number(req.body.teamSlots) || 1);
    if (req.body.active != null) route.active = Boolean(req.body.active);
    await route.save();
    await writeAudit({
      eventId: route.eventId,
      ...adminActor(req),
      action: 'route_updated',
      targetType: 'route',
      targetId: route._id,
      after: route.toObject(),
    });
    return res.json({ success: true, data: { route } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Route key already exists' });
    }
    return next(err);
  }
}

async function autoAssignRoutes(req, res, next) {
  try {
    const eventId = req.params.eventId;
    const [routes, teams] = await Promise.all([
      CampusHuntRoute.find({ eventId, active: true }).sort({ routeKey: 1 }),
      CampusHuntTeam.find({ eventId }).sort({ teamCode: 1 }),
    ]);
    if (!routes.length) {
      return res.status(409).json({ success: false, message: 'Create at least one active route first' });
    }
    const usage = new Map(routes.map((route) => [String(route._id), 0]));
    if (req.body.rebalance !== true) {
      for (const team of teams) {
        if (team.routeId && usage.has(String(team.routeId))) {
          usage.set(String(team.routeId), usage.get(String(team.routeId)) + 1);
        }
      }
    }
    let assigned = 0;
    for (const team of teams) {
      if (team.routeId && req.body.rebalance !== true) continue;
      const available = routes
        .filter((route) => usage.get(String(route._id)) < route.teamSlots)
        .sort((a, b) => usage.get(String(a._id)) - usage.get(String(b._id)));
      if (!available.length) break;
      const route = available[0];
      team.routeId = route._id;
      usage.set(String(route._id), usage.get(String(route._id)) + 1);
      // eslint-disable-next-line no-await-in-loop
      await team.save();
      assigned += 1;
    }
    await writeAudit({
      eventId,
      ...adminActor(req),
      action: 'routes_auto_assigned',
      targetType: 'event',
      targetId: eventId,
      after: { assigned, rebalance: req.body.rebalance === true },
    });
    return res.json({ success: true, data: { assigned } });
  } catch (err) {
    return next(err);
  }
}

async function listStartingPoints(req, res, next) {
  try {
    const points = await CampusHuntStartingPoint.find({ eventId: req.params.eventId })
      .sort({ displayOrder: 1, code: 1 });
    const usage = await CampusHuntTeam.aggregate([
      { $match: { eventId: new mongoose.Types.ObjectId(req.params.eventId) } },
      { $group: { _id: '$startingPointId', teams: { $sum: 1 } } },
    ]);
    const counts = new Map(usage.map((row) => [String(row._id), row.teams]));
    return res.json({
      success: true,
      data: {
        startingPoints: points.map((point) => ({
          ...point.toObject(),
          assignedTeams: counts.get(String(point._id)) || 0,
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function createStartingPoint(req, res, next) {
  try {
    const payload = validateStartingPoint(req.body);
    const round = await CampusHuntRound.findOne({
      _id: payload.roundId,
      eventId: req.params.eventId,
    });
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });
    const point = await CampusHuntStartingPoint.create({
      eventId: req.params.eventId,
      roundId: round._id,
      name: payload.name,
      code: payload.code,
      description: payload.description || '',
      capacity: payload.capacity || 10,
      displayOrder: payload.displayOrder || 0,
      active: payload.active !== false,
    });
    await writeAudit({
      eventId: point.eventId,
      ...adminActor(req),
      action: 'starting_point_created',
      targetType: 'starting_point',
      targetId: point._id,
      after: point.toObject(),
    });
    return res.status(201).json({ success: true, data: { startingPoint: point } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Starting point code already exists' });
    }
    return next(err);
  }
}

async function updateStartingPoint(req, res, next) {
  try {
    const payload = validateStartingPoint(req.body, { partial: true });
    const point = await CampusHuntStartingPoint.findById(req.params.startingPointId);
    if (!point) return res.status(404).json({ success: false, message: 'Starting point not found' });
    const before = point.toObject();
    for (const field of ['name', 'description', 'displayOrder', 'capacity', 'active']) {
      if (payload[field] != null) point[field] = payload[field];
    }
    if (payload.code != null) point.code = payload.code;
    const assigned = await CampusHuntTeam.countDocuments({ startingPointId: point._id });
    if (Number(point.capacity) < assigned) {
      return res.status(409).json({
        success: false,
        message: `Capacity cannot be below ${assigned} assigned teams`,
      });
    }
    await point.save();
    await writeAudit({
      eventId: point.eventId,
      ...adminActor(req),
      action: 'starting_point_updated',
      targetType: 'starting_point',
      targetId: point._id,
      reason: req.body.reason || '',
      before,
      after: point.toObject(),
    });
    return res.json({ success: true, data: { startingPoint: point } });
  } catch (err) {
    return next(err);
  }
}

async function deleteStartingPoint(req, res, next) {
  try {
    const point = await CampusHuntStartingPoint.findById(req.params.startingPointId);
    if (!point) return res.status(404).json({ success: false, message: 'Starting point not found' });
    const [teams, checkpoints, variants] = await Promise.all([
      CampusHuntTeam.countDocuments({ startingPointId: point._id }),
      CampusHuntCheckpoint.countDocuments({ startingPointId: point._id }),
      CampusHuntChallenge.countDocuments({ startingPointId: point._id }),
    ]);
    if (teams || checkpoints || variants) {
      point.active = false;
      await point.save();
      await writeAudit({
        eventId: point.eventId,
        ...adminActor(req),
        action: 'starting_point_deactivated',
        targetType: 'starting_point',
        targetId: point._id,
        reason: req.body.reason || 'Dependencies prevent deletion',
        after: { teams, checkpoints, variants },
      });
      return res.status(409).json({
        success: false,
        message: 'Starting point has dependencies and was deactivated instead',
        data: { startingPoint: point, dependencies: { teams, checkpoints, variants } },
      });
    }
    await point.deleteOne();
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    return next(err);
  }
}

function scheduleOptions(req) {
  const payload = validateStartSchedule(req.body);
  return {
    eventId: req.params.eventId,
    ...payload,
    actor: adminActor(req),
  };
}

async function previewStartSchedule(req, res, next) {
  try {
    const result = await previewSchedule(scheduleOptions(req));
    return res.json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function generateStartSchedule(req, res, next) {
  try {
    const result = await generateSchedule(scheduleOptions(req));
    return res.json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function lockStartSchedule(req, res, next) {
  try {
    const result = await lockSchedule({
      eventId: req.params.eventId,
      roundId: req.body.roundId,
      actor: adminActor(req),
      reason: req.body.reason,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function setRoundReleasesPaused(req, res, next) {
  try {
    const paused = req.path.endsWith('/pause');
    const round = await CampusHuntRound.findById(req.params.roundId);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });
    round.releasesPaused = paused;
    await round.save();
    await writeAudit({
      eventId: round.eventId,
      ...adminActor(req),
      action: paused ? 'round_releases_paused' : 'round_releases_resumed',
      targetType: 'round',
      targetId: round._id,
      reason: req.body.reason || '',
    });
    return res.json({ success: true, data: { round } });
  } catch (err) {
    return next(err);
  }
}

async function setStartingPointPaused(req, res, next) {
  try {
    const paused = req.path.endsWith('/pause');
    const point = await CampusHuntStartingPoint.findById(req.params.startingPointId);
    if (!point) return res.status(404).json({ success: false, message: 'Starting point not found' });
    point.releasesPaused = paused;
    await point.save();
    await writeAudit({
      eventId: point.eventId,
      ...adminActor(req),
      action: paused ? 'starting_point_paused' : 'starting_point_resumed',
      targetType: 'starting_point',
      targetId: point._id,
      reason: req.body.reason || '',
    });
    return res.json({ success: true, data: { startingPoint: point } });
  } catch (err) {
    return next(err);
  }
}

async function manualReleaseTeam(req, res, next) {
  try {
    if (!req.body.reason || String(req.body.reason).trim().length < 4) {
      return res.status(400).json({ success: false, message: 'A release reason is required' });
    }
    const team = await CampusHuntTeam.findById(req.params.teamId);
    const result = await releaseTeamIfDue({
      team,
      manual: true,
      actor: adminActor(req),
      reason: String(req.body.reason).trim(),
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function getStartDashboard(req, res, next) {
  try {
    const round = await CampusHuntRound.findOne({
      eventId: req.params.eventId,
      roundNumber: 1,
    });
    if (round?.status === 'live') {
      await releaseDueTeams({ eventId: round.eventId, roundId: round._id });
    }
    const [points, teams, checkpoints] = await Promise.all([
      CampusHuntStartingPoint.find({ eventId: req.params.eventId }).sort({ displayOrder: 1 }),
      CampusHuntTeam.find({ eventId: req.params.eventId })
        .populate('routeId', 'routeKey name')
        .populate('startingPointId', 'code name')
        .populate('clue1ChallengeId', 'variantKey')
        .sort({ scheduledStartAt: 1, teamCode: 1 }),
      CampusHuntCheckpointVerification.find({ eventId: req.params.eventId }),
    ]);
    const cp1Done = new Set(
      checkpoints
        .filter((item) => (
          ['complete', 'manual_reconciled'].includes(item.status)
          && String(item.checkpointKey) === '1'
        ))
        .map((item) => String(item.teamId)),
    );
    const rows = teams.map((team) => ({
      id: String(team._id),
      teamCode: team.teamCode,
      teamName: team.teamName,
      startingPoint: team.startingPointId,
      route: team.routeId,
      scheduledStartAt: team.scheduledStartAt,
      actualStartAt: team.actualStartAt,
      startStatus: team.startStatus,
      currentStage: team.currentStage,
      clue1VariantKey: team.clue1ChallengeId?.variantKey || null,
      clue1Complete: team.currentStage !== 'WAITING' && team.currentStage !== 'CLUE_1_ACTIVE',
      checkpoint1Complete: cp1Done.has(String(team._id)),
    }));
    const grouped = points.map((point) => {
      const assigned = rows.filter((team) => String(team.startingPoint?._id) === String(point._id));
      const count = (status) => assigned.filter((team) => team.startStatus === status).length;
      return {
        ...point.toObject(),
        teams: assigned.length,
        waiting: count('WAITING'),
        ready: count('READY'),
        released: count('RELEASED'),
        activeTeams: count('ACTIVE'),
        completed: count('COMPLETED'),
      };
    });
    return res.json({
      success: true,
      data: { round, startingPoints: grouped, teams: rows, serverTime: new Date() },
    });
  } catch (err) {
    return next(err);
  }
}

async function createTeam(req, res, next) {
  try {
    const event = await CampusHuntEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    await assertTeamCapacity(event, req.body.routeId);

    const { assertUsersAvailableForEvent } = require('../services/teamService');
    const { provisionTeamRoster } = require('../services/rosterProvisionService');

    let rosterPayload;
    let credentials = null;

    const memberNames = Array.isArray(req.body.memberNames)
      ? req.body.memberNames.map((n) => String(n || '').trim()).filter(Boolean)
      : [];

    // Preferred ops path: leader email + 3 member names → auto scanner logins
    if (memberNames.length === 3 && (req.body.leaderEmail || req.body.leaderUserId)) {
      const provisioned = await provisionTeamRoster({
        eventId: event._id,
        teamCode: req.body.teamCode,
        teamName: req.body.teamName,
        leaderEmail: req.body.leaderEmail,
        leaderName: req.body.leaderName || req.body.teamName,
        leaderPassword: req.body.leaderPassword,
        memberNames,
        scannerPassword: req.body.scannerPassword,
      });
      rosterPayload = validateTeamCreate({
        teamCode: req.body.teamCode,
        teamName: req.body.teamName,
        leaderUserId: provisioned.leaderUserId,
        memberUserIds: provisioned.memberUserIds,
        routeId: req.body.routeId,
        roundId: req.body.roundId,
      });
      rosterPayload.leaderName = provisioned.leaderName;
      rosterPayload.leaderContactEmail = provisioned.leaderContactEmail;
      rosterPayload.memberNames = provisioned.memberNames;
      rosterPayload.accessPack = provisioned.accessPack;
      credentials = provisioned.credentials;
    } else {
      rosterPayload = validateTeamCreate(req.body);
    }

    await assertUsersAvailableForEvent(event._id, [
      rosterPayload.leaderUserId,
      ...rosterPayload.memberUserIds,
    ]);

    let assignedRound = rosterPayload.roundId
      ? await CampusHuntRound.findById(rosterPayload.roundId).select('_id status')
      : null;
    if (!assignedRound) {
      assignedRound = await CampusHuntRound.findOne({
        eventId: event._id,
        roundNumber: 1,
      }).select('_id status');
    }

    const team = await CampusHuntTeam.create({
      eventId: event._id,
      ...rosterPayload,
      roundId: assignedRound?._id || rosterPayload.roundId,
      startingScore: event.startingScore,
      currentScore: event.startingScore,
      status: 'registered',
      currentStage: 'WAITING',
      startStatus: 'WAITING',
    });

    await writeAudit({
      eventId: event._id,
      ...adminActor(req),
      action: 'team_created',
      targetType: 'team',
      targetId: team._id,
      after: {
        teamCode: team.teamCode,
        leaderName: team.leaderName,
        memberNames: team.memberNames,
      },
    });

    const teamLoginPath = `/campus-hunt/${event.slug}/team/${team.teamCode}`;
    const teamResponse = team.toObject();
    delete teamResponse.accessPack;
    return res.status(201).json({
      success: true,
      data: {
        team: teamResponse,
        credentials,
        teamLoginPath,
        teamLoginUrl: teamLoginPath,
        allMemberNames: [
          team.leaderName,
          ...(team.memberNames || []),
        ].filter(Boolean),
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Team code already exists' });
    }
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

function buildTeamAccessView(team, event, { revealSecrets = false } = {}) {
  const teamLoginPath = `/campus-hunt/${event.slug}/team/${team.teamCode}`;
  const pack = team.accessPack || {};
  const leader = pack.leader || {};
  const scanners = Array.isArray(pack.scanners) ? pack.scanners : [];
  const sharedScannerPassword = decryptCredential(
    pack.encryptedSharedScannerPassword || pack.sharedScannerPassword || '',
  );
  return {
    ...team,
    allMemberNames: [team.leaderName, ...(team.memberNames || [])].filter(Boolean),
    teamLoginPath,
    teamLoginUrl: teamLoginPath,
    access: {
      teamLoginPath,
      leader: {
        name: leader.name || team.leaderName || '',
        loginEmail: leader.loginEmail || '',
        contactEmail: leader.contactEmail || team.leaderContactEmail || '',
        password: revealSecrets
          ? decryptCredential(leader.encryptedPassword || leader.password || '')
          : '',
        note: leader.note || '',
        role: 'leader',
        access: 'Full hunt — clues, answers, timer, scans',
        loginPath: `${teamLoginPath}?role=leader`,
      },
      scanners: scanners.map((s, idx) => ({
        name: s.name || team.memberNames?.[idx] || `Scanner ${idx + 1}`,
        loginEmail: s.loginEmail || '',
        password: revealSecrets
          ? (decryptCredential(s.encryptedPassword || s.password || '') || sharedScannerPassword)
          : '',
        role: 'scanner',
        access: 'Scanner only — checkpoint QR / paste when required',
        loginPath: `${teamLoginPath}?role=scanner&slot=${idx + 1}`,
      })),
      sharedScannerPassword: revealSecrets ? sharedScannerPassword : '',
    },
  };
}

async function revealTeamAccess(req, res, next) {
  try {
    const team = await CampusHuntTeam.findById(req.params.teamId)
      .select('+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword '
        + '+accessPack.encryptedSharedScannerPassword')
      .lean();
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    const event = await CampusHuntEvent.findById(team.eventId).select('slug name college');
    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'team_credentials_revealed',
      targetType: 'team',
      targetId: team._id,
      reason: req.body.reason || 'Admin reveal',
    });
    const view = buildTeamAccessView(team, event, { revealSecrets: true });
    return res.json({ success: true, data: { access: view.access } });
  } catch (err) {
    return next(err);
  }
}

async function listTeams(req, res, next) {
  try {
    const User = require('../../../model/usermodel');
    const event = await CampusHuntEvent.findById(req.params.eventId).select('slug name college');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const teams = await CampusHuntTeam.find({ eventId: req.params.eventId })
      .sort({ teamCode: 1 })
      .lean();
    const withAccess = [];
    for (const team of teams) {
      const view = buildTeamAccessView(team, event);
      if (!view.access.leader.loginEmail && team.leaderUserId) {
        // eslint-disable-next-line no-await-in-loop
        const leader = await User.findById(team.leaderUserId).select('name email').lean();
        view.access.leader.loginEmail = leader?.email || '';
        view.access.leader.name = view.access.leader.name || leader?.name || '';
        view.access.leader.note = 'Use the existing CrwdCtrl account password';
      }
      for (let idx = 0; idx < view.access.scanners.length; idx += 1) {
        if (!view.access.scanners[idx].loginEmail && team.memberUserIds?.[idx]) {
          // eslint-disable-next-line no-await-in-loop
          const member = await User.findById(team.memberUserIds[idx]).select('name email').lean();
          view.access.scanners[idx].loginEmail = member?.email || '';
          view.access.scanners[idx].name = view.access.scanners[idx].name || member?.name || '';
        }
      }
      withAccess.push(view);
    }
    return res.json({
      success: true,
      data: {
        event: {
          id: String(event._id),
          slug: event.slug,
          name: event.name,
          college: event.college,
        },
        teams: withAccess,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function getTeamAdmin(req, res, next) {
  try {
    const team = await CampusHuntTeam.findById(req.params.teamId).lean();
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    const event = await CampusHuntEvent.findById(team.eventId).select('slug name college');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    return res.json({
      success: true,
      data: { team: buildTeamAccessView(team, event) },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Resolve CrwdCtrl users by email for team assignment.
 * GET /admin/users/lookup?email=
 */
async function lookupUser(req, res, next) {
  try {
    const User = require('../../../model/usermodel');
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }
    const user = await User.findOne({ email }).select('_id name email');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({
      success: true,
      data: { user: { id: String(user._id), name: user.name, email: user.email } },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Bulk create teams.
 * Preferred CSV: teamCode,teamName,leaderEmail,name1,name2,name3,routeKey
 * Legacy: member emails still supported via memberEmails[].
 */
async function bulkCreateTeams(req, res, next) {
  try {
    const User = require('../../../model/usermodel');
    const event = await CampusHuntEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const rows = Array.isArray(req.body?.teams) ? req.body.teams : [];
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'teams array is required' });
    }

    const routes = await CampusHuntRoute.find({ eventId: event._id }).sort({ routeKey: 1 });
    const round = req.body.roundId
      ? await CampusHuntRound.findById(req.body.roundId)
      : await CampusHuntRound.findOne({ eventId: event._id, roundNumber: 1 });

    const { assertValidTeamRoster } = require('../utils/roster');
    const { assertUsersAvailableForEvent } = require('../services/teamService');
    const { provisionTeamRoster } = require('../services/rosterProvisionService');

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      try {
        const teamCode = String(row.teamCode || `CC${String(i + 1).padStart(3, '0')}`).toUpperCase();
        const teamName = row.teamName || `Team ${i + 1}`;
        let routeId = row.routeId;
        if (!routeId && routes.length) {
          routeId = routes[i % routes.length]._id;
        }
        await assertTeamCapacity(event, routeId);

        const memberNames = Array.isArray(row.memberNames)
          ? row.memberNames.map((n) => String(n || '').trim()).filter(Boolean)
          : [];

        let roster;
        let credentials = null;
        if (memberNames.length === 3 && row.leaderEmail) {
          const provisioned = await provisionTeamRoster({
            eventId: event._id,
            teamCode,
            teamName,
            leaderEmail: row.leaderEmail,
            leaderName: row.leaderName || teamName,
            memberNames,
            scannerPassword: row.scannerPassword,
          });
          roster = assertValidTeamRoster({
            leaderUserId: provisioned.leaderUserId,
            memberUserIds: provisioned.memberUserIds,
            teamSize: event.teamSize || 4,
          });
          credentials = provisioned.credentials;
          roster.leaderName = provisioned.leaderName;
          roster.memberNames = provisioned.memberNames;
          roster.accessPack = provisioned.accessPack;
        } else {
          let leaderUserId = row.leaderUserId;
          if (!leaderUserId && row.leaderEmail) {
            const u = await User.findOne({ email: String(row.leaderEmail).trim().toLowerCase() }).select('_id');
            if (!u) throw new Error(`Leader not found: ${row.leaderEmail}`);
            leaderUserId = u._id;
          }
          if (!leaderUserId) throw new Error('leaderEmail + 3 member names required');

          let memberUserIds = Array.isArray(row.memberUserIds) ? [...row.memberUserIds] : [];
          if (Array.isArray(row.memberEmails) && row.memberEmails.length) {
            memberUserIds = [];
            for (const email of row.memberEmails) {
              const u = await User.findOne({ email: String(email).trim().toLowerCase() }).select('_id');
              if (!u) throw new Error(`Member not found: ${email}`);
              memberUserIds.push(u._id);
            }
          }
          roster = assertValidTeamRoster({
            leaderUserId,
            memberUserIds,
            teamSize: event.teamSize || 4,
          });
        }

        await assertUsersAvailableForEvent(event._id, [
          roster.leaderUserId,
          ...roster.memberUserIds,
        ]);

        const team = await CampusHuntTeam.create({
          eventId: event._id,
          roundId: round?._id || row.roundId,
          routeId,
          teamCode,
          teamName,
          leaderUserId: roster.leaderUserId,
          memberUserIds: roster.memberUserIds,
          leaderName: roster.leaderName || row.leaderName || '',
          leaderContactEmail: roster.leaderContactEmail || row.leaderEmail || '',
          memberNames: roster.memberNames || memberNames,
          accessPack: roster.accessPack,
          startingScore: event.startingScore,
          currentScore: event.startingScore,
          status: 'registered',
          currentStage: 'WAITING',
          startStatus: 'WAITING',
        });
        const teamLoginPath = `/campus-hunt/${event.slug}/team/${team.teamCode}`;
        created.push({
          teamCode: team.teamCode,
          id: String(team._id),
          credentials,
          teamLoginPath,
          access: buildTeamAccessView(team.toObject(), event).access,
        });
      } catch (err) {
        errors.push({ index: i, teamCode: row.teamCode, message: err.message });
      }
    }

    await writeAudit({
      eventId: event._id,
      ...adminActor(req),
      action: 'teams_bulk_created',
      targetType: 'event',
      targetId: event._id,
      after: { created: created.length, errors: errors.length },
    });

    return res.status(201).json({
      success: true,
      data: { created, errors, createdCount: created.length, errorCount: errors.length },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateTeam(req, res, next) {
  try {
    const team = await CampusHuntTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const before = {
      teamName: team.teamName,
      leaderName: team.leaderName,
      memberNames: team.memberNames,
      routeId: team.routeId,
      status: team.status,
      startingPointId: team.startingPointId,
      scheduledStartAt: team.scheduledStartAt,
      clue1ChallengeId: team.clue1ChallengeId,
      firstCheckpointId: team.firstCheckpointId,
    };

    const changesStartAssignment = [
      'startingPointId',
      'routeId',
      'scheduledStartAt',
      'clue1ChallengeId',
      'firstCheckpointId',
    ].some((field) => req.body[field] != null);
    if (changesStartAssignment) {
      const assignmentRound = await CampusHuntRound.findById(team.roundId);
      if (
        assignmentRound
        && (assignmentRound.scheduleStatus === 'locked' || assignmentRound.status === 'live')
        && req.body.confirm !== true
      ) {
        return res.status(409).json({
          success: false,
          message: 'Changing a locked/live start assignment requires confirm: true',
          code: 'START_ASSIGNMENT_LOCKED',
        });
      }
      if (assignmentRound?.status === 'live' && !String(req.body.reason || '').trim()) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required for live schedule changes',
        });
      }
    }

    if (req.body.teamName != null) team.teamName = String(req.body.teamName).trim();
    if (req.body.leaderName != null) team.leaderName = String(req.body.leaderName).trim();
    if (req.body.leaderEmail != null) {
      team.leaderContactEmail = String(req.body.leaderEmail).trim().toLowerCase();
    }
    if (req.body.routeId != null) team.routeId = req.body.routeId || undefined;
    if (req.body.startingPointId != null) {
      team.startingPointId = req.body.startingPointId || undefined;
    }
    if (req.body.scheduledStartAt != null) {
      team.scheduledStartAt = req.body.scheduledStartAt
        ? new Date(req.body.scheduledStartAt)
        : undefined;
    }
    if (req.body.clue1ChallengeId != null) {
      team.clue1ChallengeId = req.body.clue1ChallengeId || undefined;
    }
    if (req.body.firstCheckpointId != null) {
      team.firstCheckpointId = req.body.firstCheckpointId || undefined;
    }
    if (req.body.status != null) team.status = req.body.status;

    if (Array.isArray(req.body.memberNames)) {
      const names = req.body.memberNames.map((n) => String(n || '').trim()).filter(Boolean);
      if (names.length !== 3) {
        return res.status(400).json({
          success: false,
          message: 'Provide exactly 3 member names',
        });
      }
      team.memberNames = names;
    }

    // Keep accessPack display names in sync
    if (!team.accessPack) team.accessPack = {};
    if (!team.accessPack.leader) team.accessPack.leader = {};
    if (team.leaderName) {
      team.accessPack.leader.name = team.leaderName;
    }
    if (team.memberNames?.length) {
      const scanners = Array.isArray(team.accessPack.scanners)
        ? [...team.accessPack.scanners]
        : [];
      team.memberNames.forEach((name, idx) => {
        if (!scanners[idx]) scanners[idx] = { name, loginEmail: '', password: '' };
        else scanners[idx].name = name;
      });
      team.accessPack.scanners = scanners.slice(0, 3);
    }

    // Optional: rotate shared scanner password
    if (req.body.scannerPassword) {
      const User = require('../../../model/usermodel');
      const { ensureScannerUser } = require('../services/rosterProvisionService');
      const password = String(req.body.scannerPassword).trim().toUpperCase();
      const event = await CampusHuntEvent.findById(team.eventId).select('_id');
      const names = team.memberNames?.length === 3
        ? team.memberNames
        : ['Scanner 1', 'Scanner 2', 'Scanner 3'];
      const scanners = [];
      for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const slot = await ensureScannerUser({
          eventId: event._id,
          teamCode: team.teamCode,
          slot: i + 1,
          displayName: names[i],
          password,
        });
        scanners.push({
          name: names[i],
          loginEmail: slot.loginEmail,
          encryptedPassword: encryptCredential(password),
        });
        if (!team.memberUserIds[i]) {
          team.memberUserIds[i] = slot.user._id;
        }
      }
      team.accessPack.scanners = scanners;
      team.accessPack.encryptedSharedScannerPassword = encryptCredential(password);
      team.accessPack.sharedScannerPassword = undefined;
    }

    // Optional: set a separate leader password. Saving the document runs the
    // User model password hashing hook; updateOne must not be used here.
    if (req.body.leaderPassword && team.leaderUserId) {
      const password = String(req.body.leaderPassword).trim();
      const { ensureLeaderUser } = require('../services/rosterProvisionService');
      const leader = await ensureLeaderUser({
        eventId: team.eventId,
        teamCode: team.teamCode,
        leaderEmail: team.leaderContactEmail,
        leaderName: team.leaderName,
        leaderPassword: password,
      });
      team.leaderUserId = leader.user._id;
      team.accessPack.leader.loginEmail = leader.loginEmail;
      team.accessPack.leader.contactEmail = leader.contactEmail || team.leaderContactEmail || '';
      team.accessPack.leader.encryptedPassword = encryptCredential(password);
      team.accessPack.leader.password = undefined;
      team.accessPack.leader.note = leader.note;
    }

    // Sync leader user display name
    if (team.leaderName && team.leaderUserId) {
      const User = require('../../../model/usermodel');
      await User.updateOne({ _id: team.leaderUserId }, { $set: { name: team.leaderName } });
      if (team.accessPack.leader) team.accessPack.leader.name = team.leaderName;
    }

    if (changesStartAssignment) {
      const [point, route, variant, checkpoint] = await Promise.all([
        team.startingPointId
          ? CampusHuntStartingPoint.findOne({ _id: team.startingPointId, eventId: team.eventId })
          : null,
        team.routeId
          ? CampusHuntRoute.findOne({ _id: team.routeId, eventId: team.eventId })
          : null,
        team.clue1ChallengeId
          ? CampusHuntChallenge.findOne({
            _id: team.clue1ChallengeId,
            eventId: team.eventId,
            challengeNumber: 1,
          })
          : null,
        team.firstCheckpointId
          ? CampusHuntCheckpoint.findOne({
            _id: team.firstCheckpointId,
            eventId: team.eventId,
            progressionKey: '1',
          })
          : null,
      ]);
      if (
        (team.startingPointId && !point)
        || (team.routeId && !route)
        || (team.clue1ChallengeId && !variant)
        || (team.firstCheckpointId && !checkpoint)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Start assignment references must belong to this event',
        });
      }
      if (
        variant
        && checkpoint
        && (
          String(variant.firstCheckpointId || '') !== String(checkpoint._id)
          || String(variant.routeId) !== String(team.routeId)
          || String(checkpoint.routeId) !== String(team.routeId)
        )
      ) {
        return res.status(400).json({
          success: false,
          message: 'Route, Clue 1 variant, and first checkpoint must match',
        });
      }
    }

    await team.save();

    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'team_updated',
      targetType: 'team',
      targetId: team._id,
      before,
      after: {
        teamName: team.teamName,
        leaderName: team.leaderName,
        memberNames: team.memberNames,
        routeId: team.routeId,
        status: team.status,
        leaderPasswordRotated: Boolean(req.body.leaderPassword),
        scannerPasswordRotated: Boolean(req.body.scannerPassword),
        startAssignmentChanged: changesStartAssignment,
        startingPointId: team.startingPointId,
        scheduledStartAt: team.scheduledStartAt,
        clue1ChallengeId: team.clue1ChallengeId,
        firstCheckpointId: team.firstCheckpointId,
      },
      reason: req.body.reason || '',
    });

    const event = await CampusHuntEvent.findById(team.eventId).select('slug name college');
    return res.json({
      success: true,
      data: { team: buildTeamAccessView(team.toObject(), event) },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

async function deleteTeam(req, res, next) {
  try {
    const team = await CampusHuntTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const teamId = team._id;
    const eventId = team.eventId;
    const snapshot = {
      teamCode: team.teamCode,
      teamName: team.teamName,
      leaderName: team.leaderName,
      memberNames: team.memberNames,
    };

    await Promise.all([
      CampusHuntTeamProgress.deleteMany({ teamId }),
      CampusHuntCheckpointVerification.deleteMany({ teamId }),
      CampusHuntIssueReport.deleteMany({ teamId }),
      CampusHuntTeam.deleteOne({ _id: teamId }),
    ]);

    await writeAudit({
      eventId,
      ...adminActor(req),
      action: 'team_deleted',
      targetType: 'team',
      targetId: teamId,
      before: snapshot,
      reason: req.body?.reason || 'Admin delete team',
    });

    return res.json({
      success: true,
      data: { deletedTeamId: String(teamId), teamCode: snapshot.teamCode },
    });
  } catch (err) {
    return next(err);
  }
}

async function upsertChallenge(req, res, next) {
  try {
    const {
      routeId,
      roundId,
      challengeNumber,
      type,
      prompt,
      memberPrompts,
      answer,
      acceptedAnswers,
      hintText,
      hintCost,
      maxAttempts,
      timerSeconds,
      basePoints,
      speedBonusBands,
      destinationInstruction,
      variantKey,
      startingPointId,
      firstCheckpointId,
      difficulty,
      active,
    } = req.body;

    if (!routeId || !roundId || !challengeNumber || !type) {
      return res.status(400).json({
        success: false,
        message: 'routeId, roundId, challengeNumber, and type are required',
      });
    }

    const normalizedVariantKey = Number(challengeNumber) === 1
      ? String(variantKey || '').trim().toUpperCase()
      : 'DEFAULT';
    if (Number(challengeNumber) === 1 && (!normalizedVariantKey || !firstCheckpointId)) {
      return res.status(400).json({
        success: false,
        message: 'Clue 1 requires variantKey and firstCheckpointId',
      });
    }
    if (Number(challengeNumber) === 1) {
      const checkpoint = await CampusHuntCheckpoint.findOne({
        _id: firstCheckpointId,
        eventId: req.params.eventId,
        roundId,
        routeId,
        progressionKey: '1',
        active: true,
      });
      if (!checkpoint) {
        return res.status(400).json({
          success: false,
          message: 'Clue 1 first checkpoint must be an active CP1 on the same round and route',
        });
      }
      if (
        startingPointId
        && checkpoint.startingPointId
        && String(startingPointId) !== String(checkpoint.startingPointId)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Clue 1 and first checkpoint starting point must match',
        });
      }
    }
    const challenge = await CampusHuntChallenge.findOneAndUpdate(
      {
        eventId: req.params.eventId,
        routeId,
        challengeNumber,
        variantKey: normalizedVariantKey,
      },
      {
        $set: {
          eventId: req.params.eventId,
          routeId,
          roundId,
          challengeNumber,
          type,
          prompt,
          memberPrompts,
          answer,
          acceptedAnswers,
          hintText,
          hintCost,
          maxAttempts,
          timerSeconds,
          basePoints,
          speedBonusBands,
          destinationInstruction,
          variantKey: normalizedVariantKey,
          startingPointId: startingPointId || undefined,
          firstCheckpointId: firstCheckpointId || undefined,
          difficulty: difficulty || 'medium',
          active: active !== false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await writeAudit({
      eventId: req.params.eventId,
      ...adminActor(req),
      action: 'challenge_upserted',
      targetType: 'challenge',
      targetId: challenge._id,
      after: { challengeNumber, routeId, type, variantKey: normalizedVariantKey, firstCheckpointId },
    });

    return res.json({ success: true, data: { challenge: challenge.toObject() } });
  } catch (err) {
    return next(err);
  }
}

async function listChallenges(req, res, next) {
  try {
    const challenges = await CampusHuntChallenge.find({ eventId: req.params.eventId })
      .select('+answer +acceptedAnswers +hintText')
      .sort({ routeId: 1, challengeNumber: 1 });
    return res.json({ success: true, data: { challenges } });
  } catch (err) {
    return next(err);
  }
}

async function upsertCheckpoint(req, res, next) {
  try {
    const {
      routeId,
      roundId,
      checkpointNumber,
      checkpointKey,
      locationName,
      publicInstruction,
      sequence,
      active,
      compensationPolicyKey,
      code,
      progressionKey,
      startingPointId,
      allowedTeamIds,
      capacityGuidance,
      concurrencyGuidance,
    } = req.body;

    if (!routeId || !roundId || !checkpointKey || !locationName || sequence == null) {
      return res.status(400).json({
        success: false,
        message: 'routeId, roundId, checkpointKey, locationName, sequence required',
      });
    }
    const normalizedCode = String(code || `CP-${String(routeId).slice(-4)}-${checkpointKey}`)
      .trim()
      .toUpperCase();
    if (startingPointId) {
      const point = await CampusHuntStartingPoint.findOne({
        _id: startingPointId,
        eventId: req.params.eventId,
        roundId,
      });
      if (!point) {
        return res.status(400).json({
          success: false,
          message: 'Starting point must belong to the same event and round',
        });
      }
    }
    if (Array.isArray(allowedTeamIds) && allowedTeamIds.length) {
      const allowedCount = await CampusHuntTeam.countDocuments({
        _id: { $in: allowedTeamIds },
        eventId: req.params.eventId,
        routeId,
      });
      if (allowedCount !== new Set(allowedTeamIds.map(String)).size) {
        return res.status(400).json({
          success: false,
          message: 'Allowed teams must belong to the same event and route',
        });
      }
    }

    const checkpoint = await CampusHuntCheckpoint.findOneAndUpdate(
      {
        eventId: req.params.eventId,
        code: normalizedCode,
      },
      {
        $set: {
          eventId: req.params.eventId,
          routeId,
          roundId,
          checkpointNumber: checkpointNumber ?? sequence,
          checkpointKey: String(checkpointKey).toUpperCase(),
          locationName,
          publicInstruction,
          sequence,
          active: active !== false,
          compensationPolicyKey: compensationPolicyKey || 'skip_and_continue',
          code: normalizedCode,
          progressionKey: String(progressionKey || checkpointKey).toUpperCase(),
          startingPointId: startingPointId || undefined,
          allowedTeamIds: Array.isArray(allowedTeamIds) ? allowedTeamIds : [],
          capacityGuidance: capacityGuidance || undefined,
          concurrencyGuidance: concurrencyGuidance || '',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return res.json({ success: true, data: { checkpoint } });
  } catch (err) {
    return next(err);
  }
}

async function listCheckpoints(req, res, next) {
  try {
    const checkpoints = await CampusHuntCheckpoint.find({ eventId: req.params.eventId })
      .sort({ routeId: 1, sequence: 1 });
    return res.json({ success: true, data: { checkpoints } });
  } catch (err) {
    return next(err);
  }
}

async function updateCheckpoint(req, res, next) {
  try {
    const checkpoint = await CampusHuntCheckpoint.findById(req.params.checkpointId);
    if (!checkpoint) return res.status(404).json({ success: false, message: 'Checkpoint not found' });
    if (req.body.locationName != null) {
      checkpoint.locationName = String(req.body.locationName).trim();
    }
    if (req.body.publicInstruction != null) {
      checkpoint.publicInstruction = String(req.body.publicInstruction).trim();
    }
    if (req.body.code != null) checkpoint.code = String(req.body.code).trim().toUpperCase();
    if (req.body.progressionKey != null) {
      checkpoint.progressionKey = String(req.body.progressionKey).toUpperCase();
    }
    if (req.body.startingPointId != null) {
      checkpoint.startingPointId = req.body.startingPointId || undefined;
    }
    if (req.body.allowedTeamIds != null) {
      checkpoint.allowedTeamIds = Array.isArray(req.body.allowedTeamIds)
        ? req.body.allowedTeamIds
        : [];
    }
    if (req.body.capacityGuidance != null) {
      checkpoint.capacityGuidance = Number(req.body.capacityGuidance) || undefined;
    }
    if (req.body.concurrencyGuidance != null) {
      checkpoint.concurrencyGuidance = String(req.body.concurrencyGuidance).trim();
    }
    if (req.body.active != null) checkpoint.active = Boolean(req.body.active);
    if (!checkpoint.locationName) {
      return res.status(400).json({ success: false, message: 'Location name is required' });
    }
    await checkpoint.save();
    await writeAudit({
      eventId: checkpoint.eventId,
      ...adminActor(req),
      action: 'checkpoint_updated',
      targetType: 'checkpoint',
      targetId: checkpoint._id,
      after: {
        locationName: checkpoint.locationName,
        publicInstruction: checkpoint.publicInstruction,
        code: checkpoint.code,
        progressionKey: checkpoint.progressionKey,
      },
    });
    return res.json({ success: true, data: { checkpoint } });
  } catch (err) {
    return next(err);
  }
}

/** Station QR payloads for printing posters (includes secret). */
async function listStationQr(req, res, next) {
  try {
    const {
      buildStationQrPayload,
      ensurePasteCode,
    } = require('../services/checkpointService');
    const checkpoints = await CampusHuntCheckpoint.find({ eventId: req.params.eventId })
      .select('+qrSecret +pasteCode')
      .sort({ routeId: 1, sequence: 1 });
    const stations = [];
    for (const c of checkpoints) {
      await ensurePasteCode(c);
      stations.push({
        checkpointId: String(c._id),
        routeId: String(c.routeId),
        checkpointKey: c.checkpointKey,
        locationName: c.locationName,
        pasteCode: c.pasteCode,
        /** Short code players can paste when camera fails */
        pasteHint: `CH-${c.pasteCode}`,
        payload: buildStationQrPayload(c),
      });
    }
    return res.json({ success: true, data: { stations } });
  } catch (err) {
    return next(err);
  }
}

async function createVolunteer(req, res, next) {
  try {
    const { code, password, label, checkpointIds } = req.body;
    if (!code || !password) {
      return res.status(400).json({ success: false, message: 'code and password required' });
    }
    const passwordHash = await CampusHuntVolunteerAccess.hashPassword(password);
    const volunteer = await CampusHuntVolunteerAccess.create({
      eventId: req.params.eventId,
      code: String(code).trim().toUpperCase(),
      passwordHash,
      label: label || 'Volunteer',
      checkpointIds: checkpointIds || [],
      enabled: true,
    });
    await writeAudit({
      eventId: req.params.eventId,
      ...adminActor(req),
      action: 'volunteer_created',
      targetType: 'volunteer_access',
      targetId: volunteer._id,
    });
    return res.status(201).json({
      success: true,
      data: {
        volunteer: {
          id: volunteer._id,
          code: volunteer.code,
          label: volunteer.label,
          checkpointIds: volunteer.checkpointIds,
        },
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Volunteer code exists' });
    }
    return next(err);
  }
}

async function listVolunteers(req, res, next) {
  try {
    const volunteers = await CampusHuntVolunteerAccess.find({ eventId: req.params.eventId });
    return res.json({ success: true, data: { volunteers } });
  } catch (err) {
    return next(err);
  }
}

async function liveTeams(req, res, next) {
  try {
    const teams = await CampusHuntTeam.find({ eventId: req.params.eventId })
      .sort({ currentScore: -1, teamCode: 1 });
    return res.json({ success: true, data: { teams } });
  } catch (err) {
    return next(err);
  }
}

async function challengeMonitor(req, res, next) {
  try {
    const { eventId } = req.params;
    const progress = await CampusHuntTeamProgress.aggregate([
      { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
      {
        $group: {
          _id: { challengeNumber: '$challengeNumber', state: '$state' },
          count: { $sum: 1 },
        },
      },
    ]);
    return res.json({ success: true, data: { progress } });
  } catch (err) {
    return next(err);
  }
}

async function checkpointMonitor(req, res, next) {
  try {
    const { eventId } = req.params;
    const [checkpoints, verifications, issues] = await Promise.all([
      CampusHuntCheckpoint.find({ eventId }),
      CampusHuntCheckpointVerification.aggregate([
        { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
        {
          $group: {
            _id: { checkpointId: '$checkpointId', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ]),
      CampusHuntIssueReport.find({ eventId, status: 'open' }).sort({ createdAt: -1 }).limit(50),
    ]);
    return res.json({
      success: true,
      data: { checkpoints, verifications, openIssues: issues },
    });
  } catch (err) {
    return next(err);
  }
}

async function getLeaderboardAdmin(req, res, next) {
  try {
    const rows = await buildLeaderboard(req.params.eventId);
    return res.json({ success: true, data: { leaderboard: rows } });
  } catch (err) {
    return next(err);
  }
}

async function setCheckpointActive(req, res, next) {
  try {
    const active = req.body.active === true || req.path.endsWith('/enable');
    const checkpoint = await CampusHuntCheckpoint.findById(req.params.checkpointId);
    if (!checkpoint) return res.status(404).json({ success: false, message: 'Checkpoint not found' });
    let compensatedTeams = 0;
    if (!active && req.body.compensate === true) {
      const teams = await CampusHuntTeam.find({
        eventId: checkpoint.eventId,
        routeId: checkpoint.routeId,
        currentStage: { $ne: 'SCORE_LOCKED' },
      });
      for (const team of teams) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await completeCheckpoint({
            team,
            checkpoint,
            volunteer: { ...adminActor(req), actorType: 'admin' },
            source: 'manual',
            notes: req.body.reason || 'Checkpoint disabled; admin compensation',
            forceMemberIds: team.allMemberIds(),
          });
          compensatedTeams += 1;
        } catch {
          // Teams not currently eligible for this checkpoint are intentionally skipped.
        }
      }
    }
    checkpoint.active = active;
    await checkpoint.save();
    await writeAudit({
      eventId: checkpoint.eventId,
      ...adminActor(req),
      action: active ? 'checkpoint_enabled' : 'checkpoint_disabled',
      targetType: 'checkpoint',
      targetId: checkpoint._id,
      reason: req.body.reason || '',
      after: { active, compensatedTeams },
    });
    return res.json({ success: true, data: { checkpoint, compensatedTeams } });
  } catch (err) {
    return next(err);
  }
}

async function rotateCheckpointQr(req, res, next) {
  try {
    const crypto = require('crypto');
    const checkpoint = await CampusHuntCheckpoint.findById(req.params.checkpointId)
      .select('+qrSecret +pasteCode');
    if (!checkpoint) return res.status(404).json({ success: false, message: 'Checkpoint not found' });
    if (req.body.confirm !== true) {
      return res.status(400).json({ success: false, message: 'QR rotation requires confirm: true' });
    }
    checkpoint.qrSecret = crypto.randomBytes(16).toString('hex');
    checkpoint.pasteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    await checkpoint.save();
    await writeAudit({
      eventId: checkpoint.eventId,
      ...adminActor(req),
      action: 'checkpoint_qr_rotated',
      targetType: 'checkpoint',
      targetId: checkpoint._id,
      reason: req.body.reason || 'Leaked or damaged station code',
    });
    return res.json({ success: true, data: { checkpointId: checkpoint._id } });
  } catch (err) {
    return next(err);
  }
}

async function voidChallenge(req, res, next) {
  try {
    const challenge = await CampusHuntChallenge.findById(req.params.challengeId).select('+answer');
    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });

    const policy = resolvePolicy(req.body.compensationPolicyKey || 'full_challenge_credit');
    const award = resolveAwardPoints(policy, challenge.basePoints);

    challenge.voided = true;
    challenge.voidedAt = new Date();
    await challenge.save();

    const teams = await CampusHuntTeam.find({
      eventId: challenge.eventId,
      routeId: challenge.routeId,
      currentStage: { $ne: 'SCORE_LOCKED' },
    });

    let affected = 0;
    for (const team of teams) {
      const progress = await CampusHuntTeamProgress.findOne({
        teamId: team._id,
        challengeId: challenge._id,
      });
      if (progress && ['COMPLETED', 'VOIDED'].includes(progress.state)) continue;

      await CampusHuntTeamProgress.findOneAndUpdate(
        { teamId: team._id, challengeId: challenge._id },
        {
          $set: {
            eventId: challenge.eventId,
            teamId: team._id,
            challengeId: challenge._id,
            challengeNumber: challenge.challengeNumber,
            state: 'VOIDED',
            awardedPoints: award,
            completedAt: new Date(),
            failureReason: 'VOIDED_BY_ADMIN',
          },
        },
        { upsert: true },
      );

      if (award > 0) {
        await CampusHuntTeam.updateOne(
          { _id: team._id },
          { $inc: { currentScore: award } },
        );
      }
      affected += 1;
    }

    await writeAudit({
      eventId: challenge.eventId,
      ...adminActor(req),
      action: 'challenge_voided',
      targetType: 'challenge',
      targetId: challenge._id,
      reason: req.body.reason || '',
      after: { policy: policy.key, award, affected },
    });

    return res.json({
      success: true,
      data: { affected, award, policy: policy.key },
    });
  } catch (err) {
    return next(err);
  }
}

async function manualVerifyCheckpoint(req, res, next) {
  try {
    const team = await CampusHuntTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    const checkpoint = await CampusHuntCheckpoint.findById(req.body.checkpointId);
    if (!checkpoint) return res.status(404).json({ success: false, message: 'Checkpoint not found' });
    if (
      String(team.eventId) !== String(checkpoint.eventId)
      || String(team.routeId || '') !== String(checkpoint.routeId || '')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Checkpoint must belong to the same event and route as the team',
      });
    }

    const memberIds = req.body.memberUserIds || team.allMemberIds();
    const result = await completeCheckpoint({
      team,
      checkpoint,
      volunteer: { ...adminActor(req), actorType: 'admin' },
      source: 'manual',
      notes: req.body.notes || '',
      forceMemberIds: memberIds,
    });

    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'manual_checkpoint_verify',
      targetType: 'team',
      targetId: team._id,
      reason: req.body.reason || '',
      after: result,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function transferLeader(req, res, next) {
  try {
    const team = await CampusHuntTeam.findById(req.params.teamId)
      .select('+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword');
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    const newLeaderId = req.body.newLeaderUserId;
    if (!newLeaderId || !team.includesUser(newLeaderId)) {
      return res.status(400).json({ success: false, message: 'newLeaderUserId must be a team member' });
    }
    if (String(newLeaderId) === String(team.leaderUserId)) {
      return res.json({ success: true, data: { team, alreadyLeader: true } });
    }
    if (!String(req.body.reason || '').trim()) {
      return res.status(400).json({ success: false, message: 'Leader transfer reason is required' });
    }

    const before = {
      leaderUserId: team.leaderUserId,
      memberUserIds: team.memberUserIds,
      leaderName: team.leaderName,
      memberNames: team.memberNames,
    };
    const memberIndex = team.memberUserIds.findIndex(
      (id) => String(id) === String(newLeaderId),
    );
    const oldLeaderId = team.leaderUserId;
    const oldLeaderName = team.leaderName;
    const newLeaderName = team.memberNames?.[memberIndex] || 'Team Leader';
    const oldLeaderAccess = team.accessPack?.leader?.toObject?.()
      || team.accessPack?.leader
      || {};
    const newLeaderAccess = team.accessPack?.scanners?.[memberIndex]?.toObject?.()
      || team.accessPack?.scanners?.[memberIndex]
      || {};
    team.leaderUserId = newLeaderId;
    team.leaderName = newLeaderName;
    team.memberUserIds[memberIndex] = oldLeaderId;
    team.memberNames[memberIndex] = oldLeaderName;
    team.accessPack.leader = {
      ...newLeaderAccess,
      name: newLeaderName,
      note: 'Promoted by Campus Hunt admin',
    };
    team.accessPack.scanners[memberIndex] = {
      ...oldLeaderAccess,
      name: oldLeaderName,
    };
    team.markModified('accessPack');
    await team.save();

    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'transfer_leader',
      targetType: 'team',
      targetId: team._id,
      reason: String(req.body.reason).trim(),
      before,
      after: {
        leaderUserId: team.leaderUserId,
        memberUserIds: team.memberUserIds,
        leaderName: team.leaderName,
        memberNames: team.memberNames,
      },
    });

    return res.json({ success: true, data: { team } });
  } catch (err) {
    return next(err);
  }
}

async function applyPenalty(req, res, next) {
  try {
    const team = await CampusHuntTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    if (team.currentStage === 'SCORE_LOCKED' && !req.body.force) {
      return res.status(409).json({ success: false, message: 'Score locked; pass force:true to override' });
    }
    const amount = Math.abs(Number(req.body.amount) || 0);
    if (!amount) {
      return res.status(400).json({ success: false, message: 'amount required' });
    }
    const before = team.currentScore;
    team.currentScore = applyManualPenalty(team.currentScore, amount);
    team.stats = team.stats || {};
    team.stats.manualPenalty = (team.stats.manualPenalty || 0) + amount;
    if (team.finalScore != null) team.finalScore = team.currentScore;
    await team.save();

    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'manual_penalty',
      targetType: 'team',
      targetId: team._id,
      reason: req.body.reason || '',
      before: { score: before },
      after: { score: team.currentScore, amount },
    });

    return res.json({ success: true, data: { team } });
  } catch (err) {
    return next(err);
  }
}

async function removePenalty(req, res, next) {
  try {
    const team = await CampusHuntTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    const amount = Math.abs(Number(req.body.amount) || team.stats?.manualPenalty || 0);
    if (!amount) {
      return res.status(400).json({ success: false, message: 'amount required' });
    }
    const before = team.currentScore;
    team.currentScore = removeManualPenalty(team.currentScore, amount);
    team.stats.manualPenalty = Math.max(0, (team.stats.manualPenalty || 0) - amount);
    if (team.finalScore != null) team.finalScore = team.currentScore;
    await team.save();

    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'remove_manual_penalty',
      targetType: 'team',
      targetId: team._id,
      reason: req.body.reason || '',
      before: { score: before },
      after: { score: team.currentScore, amount },
    });

    return res.json({ success: true, data: { team } });
  } catch (err) {
    return next(err);
  }
}

async function lockRoundTeams(round) {
  if (round.status === 'finalized') {
    const err = new Error('Finalized rounds cannot be locked again');
    err.status = 409;
    throw err;
  }
  if (round.status !== 'locked') {
    round.status = 'locked';
    round.lockedAt = new Date();
    await round.save();
  }
  const now = new Date();
  const teams = await CampusHuntTeam.find({
    eventId: round.eventId,
    roundId: round._id,
    currentStage: { $ne: 'SCORE_LOCKED' },
  });
  for (const team of teams) {
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntTeam.updateOne(
      { _id: team._id },
      {
        $set: {
          currentStage: 'SCORE_LOCKED',
          scoreLockedAt: now,
          finalScore: team.currentScore,
          status: team.status === 'disqualified' ? 'disqualified' : 'finished',
          startStatus: team.startStatus === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
        },
      },
    );
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntTeamProgress.updateMany(
      { teamId: team._id, state: 'ACTIVE' },
      {
        $set: {
          state: 'TIMED_OUT',
          failureReason: 'ROUND_LOCKED',
          awardedPoints: 0,
          completedAt: now,
        },
      },
    );
  }
  return teams.length;
}

async function lockRound(req, res, next) {
  try {
    const round = await CampusHuntRound.findById(req.params.roundId);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });
    assertCanLock(round.status);
    const teamsLocked = await lockRoundTeams(round);

    await writeAudit({
      eventId: round.eventId,
      ...adminActor(req),
      action: 'round_locked',
      targetType: 'round',
      targetId: round._id,
      reason: req.body.reason || '',
      after: { teamsLocked },
    });

    return res.json({ success: true, data: { round, teamsLocked } });
  } catch (err) {
    return next(err);
  }
}

async function reopenRound(req, res, next) {
  try {
    if (req.body.confirm !== true) {
      return res.status(400).json({
        success: false,
        message: 'Reopen requires confirm: true',
      });
    }
    const round = await CampusHuntRound.findById(req.params.roundId);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });
    assertCanReopen(round.status, req.body);

    const teams = await CampusHuntTeam.find({ eventId: round.eventId, roundId: round._id });
    const teamIds = teams.map((team) => team._id);
    await Promise.all([
      CampusHuntTeamProgress.deleteMany({ teamId: { $in: teamIds } }),
      CampusHuntCheckpointVerification.deleteMany({ teamId: { $in: teamIds } }),
    ]);
    round.status = 'scheduled';
    round.scheduleStatus = 'draft';
    round.scheduleLockedAt = undefined;
    round.releasesPaused = false;
    round.endsAt = undefined;
    round.lockedAt = undefined;
    await round.save();
    await CampusHuntTeam.updateMany(
      { _id: { $in: teamIds } },
      {
        $set: { currentStage: 'WAITING', status: 'registered', startStatus: 'WAITING' },
        $unset: {
          scoreLockedAt: 1,
          finalScore: 1,
          finishedAt: 1,
          lastCheckpointNumber: 1,
          actualStartAt: 1,
        },
      },
    );

    await writeAudit({
      eventId: round.eventId,
      ...adminActor(req),
      action: 'round_reopened',
      targetType: 'round',
      targetId: round._id,
      reason: req.body.reason || '',
      after: { teamsReset: teams.length, resetProgress: true, scheduleStatus: 'draft' },
    });

    return res.json({ success: true, data: { round, teamsReset: teams.length } });
  } catch (err) {
    return next(err);
  }
}

async function finalizeLeaderboard(req, res, next) {
  try {
    const round = await CampusHuntRound.findById(req.params.roundId);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });

    assertCanFinalize(round.status, req.body);
    let teamsLocked = 0;
    if (round.status !== 'locked') {
      teamsLocked = await lockRoundTeams(round);
    }
    round.status = 'finalized';
    round.finalizedAt = new Date();
    await round.save();

    const leaderboard = await buildLeaderboard(round.eventId, { includeUnfinished: true });

    await writeAudit({
      eventId: round.eventId,
      ...adminActor(req),
      action: 'leaderboard_finalized',
      targetType: 'round',
      targetId: round._id,
      reason: req.body.reason || '',
      after: { teamsLocked, top8: leaderboard.slice(0, 8).map((r) => r.teamCode) },
    });

    return res.json({ success: true, data: { round, leaderboard } });
  } catch (err) {
    return next(err);
  }
}

async function reconcileManual(req, res, next) {
  try {
    const { teamId, checkpointId, memberUserIds, notes } = req.body;
    const team = await CampusHuntTeam.findById(teamId);
    const checkpoint = await CampusHuntCheckpoint.findById(checkpointId);
    if (!team || !checkpoint) {
      return res.status(404).json({ success: false, message: 'Team or checkpoint not found' });
    }
    if (
      String(team.eventId) !== String(checkpoint.eventId)
      || String(team.routeId || '') !== String(checkpoint.routeId || '')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Checkpoint must belong to the same event and route as the team',
      });
    }

    const existing = await CampusHuntCheckpointVerification.findOne({ teamId, checkpointId });
    if (existing && (existing.status === 'complete' || existing.status === 'manual_reconciled')) {
      return res.json({
        success: true,
        data: { alreadyProcessed: true, status: existing.status },
      });
    }

    const result = await completeCheckpoint({
      team,
      checkpoint,
      volunteer: { ...adminActor(req), actorType: 'admin' },
      source: 'manual',
      notes: notes || 'Paper sheet reconciliation',
      forceMemberIds: memberUserIds || team.allMemberIds(),
    });

    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'manual_reconcile',
      targetType: 'verification',
      targetId: `${teamId}:${checkpointId}`,
      reason: req.body.reason || '',
      after: result,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function listIssues(req, res, next) {
  try {
    const issues = await CampusHuntIssueReport.find({ eventId: req.params.eventId })
      .sort({ createdAt: -1 })
      .limit(200);
    return res.json({ success: true, data: { issues } });
  } catch (err) {
    return next(err);
  }
}

async function updateIssue(req, res, next) {
  try {
    const status = String(req.body.status || '');
    if (!['open', 'acknowledged', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid issue status' });
    }
    const issue = await CampusHuntIssueReport.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    issue.status = status;
    if (status === 'resolved') {
      issue.resolvedAt = new Date();
      issue.resolvedBy = adminActor(req).actorId;
    } else {
      issue.resolvedAt = undefined;
      issue.resolvedBy = undefined;
    }
    await issue.save();
    await writeAudit({
      eventId: issue.eventId,
      ...adminActor(req),
      action: 'issue_status_updated',
      targetType: 'issue',
      targetId: issue._id,
      reason: req.body.reason || '',
      after: { status },
    });
    return res.json({ success: true, data: { issue } });
  } catch (err) {
    return next(err);
  }
}

async function listAudit(req, res, next) {
  try {
    const logs = await CampusHuntAuditLog.find({ eventId: req.params.eventId })
      .sort({ createdAt: -1 })
      .limit(200);
    return res.json({ success: true, data: { logs } });
  } catch (err) {
    return next(err);
  }
}

async function startRound(req, res, next) {
  try {
    const round = await CampusHuntRound.findById(req.params.roundId);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });
    assertCanStart(round.status);
    if (round.scheduleStatus !== 'locked') {
      return res.status(409).json({
        success: false,
        message: 'Lock the staggered start schedule before starting Round 1',
        code: 'SCHEDULE_NOT_LOCKED',
      });
    }
    if (
      req.body.startsAt
      && new Date(req.body.startsAt).getTime() !== new Date(round.startsAt).getTime()
    ) {
      return res.status(409).json({
        success: false,
        message: 'Regenerate and lock the schedule to change its start time',
        code: 'LOCKED_SCHEDULE_START_MISMATCH',
      });
    }

    const now = new Date();
    const durationMinutes = Number(req.body.durationMinutes) || 50;
    const activateWaitingOnly = req.body.activateWaitingOnly === true && round.status === 'live';
    round.status = 'live';
    round.releasesPaused = false;
    if (!activateWaitingOnly) {
      if (!round.startsAt) round.startsAt = now;
      round.endsAt = req.body.endsAt
        ? new Date(req.body.endsAt)
        : new Date(round.startsAt.getTime() + durationMinutes * 60 * 1000);
    }
    await round.save();

    await CampusHuntEvent.updateOne(
      { _id: round.eventId },
      { $set: { status: 'round_1' } },
    );

    const ready = await CampusHuntTeam.updateMany(
      {
        eventId: round.eventId,
        roundId: round._id,
        currentStage: 'WAITING',
        startStatus: { $in: ['WAITING', 'READY'] },
      },
      {
        $set: {
          startStatus: 'READY',
          status: 'registered',
        },
      },
    );
    const due = await releaseDueTeams({ eventId: round.eventId, roundId: round._id, now });

    await writeAudit({
      eventId: round.eventId,
      ...adminActor(req),
      action: 'round_started',
      targetType: 'round',
      targetId: round._id,
      after: {
        startsAt: round.startsAt,
        endsAt: round.endsAt,
        activateWaitingOnly,
        readyTeams: ready.modifiedCount,
        immediatelyReleasedTeams: due.released,
      },
    });

    return res.json({
      success: true,
      data: {
        round,
        readyTeams: ready.modifiedCount,
        immediatelyReleasedTeams: due.released,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventOverview,
  createRound,
  updateRound,
  startRound,
  createRoute,
  listRoutes,
  updateRoute,
  autoAssignRoutes,
  listStartingPoints,
  createStartingPoint,
  updateStartingPoint,
  deleteStartingPoint,
  previewStartSchedule,
  generateStartSchedule,
  lockStartSchedule,
  setRoundReleasesPaused,
  setStartingPointPaused,
  manualReleaseTeam,
  getStartDashboard,
  createTeam,
  listTeams,
  getTeamAdmin,
  revealTeamAccess,
  bulkCreateTeams,
  lookupUser,
  updateTeam,
  deleteTeam,
  upsertChallenge,
  listChallenges,
  upsertCheckpoint,
  listCheckpoints,
  updateCheckpoint,
  listStationQr,
  createVolunteer,
  listVolunteers,
  liveTeams,
  challengeMonitor,
  checkpointMonitor,
  getLeaderboardAdmin,
  setCheckpointActive,
  rotateCheckpointQr,
  voidChallenge,
  manualVerifyCheckpoint,
  transferLeader,
  applyPenalty,
  removePenalty,
  lockRound,
  reopenRound,
  finalizeLeaderboard,
  reconcileManual,
  listIssues,
  updateIssue,
  listAudit,
};
