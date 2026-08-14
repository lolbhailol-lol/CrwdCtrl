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
  resyncClue1TeamBindings,
} = require('../services/startScheduleService');
const { releaseTeamIfDue, releaseDueTeams } = require('../services/teamReleaseService');
const { bootstrapRound1Defaults } = require('../services/round1BootstrapService');
const { bulkSaveClue2 } = require('../services/clue2BulkSaveService');
const { bulkSaveClue4 } = require('../services/clue4BulkSaveService');
const { bulkSaveClue5 } = require('../services/clue5BulkSaveService');
const { bulkSaveClue1, bulkSaveClue3 } = require('../services/clueVariantBulkSaveService');
const { saveClueScoring } = require('../services/clueScoringPersistService');
const {
  resolveCampusStations,
  updateCampusStations,
} = require('../services/stationCatalogService');

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
    const { deriveCompetitionFormat } = require('../utils/competitionFormat');
    const format = deriveCompetitionFormat({
      teamCapacity: payload.teamCapacity,
      teamSize: payload.teamSize,
    });
    payload.teamCapacity = format.teamCapacity;
    payload.teamSize = format.teamSize;
    const event = await CampusHuntEvent.create(payload);
    const round = await CampusHuntRound.create({
      eventId: event._id,
      roundNumber: 1,
      name: 'THE_HUNT',
      status: 'scheduled',
      releaseIntervalMinutes: 5,
      assignmentStrategy: 'route_balanced',
      qualification: format.qualification,
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
      'finaleCapacity',
      'finaleDirectFromR1',
      'startCount',
      'stationCount',
      'campusStarts',
      'startingScore',
      'featureNotes',
      'scoringConfig',
      'publicLeaderboardLive',
      'publicLoginLive',
      'publicFinaleLeaderboardLive',
      'playerRoundAccess',
    ];
    for (const key of fields) {
      if (req.body[key] !== undefined) allowed[key] = req.body[key];
    }
    if (allowed.publicLeaderboardLive !== undefined) {
      allowed.publicLeaderboardLive = allowed.publicLeaderboardLive === true;
    }
    if (allowed.publicLoginLive !== undefined) {
      allowed.publicLoginLive = allowed.publicLoginLive === true;
    }
    if (allowed.publicFinaleLeaderboardLive !== undefined) {
      allowed.publicFinaleLeaderboardLive = allowed.publicFinaleLeaderboardLive === true;
    }
    if (allowed.playerRoundAccess && typeof allowed.playerRoundAccess === 'object') {
      const { normalizeAccess } = require('../services/playerRoundAccess');
      allowed.playerRoundAccess = normalizeAccess(allowed.playerRoundAccess);
    }
    let syncQualification = null;
    if (allowed.teamCapacity != null || allowed.teamSize != null
      || allowed.finaleCapacity != null || allowed.finaleDirectFromR1 != null
      || req.body.directFromR1 != null || req.body.finaleTeams != null) {
      const existing = await CampusHuntEvent.findById(req.params.eventId).lean();
      if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });
      const { deriveCompetitionFormat } = require('../utils/competitionFormat');
      const format = deriveCompetitionFormat({
        teamCapacity: allowed.teamCapacity != null ? allowed.teamCapacity : existing.teamCapacity,
        teamSize: allowed.teamSize != null ? allowed.teamSize : existing.teamSize,
        directFromR1: allowed.finaleDirectFromR1 != null
          ? allowed.finaleDirectFromR1
          : (req.body.directFromR1 != null ? req.body.directFromR1 : existing.finaleDirectFromR1),
        finaleTeams: allowed.finaleCapacity != null
          ? allowed.finaleCapacity
          : (req.body.finaleTeams != null ? req.body.finaleTeams : existing.finaleCapacity),
      });
      allowed.teamCapacity = format.teamCapacity;
      allowed.teamSize = format.teamSize;
      allowed.finaleCapacity = format.finaleTeams;
      allowed.finaleDirectFromR1 = format.directFromR1;
      syncQualification = format.qualification;
    }
    const event = await CampusHuntEvent.findByIdAndUpdate(
      req.params.eventId,
      { $set: allowed },
      { new: true, runValidators: true },
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (syncQualification) {
      await CampusHuntRound.findOneAndUpdate(
        { eventId: event._id, roundNumber: 1 },
        { $set: { qualification: syncQualification } },
      );
      await CampusHuntRound.findOneAndUpdate(
        { eventId: event._id, name: 'FINALE' },
        {
          $set: {
            'qualification.topNDirectFinale': syncQualification.topNDirectFinale,
            'qualification.finaleTeams': syncQualification.finaleTeams,
          },
        },
      );
    }
    await writeAudit({
      eventId: event._id,
      ...adminActor(req),
      action: 'event_updated',
      targetType: 'event',
      targetId: event._id,
      after: { ...allowed, qualification: syncQualification || undefined },
      reason: req.body.reason || '',
    });
    return res.json({
      success: true,
      data: { event, qualification: syncQualification || undefined },
    });
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

    const [rounds, teams, issues, checkpoints, routes, challenges, volunteers, startingPoints] = await Promise.all([
      CampusHuntRound.find({ eventId }),
      CampusHuntTeam.find({ eventId })
        .select('status currentStage currentScore finishedAt routeId startingPointId scheduledStartAt clue1ChallengeId firstCheckpointId clue2ChallengeId secondCheckpointId clue3ChallengeId thirdCheckpointId clue4ChallengeId fourthCheckpointId leaderUserId memberUserIds accessPack'),
      CampusHuntIssueReport.countDocuments({ eventId, status: 'open' }),
      CampusHuntCheckpoint.find({ eventId }).select('checkpointKey progressionKey active locationName routeId'),
      CampusHuntRoute.find({ eventId }).select('routeKey name teamSlots active'),
      CampusHuntChallenge.find({ eventId, active: true }).select('challengeNumber routeId'),
      CampusHuntVolunteerAccess.find({ eventId, enabled: true }).select('checkpointIds'),
      CampusHuntStartingPoint.find({ eventId, active: { $ne: false } }).select('_id code active'),
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
          && challengeNumbers.size >= 5
          && checkpointKeys.size >= 5
          && placeholderLocations === 0,
      };
    });
    const { isTeamRosterReady } = require('../utils/roster');
    const { resolveDemoScale } = require('../utils/demoScale');
    const { selectCompetitionTeams } = require('../services/startScheduleService');
    const scale = resolveDemoScale(event);
    const roundOne = rounds.find((round) => Number(round.roundNumber) === 1);
    const roundTeams = roundOne?._id
      ? teams.filter((team) => String(team.roundId) === String(roundOne._id))
      : teams;
    const competitionTeams = selectCompetitionTeams(roundTeams, event.teamCapacity);
    const leftoverTeams = Math.max(0, roundTeams.length - competitionTeams.length);
    const teamsReady = competitionTeams.filter((team) => (
      team.routeId && isTeamRosterReady(team, scale.teamSize)
    )).length;
    const startAssignmentsReady = competitionTeams.filter((team) => (
      team.startingPointId
      && team.routeId
      && team.scheduledStartAt
      && team.clue1ChallengeId
      && team.firstCheckpointId
      && team.clue2ChallengeId
      && team.secondCheckpointId
      && team.clue3ChallengeId
      && team.thirdCheckpointId
      && team.clue4ChallengeId
      && team.fourthCheckpointId
    )).length;
    // Player scan is primary — volunteers are optional ops help, not a go-live gate.
    const startingPointsReady = startingPoints.filter((p) => p.active !== false).length
      >= Math.max(1, Number(event.startCount) || 4);
    const readiness = {
      ready: competitionTeams.length > 0
        && teamsReady === competitionTeams.length
        && startAssignmentsReady === competitionTeams.length
        && roundOne?.scheduleStatus === 'locked'
        && routeReadiness.some((route) => route.ready)
        && startingPointsReady,
      teamsReady,
      teamsTotal: competitionTeams.length,
      teamsInDb: teams.length,
      leftoverTeams,
      rostersIncomplete: competitionTeams.length - teamsReady,
      startAssignmentsReady,
      scheduleLocked: roundOne?.scheduleStatus === 'locked',
      unassignedTeams: competitionTeams.filter((team) => !team.routeId).length,
      routesReady: routeReadiness.filter((route) => route.ready).length,
      routesTotal: routeReadiness.length,
      startingPointsReady,
      startingPointsCount: startingPoints.length,
      volunteersConfigured: volunteers.length,
      routeReadiness,
    };

    const {
      resolveCampusStationsCatalog,
      resolveCampusStarts,
      resolveStartCount,
      resolveStationCount,
    } = require('../services/stationCatalogService');

    return res.json({
      success: true,
      data: {
        event,
        campusStations: resolveCampusStations(event),
        campusStationsCatalog: resolveCampusStationsCatalog(event),
        campusStarts: resolveCampusStarts(event),
        startCount: resolveStartCount(event),
        stationCount: resolveStationCount(event),
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
    const roundNumber = req.body.roundNumber ?? 1;
    const existing = await CampusHuntRound.findOne({ eventId, roundNumber });
    if (existing) {
      return res.json({
        success: true,
        data: { round: existing, existing: true },
      });
    }
    const round = await CampusHuntRound.create({
      eventId,
      roundNumber,
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
    const eventId = req.params.eventId;
    let round = payload.roundId
      ? await CampusHuntRound.findOne({ _id: payload.roundId, eventId })
      : null;
    if (!round) {
      round = await CampusHuntRound.findOne({ eventId, roundNumber: 1 }).sort({ createdAt: 1 });
    }
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Round 1 not found — create Round 1 on Schedule first, or Bootstrap on Clues',
      });
    }

    const code = String(payload.code || '').trim().toUpperCase();
    const existing = await CampusHuntStartingPoint.findOne({ eventId, code });
    if (existing) {
      // Idempotent: treat as ready instead of 409 collision.
      existing.roundId = round._id;
      if (payload.name) existing.name = payload.name;
      if (payload.description != null) existing.description = payload.description;
      if (payload.capacity != null) existing.capacity = payload.capacity;
      existing.active = payload.active !== false;
      await existing.save();
      return res.json({
        success: true,
        data: { startingPoint: existing, alreadyExisted: true },
      });
    }

    const point = await CampusHuntStartingPoint.create({
      eventId,
      roundId: round._id,
      name: payload.name,
      code,
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
      // Race: another request created the same code — return existing.
      try {
        const code = String(req.body?.code || '').trim().toUpperCase();
        const existing = await CampusHuntStartingPoint.findOne({
          eventId: req.params.eventId,
          code,
        });
        if (existing) {
          return res.json({
            success: true,
            data: { startingPoint: existing, alreadyExisted: true },
          });
        }
      } catch (_) {
        /* fall through */
      }
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

/** After Clue 1 content save — bind all teams' dashboards to their variant + CP1. */
async function resyncClue1Bindings(req, res, next) {
  try {
    let roundId = req.body.roundId;
    if (!roundId) {
      const round = await CampusHuntRound.findOne({
        eventId: req.params.eventId,
        roundNumber: 1,
      }).select('_id');
      roundId = round?._id;
    }
    if (!roundId) {
      return res.status(404).json({ success: false, message: 'Round 1 not found' });
    }
    const result = await resyncClue1TeamBindings({
      eventId: req.params.eventId,
      roundId,
      actor: adminActor(req),
      reason: req.body.reason || 'Clue 1 saved — sync team dashboards',
    });
    return res.json({
      success: true,
      data: {
        updated: result.updated,
        incomplete: result.incomplete,
        teams: result.teams,
        postersBound: result.postersBound,
        clue4Fix: result.clue4Fix,
        assignments: result.assignments,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    return next(err);
  }
}

/** One-shot Clue 2 save: 40 codes + SECOND SCAN posters + team bind (avoids 429). */
async function bulkSaveClue2Variants(req, res, next) {
  try {
    let roundId = req.body.roundId;
    if (!roundId) {
      const round = await CampusHuntRound.findOne({
        eventId: req.params.eventId,
        roundNumber: 1,
      }).select('_id');
      roundId = round?._id;
    }
    if (!roundId) {
      return res.status(404).json({ success: false, message: 'Round 1 not found' });
    }
    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
    if (!variants.length) {
      return res.status(400).json({
        success: false,
        message: 'variants array required (40 team codes)',
      });
    }
    const data = await bulkSaveClue2({
      eventId: req.params.eventId,
      roundId,
      actor: adminActor(req),
      prompt: req.body.prompt,
      scoring: req.body.scoring || {},
      variants,
    });
    if (data.saved === 0 && data.errors?.length) {
      return res.status(400).json({
        success: false,
        message: data.errors[0]?.message || 'Clue 2 save failed',
        data,
      });
    }
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function bulkSaveClue1Variants(req, res, next) {
  try {
    let roundId = req.body.roundId;
    if (!roundId) {
      const round = await CampusHuntRound.findOne({
        eventId: req.params.eventId,
        roundNumber: 1,
      }).select('_id');
      roundId = round?._id;
    }
    if (!roundId) {
      return res.status(404).json({ success: false, message: 'Round 1 not found' });
    }
    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
    if (!variants.length) {
      return res.status(400).json({
        success: false,
        message: 'variants array required',
      });
    }
    const data = await bulkSaveClue1({
      eventId: req.params.eventId,
      roundId,
      actor: adminActor(req),
      scoring: req.body.scoring || {},
      variants,
    });
    if (data.saved === 0 && data.errors?.length) {
      return res.status(400).json({
        success: false,
        message: data.errors[0]?.message || 'Clue 1 save failed',
        data,
      });
    }
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function bulkSaveClue3Variants(req, res, next) {
  try {
    let roundId = req.body.roundId;
    if (!roundId) {
      const round = await CampusHuntRound.findOne({
        eventId: req.params.eventId,
        roundNumber: 1,
      }).select('_id');
      roundId = round?._id;
    }
    if (!roundId) {
      return res.status(404).json({ success: false, message: 'Round 1 not found' });
    }
    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
    if (!variants.length) {
      return res.status(400).json({
        success: false,
        message: 'variants array required',
      });
    }
    const data = await bulkSaveClue3({
      eventId: req.params.eventId,
      roundId,
      actor: adminActor(req),
      scoring: req.body.scoring || {},
      variants,
    });
    if (data.saved === 0 && data.errors?.length) {
      return res.status(400).json({
        success: false,
        message: data.errors[0]?.message || 'Clue 3 save failed',
        data,
      });
    }
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

/** One-shot Clue 4 save: all prop codes + purple QR bind + team resync. */
async function bulkSaveClue4Variants(req, res, next) {
  try {
    let roundId = req.body.roundId;
    if (!roundId) {
      const round = await CampusHuntRound.findOne({
        eventId: req.params.eventId,
        roundNumber: 1,
      }).select('_id');
      roundId = round?._id;
    }
    if (!roundId) {
      return res.status(404).json({ success: false, message: 'Round 1 not found' });
    }
    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
    if (!variants.length) {
      return res.status(400).json({
        success: false,
        message: 'variants array required (prop codes per team)',
      });
    }
    const data = await bulkSaveClue4({
      eventId: req.params.eventId,
      roundId,
      actor: adminActor(req),
      prompt: req.body.prompt,
      scoring: req.body.scoring || {},
      variants,
    });
    if (data.saved === 0 && data.errors?.length) {
      return res.status(400).json({
        success: false,
        message: data.errors[0]?.message || 'Clue 4 save failed',
        data,
      });
    }
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

/** One-shot Clue 5 / Final save: all start routes in one request. */
async function bulkSaveClue5Variants(req, res, next) {
  try {
    let roundId = req.body.roundId;
    if (!roundId) {
      const round = await CampusHuntRound.findOne({
        eventId: req.params.eventId,
        roundNumber: 1,
      }).select('_id');
      roundId = round?._id;
    }
    if (!roundId) {
      return res.status(404).json({ success: false, message: 'Round 1 not found' });
    }
    const routes = Array.isArray(req.body.routes) ? req.body.routes : [];
    if (!routes.length) {
      return res.status(400).json({
        success: false,
        message: 'routes array required (one Final per start path)',
      });
    }
    const data = await bulkSaveClue5({
      eventId: req.params.eventId,
      roundId,
      actor: adminActor(req),
      scoring: req.body.scoring || {},
      routes,
    });
    if (data.saved === 0 && data.errors?.length) {
      return res.status(400).json({
        success: false,
        message: data.errors[0]?.message || 'Clue 5 save failed',
        data,
      });
    }
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

/** Save timer / hint / attempt defaults for a clue and sync to challenge docs. */
async function saveClueScoringSettings(req, res, next) {
  try {
    const clueNumber = Number(req.params.clueNumber);
    if (!Number.isInteger(clueNumber) || clueNumber < 1 || clueNumber > 5) {
      return res.status(400).json({ success: false, message: 'Invalid clue number' });
    }
    let roundId = req.body.roundId;
    if (!roundId) {
      const round = await CampusHuntRound.findOne({
        eventId: req.params.eventId,
        roundNumber: 1,
      }).select('_id');
      roundId = round?._id;
    }
    const data = await saveClueScoring({
      eventId: req.params.eventId,
      roundId,
      clueNumber,
      scoring: req.body.scoring || req.body,
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
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

/** After Final (Clue 5): organizer marks team reached at their start → score locked. */
async function markTeamStartReached(req, res, next) {
  try {
    const { markTeamReachedAtStart } = require('../services/finishService');
    const result = await markTeamReachedAtStart({
      teamId: req.params.teamId,
      actor: adminActor(req),
      reason: req.body.reason || '',
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
        .filter((item) => {
          if (!['complete', 'manual_reconciled'].includes(item.status)) return false;
          const key = String(item.checkpointKey || item.progressionKey || '');
          // Wave posters store 1-T1 etc.; progression-normalized keys are just "1".
          return key === '1' || /^1-/i.test(key);
        })
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
      const returning = assigned.filter((team) => (
        ['CLUE_5_COMPLETED', 'CLUE_5_FAILED'].includes(team.currentStage)
      )).length;
      const finishLocked = assigned.filter((team) => (
        ['SCORE_LOCKED', 'FINISH_COMPLETED'].includes(team.currentStage)
      )).length;
      return {
        ...point.toObject(),
        teams: assigned.length,
        waiting: count('WAITING'),
        ready: count('READY'),
        released: count('RELEASED'),
        activeTeams: count('ACTIVE'),
        completed: count('COMPLETED'),
        returningAtStart: returning,
        finishLocked,
        counts: {
          waiting: count('WAITING'),
          ready: count('READY'),
          released: count('RELEASED'),
          active: count('ACTIVE'),
          completed: count('COMPLETED'),
          returningAtStart: returning,
          finishLocked,
        },
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
    const requiredMembers = Math.max(1, (Number(event.teamSize) || 4) - 1);

    // Preferred ops path: leader email + member names → auto scanner logins
    if (memberNames.length === requiredMembers && (req.body.leaderEmail || req.body.leaderUserId)) {
      const sharedPass = String(
        req.body.teamPassword || req.body.leaderPassword || req.body.scannerPassword || '',
      ).trim();
      const provisioned = await provisionTeamRoster({
        eventId: event._id,
        teamCode: req.body.teamCode,
        teamName: req.body.teamName,
        leaderEmail: req.body.leaderEmail,
        leaderName: req.body.leaderName || req.body.teamName,
        leaderPassword: sharedPass || req.body.leaderPassword,
        memberNames,
        scannerPassword: sharedPass || req.body.scannerPassword,
        teamSize: event.teamSize || 4,
      });
      rosterPayload = validateTeamCreate({
        teamCode: req.body.teamCode,
        teamName: req.body.teamName,
        leaderUserId: provisioned.leaderUserId,
        memberUserIds: provisioned.memberUserIds,
        routeId: req.body.routeId,
        roundId: req.body.roundId,
        teamSize: event.teamSize || 4,
      });
      rosterPayload.leaderName = provisioned.leaderName;
      rosterPayload.leaderContactEmail = provisioned.leaderContactEmail;
      rosterPayload.memberNames = provisioned.memberNames;
      rosterPayload.accessPack = provisioned.accessPack;
      credentials = provisioned.credentials;
    } else {
      rosterPayload = validateTeamCreate({
        ...req.body,
        teamSize: req.body.teamSize != null ? req.body.teamSize : (event.teamSize || 4),
      });
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
  const teamPassword = decryptCredential(
    pack.encryptedTeamPassword
      || pack.encryptedSharedScannerPassword
      || pack.sharedScannerPassword
      || leader.encryptedPassword
      || leader.password
      || '',
  ) || sharedScannerPassword;
  return {
    ...team,
    allMemberNames: [team.leaderName, ...(team.memberNames || [])].filter(Boolean),
    teamLoginPath,
    teamLoginUrl: teamLoginPath,
    access: {
      teamLoginPath,
      teamPassword: revealSecrets ? teamPassword : '',
      howToLogin: 'Open team link → enter password → tap who you are',
      leader: {
        name: leader.name || team.leaderName || '',
        loginEmail: leader.loginEmail || '',
        contactEmail: leader.contactEmail || team.leaderContactEmail || '',
        password: revealSecrets
          ? (decryptCredential(leader.encryptedPassword || leader.password || '') || teamPassword)
          : '',
        note: leader.note || 'Same team password — tap Leader after entering password',
        role: 'leader',
        access: 'Full hunt — clues, answers, timer, scans',
        loginPath: teamLoginPath,
        deepLink: `${teamLoginPath}?role=leader`,
      },
      scanners: scanners.map((s, idx) => ({
        name: s.name || team.memberNames?.[idx] || `Scanner ${idx + 1}`,
        loginEmail: s.loginEmail || '',
        password: revealSecrets
          ? (decryptCredential(s.encryptedPassword || s.password || '')
            || sharedScannerPassword
            || teamPassword)
          : '',
        role: 'scanner',
        access: 'Player — checkpoint scans on the shared team page',
        loginPath: teamLoginPath,
        deepLink: `${teamLoginPath}?role=scanner&slot=${idx + 1}`,
      })),
      sharedScannerPassword: revealSecrets ? (sharedScannerPassword || teamPassword) : '',
    },
  };
}

async function revealTeamAccess(req, res, next) {
  try {
    const { isCredentialVaultUnreadable } = require('../services/teamGateService');
    const team = await CampusHuntTeam.findById(req.params.teamId)
      .select('+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword '
        + '+accessPack.encryptedSharedScannerPassword +accessPack.encryptedTeamPassword')
      .lean();
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    const event = await CampusHuntEvent.findById(team.eventId).select('slug name college');

    if (isCredentialVaultUnreadable(team)) {
      return res.status(409).json({
        success: false,
        message: 'Password vault unreadable (credential key changed). Set a new team password, then reveal again.',
        code: 'CREDENTIAL_VAULT_RESET_REQUIRED',
      });
    }

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

/**
 * Set the one shared password for a team (admin-chosen).
 * POST /admin/teams/:teamId/team-password  { password }
 */
async function setTeamPassword(req, res, next) {
  try {
    const { setTeamSharedPassword } = require('../services/teamGateService');
    const team = await CampusHuntTeam.findById(req.params.teamId)
      .select('+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword '
        + '+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword');
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    await setTeamSharedPassword(team, req.body.password || req.body.teamPassword);

    const event = await CampusHuntEvent.findById(team.eventId).select('slug name college');
    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'team_password_set',
      targetType: 'team',
      targetId: team._id,
      reason: req.body.reason || 'Admin set shared team password',
    });

    const fresh = await CampusHuntTeam.findById(team._id)
      .select('+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword '
        + '+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword')
      .lean();
    return res.json({
      success: true,
      data: { team: buildTeamAccessView(fresh, event, { revealSecrets: true }) },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

/**
 * Set the same shared password on every team in the event.
 * POST /admin/events/:eventId/teams/set-password  { password }
 */
async function setAllTeamPasswords(req, res, next) {
  try {
    const { setTeamSharedPassword } = require('../services/teamGateService');
    const password = String(req.body.password || req.body.teamPassword || '').trim();
    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 4 characters',
      });
    }

    const event = await CampusHuntEvent.findById(req.params.eventId).select('slug name college');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const teams = await CampusHuntTeam.find({ eventId: event._id })
      .select('+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword '
        + '+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword');

    let updated = 0;
    for (const team of teams) {
      // eslint-disable-next-line no-await-in-loop
      await setTeamSharedPassword(team, password);
      updated += 1;
    }

    await writeAudit({
      eventId: event._id,
      ...adminActor(req),
      action: 'all_team_passwords_set',
      targetType: 'event',
      targetId: event._id,
      reason: req.body.reason || `Set shared password on ${updated} teams`,
      after: { teamsUpdated: updated },
    });

    return res.json({
      success: true,
      data: {
        teamsUpdated: updated,
        password,
        loginPath: `/campus-hunt/${event.slug}/team/CC001`,
        message: 'Share each team’s /team/CC00x link — password + tap name',
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function listTeams(req, res, next) {
  try {
    const User = require('../../../model/usermodel');
    const { isCredentialVaultUnreadable } = require('../services/teamGateService');
    const event = await CampusHuntEvent.findById(req.params.eventId)
      .select('slug name college teamCapacity teamSize startCount stationCount');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const teams = await CampusHuntTeam.find({ eventId: req.params.eventId })
      .select('+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword '
        + '+accessPack.encryptedSharedScannerPassword +accessPack.encryptedTeamPassword '
        + '+accessPack.sharedScannerPassword +accessPack.leader.password +accessPack.scanners.password')
      .sort({ teamCode: 1 })
      .lean();
    const withAccess = [];
    for (const team of teams) {
      const vaultUnreadable = isCredentialVaultUnreadable(team);
      const view = buildTeamAccessView(team, event, { revealSecrets: !vaultUnreadable });
      view.access.vaultUnreadable = vaultUnreadable;
      if (!view.access.leader.loginEmail && team.leaderUserId) {
        // eslint-disable-next-line no-await-in-loop
        const leader = await User.findById(team.leaderUserId).select('name email').lean();
        view.access.leader.loginEmail = leader?.email || '';
        view.access.leader.name = view.access.leader.name || leader?.name || '';
        view.access.leader.note = 'Same shared team password — tap Leader after entering it';
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
          teamCapacity: event.teamCapacity,
          teamSize: event.teamSize,
          startCount: event.startCount,
          stationCount: event.stationCount,
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
    const { isCredentialVaultUnreadable } = require('../services/teamGateService');
    const team = await CampusHuntTeam.findById(req.params.teamId)
      .select('+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword '
        + '+accessPack.encryptedSharedScannerPassword +accessPack.encryptedTeamPassword '
        + '+accessPack.sharedScannerPassword +accessPack.leader.password +accessPack.scanners.password')
      .lean();
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    const event = await CampusHuntEvent.findById(team.eventId).select('slug name college');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    const vaultUnreadable = isCredentialVaultUnreadable(team);
    const view = buildTeamAccessView(team, event, { revealSecrets: !vaultUnreadable });
    view.access.vaultUnreadable = vaultUnreadable;
    return res.json({
      success: true,
      data: { team: view },
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

        const requiredMembers = Math.max(1, (Number(event.teamSize) || 4) - 1);
        let roster;
        let credentials = null;
        if (memberNames.length === requiredMembers && row.leaderEmail) {
          const provisioned = await provisionTeamRoster({
            eventId: event._id,
            teamCode,
            teamName,
            leaderEmail: row.leaderEmail,
            leaderName: row.leaderName || teamName,
            memberNames,
            scannerPassword: row.scannerPassword,
            teamSize: event.teamSize || 4,
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

    if (req.body.playerRoundLocks && typeof req.body.playerRoundLocks === 'object') {
      const { normalizeTeamLocks } = require('../services/playerRoundAccess');
      const locks = normalizeTeamLocks(req.body.playerRoundLocks);
      team.playerRoundLocks = {
        round1: Boolean(locks.round1),
        survival: Boolean(locks.survival),
        finale: Boolean(locks.finale),
      };
    }

    const eventForSize = await CampusHuntEvent.findById(team.eventId)
      .select('teamSize')
      .lean();
    const people = Math.max(2, Math.min(8, Number(eventForSize?.teamSize) || 4));
    const scannersNeeded = Math.max(1, people - 1);

    if (Array.isArray(req.body.memberNames)) {
      const names = req.body.memberNames.map((n) => String(n || '').trim()).filter(Boolean);
      if (names.length !== scannersNeeded) {
        return res.status(400).json({
          success: false,
          message: `Provide exactly ${scannersNeeded} member name(s) (${people} people/team including leader)`,
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
      team.accessPack.scanners = scanners.slice(0, scannersNeeded);
    }

    // Optional: one shared team password (code + password → pick who you are).
    // Syncs leader + all player account passwords to the same value.
    if (req.body.teamPassword) {
      const { setTeamSharedPassword } = require('../services/teamGateService');
      await setTeamSharedPassword(team, req.body.teamPassword);
    }

    // Optional: rotate shared scanner password
    if (req.body.scannerPassword && !req.body.teamPassword) {
      const { ensureScannerUser } = require('../services/rosterProvisionService');
      const password = String(req.body.scannerPassword).trim().toUpperCase();
      const event = await CampusHuntEvent.findById(team.eventId).select('_id');
      const names = team.memberNames?.length === scannersNeeded
        ? team.memberNames
        : Array.from({ length: scannersNeeded }, (_, i) => `Scanner ${i + 1}`);
      const scanners = [];
      for (let i = 0; i < scannersNeeded; i += 1) {
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
      team.memberUserIds = (team.memberUserIds || []).slice(0, scannersNeeded);
      team.accessPack.scanners = scanners;
      team.accessPack.encryptedSharedScannerPassword = encryptCredential(password);
      team.accessPack.sharedScannerPassword = undefined;
    }

    // Optional: set a separate leader password. Saving the document runs the
    // User model password hashing hook; updateOne must not be used here.
    if (req.body.leaderPassword && team.leaderUserId && !req.body.teamPassword) {
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

    // Sync leader + scanner display names on User accounts (team login buttons)
    if (team.leaderName && team.leaderUserId) {
      const User = require('../../../model/usermodel');
      await User.updateOne({ _id: team.leaderUserId }, { $set: { name: team.leaderName } });
      if (team.accessPack.leader) team.accessPack.leader.name = team.leaderName;
    }
    if (Array.isArray(team.memberNames) && Array.isArray(team.memberUserIds)) {
      const User = require('../../../model/usermodel');
      await Promise.all(team.memberNames.map(async (name, idx) => {
        const userId = team.memberUserIds[idx];
        if (!userId || !name) return;
        await User.updateOne({ _id: userId }, { $set: { name } });
      }));
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
      secondCheckpointId,
      thirdCheckpointId,
      fourthCheckpointId,
      difficulty,
      active,
    } = req.body;

    if (!routeId || !roundId || !challengeNumber || !type) {
      return res.status(400).json({
        success: false,
        message: 'routeId, roundId, challengeNumber, and type are required',
      });
    }

    const cn = Number(challengeNumber);
    const normalizedVariantKey = cn === 5
      ? 'DEFAULT'
      : String(variantKey || '').trim().toUpperCase() || 'DEFAULT';
    if (cn === 1 && (!normalizedVariantKey || !firstCheckpointId)) {
      return res.status(400).json({
        success: false,
        message: 'Clue 1 requires variantKey and firstCheckpointId',
      });
    }
    if (cn === 2 && (!normalizedVariantKey || !secondCheckpointId)) {
      return res.status(400).json({
        success: false,
        message: 'Clue 2 requires variantKey and secondCheckpointId',
      });
    }
    if (cn === 3 && (!normalizedVariantKey || !thirdCheckpointId)) {
      return res.status(400).json({
        success: false,
        message: 'Clue 3 requires variantKey and thirdCheckpointId',
      });
    }
    if ((cn === 1 || cn === 2 || cn === 3)
      && typeof CampusHuntChallenge.ensureChallengeIndexes === 'function') {
      await CampusHuntChallenge.ensureChallengeIndexes();
    }
    if (cn === 1) {
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
    if (cn === 2) {
      const checkpoint = await CampusHuntCheckpoint.findOne({
        _id: secondCheckpointId,
        eventId: req.params.eventId,
        roundId,
        routeId,
        progressionKey: '2',
        active: true,
      });
      if (!checkpoint) {
        return res.status(400).json({
          success: false,
          message: 'Clue 2 second checkpoint must be an active CP2 on the same round and route',
        });
      }
    }
    if (cn === 3) {
      const checkpoint = await CampusHuntCheckpoint.findOne({
        _id: thirdCheckpointId,
        eventId: req.params.eventId,
        roundId,
        routeId,
        progressionKey: '3',
        active: true,
      });
      if (!checkpoint) {
        return res.status(400).json({
          success: false,
          message: 'Clue 3 third checkpoint must be an active CP3 on the same round and route',
        });
      }
    }
    if (cn === 4) {
      if (!normalizedVariantKey || normalizedVariantKey === 'DEFAULT') {
        return res.status(400).json({
          success: false,
          message: 'Clue 4 requires a team variantKey (e.g. A-T1), not DEFAULT',
        });
      }
      if (!fourthCheckpointId) {
        return res.status(400).json({
          success: false,
          message: 'Clue 4 requires fourthCheckpointId (shared purple QR for that place)',
        });
      }
      const checkpoint = await CampusHuntCheckpoint.findOne({
        _id: fourthCheckpointId,
        eventId: req.params.eventId,
        progressionKey: '4',
        active: true,
      });
      if (!checkpoint) {
        return res.status(400).json({
          success: false,
          message: 'Clue 4 fourth checkpoint must be an active shared CP4 for this place',
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
          secondCheckpointId: secondCheckpointId || undefined,
          thirdCheckpointId: thirdCheckpointId || undefined,
          fourthCheckpointId: fourthCheckpointId || undefined,
          difficulty: difficulty || 'medium',
          active: active !== false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (cn === 4 && normalizedVariantKey !== 'DEFAULT') {
      await CampusHuntChallenge.updateMany(
        {
          eventId: req.params.eventId,
          routeId,
          challengeNumber: 4,
          variantKey: 'DEFAULT',
        },
        { $set: { active: false } },
      );
    }

    await writeAudit({
      eventId: req.params.eventId,
      ...adminActor(req),
      action: 'challenge_upserted',
      targetType: 'challenge',
      targetId: challenge._id,
      after: {
        challengeNumber,
        routeId,
        type,
        variantKey: normalizedVariantKey,
        firstCheckpointId,
        secondCheckpointId,
      },
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
      stationCode,
    } = req.body;

    if (!routeId || !roundId || !checkpointKey || !locationName || sequence == null) {
      return res.status(400).json({
        success: false,
        message: 'routeId, roundId, checkpointKey, locationName, sequence required',
      });
    }

    const normalizedKey = String(checkpointKey).trim().toUpperCase();
    // Wave keys like 1-T1 / 2-T3 must keep progressionKey as 1|2|3|4|FINISH (not 2-T1).
    const rawProg = String(progressionKey || '').trim().toUpperCase();
    let normalizedProgression = rawProg;
    if (!['1', '2', '3', '4', 'FINISH'].includes(normalizedProgression)) {
      if (normalizedKey === 'FINISH' || normalizedKey.startsWith('FINISH')) {
        normalizedProgression = 'FINISH';
      } else {
        const match = normalizedKey.match(/^([1234])(?:-|$)/);
        normalizedProgression = match ? match[1] : '1';
      }
    }

    const route = await CampusHuntRoute.findOne({ _id: routeId, eventId: req.params.eventId });
    const routeKey = String(route?.routeKey || 'X').toUpperCase();
    const normalizedCode = String(
      code || `R${routeKey}-${normalizedKey}`,
    ).trim().toUpperCase();

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

    const station = stationCode
      ? String(stationCode).trim().toUpperCase()
      : undefined;

    // Prefer route+checkpointKey so wave posters (2-T1) don't duplicate under different codes.
    let checkpoint = await CampusHuntCheckpoint.findOneAndUpdate(
      {
        eventId: req.params.eventId,
        routeId,
        checkpointKey: normalizedKey,
      },
      {
        $set: {
          eventId: req.params.eventId,
          routeId,
          roundId,
          checkpointNumber: checkpointNumber ?? sequence,
          checkpointKey: normalizedKey,
          locationName,
          publicInstruction,
          sequence,
          active: active !== false,
          compensationPolicyKey: compensationPolicyKey || 'skip_and_continue',
          code: normalizedCode,
          progressionKey: normalizedProgression,
          startingPointId: startingPointId || undefined,
          allowedTeamIds: Array.isArray(allowedTeamIds) ? allowedTeamIds : [],
          capacityGuidance: capacityGuidance || undefined,
          concurrencyGuidance: concurrencyGuidance || '',
          ...(station ? { stationCode: station } : {}),
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
    if (req.body.stationCode != null) {
      const code = String(req.body.stationCode || '').trim().toUpperCase();
      checkpoint.stationCode = code || undefined;
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
/**
 * Build 1 shared QR print pack per campus place for a progression (1|2|3).
 * Prefer ST-* checkpoints over legacy team-bound posters.
 */
function progressionStage(raw) {
  const text = String(raw || '').trim().toUpperCase();
  if (/^[1-4]$/.test(text)) return text;
  const fromKey = text.match(/^([1-4])[-_]/);
  return fromKey ? fromKey[1] : text;
}

function buildSharedPrintPacks({
  stations,
  huntStations,
  waitNameSet,
  progressionKey,
  targetPosters = 1,
}) {
  const packsByCode = new Map(
    huntStations.map((station) => [String(station.code || '').toUpperCase(), {
      code: station.code,
      locationName: station.name,
      posters: [],
    }]),
  );
  let skipped = 0;
  const want = String(progressionKey).toUpperCase();

  for (const station of stations) {
    const key = progressionStage(station.progressionKey || station.checkpointKey);
    if (key !== want) continue;
    if (station.active === false) {
      skipped += 1;
      continue;
    }
    const place = String(station.locationName || '').trim();
    const stationCode = String(station.stationCode || '').toUpperCase().trim();
    if (!place && !stationCode) {
      skipped += 1;
      continue;
    }
    // Skip wait-point names only when we cannot tie the row to a campus station code.
    if (place && waitNameSet.has(place.toLowerCase()) && !stationCode) {
      skipped += 1;
      continue;
    }

    let pack = null;
    if (stationCode && packsByCode.has(stationCode)) {
      pack = packsByCode.get(stationCode);
    } else if (place) {
      const matched = huntStations.find(
        (row) => row.name.toLowerCase() === place.toLowerCase(),
      );
      if (matched) pack = packsByCode.get(String(matched.code || '').toUpperCase());
    }
    if (!pack) {
      skipped += 1;
      continue;
    }

    const isShared = /^ST-/i.test(String(station.code || ''));
    if (!isShared && !station.teamBound) {
      skipped += 1;
      continue;
    }

    const already = pack.posters.some((row) => (
      row.checkpointId === station.checkpointId
      || (isShared && /^ST-/i.test(String(row.code || '')))
    ));
    if (already) {
      skipped += 1;
      continue;
    }
    if (pack.posters.length >= targetPosters) {
      if (isShared) pack.posters = [station];
      else skipped += 1;
      continue;
    }
    pack.posters.push(station);
  }

  const printPacks = huntStations.map((station) => {
    const pack = packsByCode.get(String(station.code || '').toUpperCase());
    const posters = [...(pack?.posters || [])];
    return {
      code: station.code,
      locationName: station.name,
      posterCount: posters.length,
      targetPosters,
      posters,
    };
  });

  return { printPacks, skipped };
}

async function listStationQr(req, res, next) {
  try {
    const {
      buildStationQrPayload,
      ensurePasteCode,
    } = require('../services/checkpointService');
    const eventId = req.params.eventId;
    const checkpoints = await CampusHuntCheckpoint.find({ eventId })
      .select('+qrSecret +pasteCode')
      .sort({ locationName: 1, routeId: 1, sequence: 1, checkpointKey: 1 });

    const [routes, startingPoints, assignedTeams] = await Promise.all([
      CampusHuntRoute.find({ eventId }).select('routeKey name').lean(),
      CampusHuntStartingPoint.find({ eventId }).select('code name').lean(),
      CampusHuntTeam.find({
        eventId,
        $or: [
          { firstCheckpointId: { $exists: true, $ne: null } },
          { secondCheckpointId: { $exists: true, $ne: null } },
          { thirdCheckpointId: { $exists: true, $ne: null } },
          { fourthCheckpointId: { $exists: true, $ne: null } },
        ],
      })
        .select('teamCode teamName firstCheckpointId secondCheckpointId thirdCheckpointId fourthCheckpointId startingPointId routeId')
        .lean(),
    ]);
    const routeById = new Map(routes.map((r) => [String(r._id), r]));
    const startById = new Map(startingPoints.map((p) => [String(p._id), p]));
    const teamsByFirstCheckpoint = new Map();
    const teamsBySecondCheckpoint = new Map();
    const teamsByThirdCheckpoint = new Map();
    const teamsByFourthCheckpoint = new Map();
    for (const team of assignedTeams) {
      if (team.firstCheckpointId) {
        const key = String(team.firstCheckpointId);
        if (!teamsByFirstCheckpoint.has(key)) teamsByFirstCheckpoint.set(key, []);
        teamsByFirstCheckpoint.get(key).push(team);
      }
      if (team.secondCheckpointId) {
        const key = String(team.secondCheckpointId);
        if (!teamsBySecondCheckpoint.has(key)) teamsBySecondCheckpoint.set(key, []);
        teamsBySecondCheckpoint.get(key).push(team);
      }
      if (team.thirdCheckpointId) {
        const key = String(team.thirdCheckpointId);
        if (!teamsByThirdCheckpoint.has(key)) teamsByThirdCheckpoint.set(key, []);
        teamsByThirdCheckpoint.get(key).push(team);
      }
      if (team.fourthCheckpointId) {
        const key = String(team.fourthCheckpointId);
        if (!teamsByFourthCheckpoint.has(key)) teamsByFourthCheckpoint.set(key, []);
        teamsByFourthCheckpoint.get(key).push(team);
      }
    }

    function teamPosterLabel(team) {
      const start = startById.get(String(team.startingPointId || ''));
      const route = routeById.get(String(team.routeId || ''));
      return {
        teamId: String(team._id),
        teamCode: team.teamCode || null,
        teamName: team.teamName || null,
        startingPointId: team.startingPointId ? String(team.startingPointId) : null,
        startingPointCode: start?.code || route?.routeKey || null,
        startingPointName: start?.name || null,
      };
    }

    const stations = [];
    for (const c of checkpoints) {
      await ensurePasteCode(c);
      const prog = String(c.progressionKey || c.checkpointKey || '').toUpperCase();
      const fromAllowList = (c.allowedTeamIds || [])
        .map((id) => assignedTeams.find((t) => String(t._id) === String(id)))
        .filter(Boolean)
        .map(teamPosterLabel);
      const fromAssignment = (
        prog === '4'
          ? (teamsByFourthCheckpoint.get(String(c._id)) || [])
          : prog === '3'
            ? (teamsByThirdCheckpoint.get(String(c._id)) || [])
            : prog === '2'
              ? (teamsBySecondCheckpoint.get(String(c._id)) || [])
              : (teamsByFirstCheckpoint.get(String(c._id)) || [])
      ).map(teamPosterLabel);
      // Prefer allow-list; fall back to teams whose checkpointId points here
      const seen = new Set();
      const allowedTeams = [...fromAllowList, ...fromAssignment].filter((row) => {
        if (seen.has(row.teamId)) return false;
        seen.add(row.teamId);
        return true;
      });
      const route = routeById.get(String(c.routeId));
      const primary = allowedTeams[0] || null;
      stations.push({
        checkpointId: String(c._id),
        routeId: String(c.routeId),
        routeKey: route?.routeKey || primary?.startingPointCode || null,
        code: c.code || null,
        checkpointKey: c.checkpointKey,
        progressionKey: c.progressionKey || c.checkpointKey,
        locationName: c.locationName,
        stationCode: c.stationCode || null,
        active: c.active !== false,
        pasteCode: c.pasteCode,
        /** Short code players can paste when camera fails */
        pasteHint: `CH-${c.pasteCode}`,
        payload: buildStationQrPayload(c),
        allowedTeams,
        team: primary,
        teamBound: allowedTeams.length > 0,
        startLocation: primary?.startingPointName || null,
        startCode: primary?.startingPointCode || route?.routeKey || null,
        teamCode: primary?.teamCode || null,
        teamName: primary?.teamName || null,
        teamId: primary?.teamId || null,
      });
    }

    const { HUNT_STATIONS, WAIT_POINTS } = require('../services/round1BootstrapService');
    const event = await CampusHuntEvent.findById(eventId);
    const waitNameSet = new Set(
      WAIT_POINTS.map((w) => String(w.name || '').trim().toLowerCase()),
    );
    const huntStations = event ? resolveCampusStations(event) : HUNT_STATIONS;
    const TARGET_POSTERS = 1;

    const first = buildSharedPrintPacks({
      stations,
      huntStations,
      waitNameSet,
      progressionKey: '1',
      targetPosters: TARGET_POSTERS,
    });
    const second = buildSharedPrintPacks({
      stations,
      huntStations,
      waitNameSet,
      progressionKey: '2',
      targetPosters: TARGET_POSTERS,
    });
    const third = buildSharedPrintPacks({
      stations,
      huntStations,
      waitNameSet,
      progressionKey: '3',
      targetPosters: TARGET_POSTERS,
    });

    const fourth = buildSharedPrintPacks({
      stations,
      huntStations,
      waitNameSet,
      progressionKey: '4',
      targetPosters: TARGET_POSTERS,
    });

    const firstStopPrintPacks = first.printPacks;
    const secondStopPrintPacks = second.printPacks;
    const thirdStopPrintPacks = third.printPacks;
    const fourthStopPrintPacks = fourth.printPacks;
    const skippedUnwanted = first.skipped;
    const skippedSecond = second.skipped;
    const skippedThird = third.skipped;
    const skippedFourth = fourth.skipped;

    const totalPosters = firstStopPrintPacks.reduce((sum, pack) => sum + pack.posterCount, 0);
    const totalSecondPosters = secondStopPrintPacks.reduce((sum, pack) => sum + pack.posterCount, 0);
    const totalThirdPosters = thirdStopPrintPacks.reduce((sum, pack) => sum + pack.posterCount, 0);
    const totalFourthPosters = fourthStopPrintPacks.reduce((sum, pack) => sum + pack.posterCount, 0);

    return res.json({
      success: true,
      data: {
        stations,
        firstStopPrintPacks,
        secondStopPrintPacks,
        thirdStopPrintPacks,
        fourthStopPrintPacks,
        campusStations: huntStations,
        printSummary: {
          places: firstStopPrintPacks.length,
          posters: totalPosters,
          targetPosters: huntStations.length * TARGET_POSTERS,
          skippedUnwanted,
          secondPlaces: secondStopPrintPacks.length,
          secondPosters: totalSecondPosters,
          secondSkipped: skippedSecond,
          thirdPlaces: thirdStopPrintPacks.length,
          thirdPosters: totalThirdPosters,
          thirdSkipped: skippedThird,
          fourthPlaces: fourthStopPrintPacks.length,
          fourthPosters: totalFourthPosters,
          fourthSkipped: skippedFourth,
        },
        hint:
          'Clue 1: orange shared QRs. Clue 2: green. Clue 3: blue. '
          + 'Clue 4: purple. After full roster scans, teams enter their team code.',
      },
    });
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

/**
 * Playtest helper: force team onto the scan stage for orange/green/blue/purple, then complete full roster scan.
 * scan: '1' | '2' | '3' | '4' | 'all'
 */
async function playtestCompleteScan(req, res, next) {
  try {
    const scanRaw = String(req.body.scan || '').trim().toLowerCase();
    const scans = scanRaw === 'all' ? ['1', '2', '3', '4'] : [scanRaw];
    if (!scans.every((s) => ['1', '2', '3', '4'].includes(s))) {
      return res.status(400).json({
        success: false,
        message: 'scan must be 1 (orange), 2 (green), 3 (blue), 4 (purple), or all',
      });
    }

    let team = await CampusHuntTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const event = await CampusHuntEvent.findById(team.eventId).select('teamSize').lean();
    const people = Math.max(2, Math.min(8, Number(event?.teamSize) || 4));

    const stageForScan = {
      1: 'CLUE_1_COMPLETED',
      2: 'CLUE_2_COMPLETED',
      // Blue only after Clue 3 riddle (green auto-opens Clue 3)
      3: 'CLUE_3_COMPLETED',
      4: 'CLUE_4_COMPLETED',
    };
    const checkpointField = {
      1: 'firstCheckpointId',
      2: 'secondCheckpointId',
      3: 'thirdCheckpointId',
      4: 'fourthCheckpointId',
    };
    const labelFor = { 1: 'Orange', 2: 'Green', 3: 'Blue', 4: 'Purple' };
    const done = [];

    for (const scan of scans) {
      const checkpointId = team[checkpointField[scan]];
      if (!checkpointId) {
        return res.status(409).json({
          success: false,
          message: `${labelFor[scan]} checkpoint not bound — Generate schedule / save clues first`,
        });
      }
      const checkpoint = await CampusHuntCheckpoint.findById(checkpointId);
      if (!checkpoint) {
        return res.status(404).json({
          success: false,
          message: `${labelFor[scan]} checkpoint missing`,
        });
      }

      const needStage = stageForScan[scan];
      if (team.currentStage !== needStage) {
        team.currentStage = needStage;
        team.startStatus = team.startStatus === 'WAITING' ? 'RELEASED' : team.startStatus;
        if (!team.actualStartAt) team.actualStartAt = new Date();
        // eslint-disable-next-line no-await-in-loop
        await team.save();
        // eslint-disable-next-line no-await-in-loop
        team = await CampusHuntTeam.findById(team._id);
      }

      // eslint-disable-next-line no-await-in-loop
      const result = await completeCheckpoint({
        team,
        checkpoint,
        volunteer: { ...adminActor(req), actorType: 'admin' },
        source: 'manual',
        notes: `Playtest ${people}/${people} ${labelFor[scan]}`,
        forceMemberIds: team.allMemberIds(),
      });
      done.push({
        scan,
        label: labelFor[scan],
        teamStage: result.teamStage,
        alreadyProcessed: Boolean(result.alreadyProcessed),
        requiredCount: people,
      });
      // eslint-disable-next-line no-await-in-loop
      team = await CampusHuntTeam.findById(team._id);
    }

    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'playtest_complete_scan',
      targetType: 'team',
      targetId: team._id,
      reason: req.body.reason || 'Playtest desk 4/4',
      after: { scans: done, stage: team.currentStage },
    });

    return res.json({
      success: true,
      data: {
        team,
        scans: done,
        currentStage: team.currentStage,
        currentScore: team.currentScore,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

/**
 * Playtest: wipe one team's progress so you can start the flow again.
 * Keeps schedule binding (start point / clue IDs). Score → startingScore (100).
 */
async function playtestResetTeam(req, res, next) {
  try {
    const team = await CampusHuntTeam.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const startScore = Number(team.startingScore) > 0 ? Number(team.startingScore) : 100;
    const before = {
      currentStage: team.currentStage,
      currentScore: team.currentScore,
      startStatus: team.startStatus,
    };

    await Promise.all([
      CampusHuntTeamProgress.deleteMany({ teamId: team._id }),
      CampusHuntCheckpointVerification.deleteMany({ teamId: team._id }),
    ]);

    team.currentStage = 'WAITING';
    team.status = 'registered';
    team.startStatus = 'WAITING';
    team.currentScore = startScore;
    team.startingScore = startScore;
    team.finalScore = undefined;
    team.scoreLockedAt = undefined;
    team.finishedAt = undefined;
    team.actualStartAt = undefined;
    team.lastCheckpointNumber = undefined;
    team.suddenDeathRank = undefined;
    team.stats = {
      hintsUsed: 0,
      failedAttempts: 0,
      manualPenalty: 0,
      totalCompletionMs: undefined,
    };
    await team.save();

    const { publishTeamProgress } = require('../services/teamProgressBus');
    publishTeamProgress(team._id);

    await writeAudit({
      eventId: team.eventId,
      ...adminActor(req),
      action: 'playtest_reset_team',
      targetType: 'team',
      targetId: team._id,
      reason: req.body.reason || 'Playtest desk — start over',
      before,
      after: {
        currentStage: team.currentStage,
        currentScore: team.currentScore,
        startStatus: team.startStatus,
      },
    });

    return res.json({
      success: true,
      data: {
        team,
        scoresResetTo: startScore,
        message: 'Team reset — use Release this team now to start again',
      },
    });
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

    const event = await CampusHuntEvent.findById(round.eventId).select('startingScore');
    const startScore = Number(event?.startingScore) > 0
      ? Number(event.startingScore)
      : 100;

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
      [
        {
          $set: {
            currentStage: 'WAITING',
            status: 'registered',
            startStatus: 'WAITING',
            startingScore: { $ifNull: ['$startingScore', startScore] },
            currentScore: { $ifNull: ['$startingScore', startScore] },
            'stats.hintsUsed': 0,
            'stats.failedAttempts': 0,
            'stats.manualPenalty': 0,
          },
        },
        {
          $unset: [
            'scoreLockedAt',
            'finalScore',
            'finishedAt',
            'lastCheckpointNumber',
            'actualStartAt',
            'suddenDeathRank',
            'stats.totalCompletionMs',
          ],
        },
      ],
    );

    await writeAudit({
      eventId: round.eventId,
      ...adminActor(req),
      action: 'round_reopened',
      targetType: 'round',
      targetId: round._id,
      reason: req.body.reason || '',
      after: {
        teamsReset: teams.length,
        resetProgress: true,
        scoresResetTo: startScore,
        scheduleStatus: 'draft',
      },
    });

    return res.json({
      success: true,
      data: { round, teamsReset: teams.length, scoresResetTo: startScore },
    });
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
    const durationMs = durationMinutes * 60 * 1000;
    const activateWaitingOnly = req.body.activateWaitingOnly === true && round.status === 'live';
    round.status = 'live';
    round.releasesPaused = false;
    if (!activateWaitingOnly) {
      if (!round.startsAt) round.startsAt = now;
    }
    // Always keep a live playable window. Stale endsAt (e.g. after regenerating
    // startsAt, or starting against an old clock) was blocking clue submits.
    if (req.body.endsAt) {
      round.endsAt = new Date(req.body.endsAt);
    } else {
      const windowStart = Math.max(
        now.getTime(),
        round.startsAt ? new Date(round.startsAt).getTime() : now.getTime(),
      );
      round.endsAt = new Date(windowStart + durationMs);
    }
    if (new Date(round.endsAt).getTime() <= now.getTime() + 60 * 1000) {
      round.endsAt = new Date(now.getTime() + durationMs);
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

    const liveTeams = await CampusHuntTeam.find({
      eventId: round.eventId,
      roundId: round._id,
    }).select('_id').lean();
    const { publishManyTeamProgress } = require('../services/teamProgressBus');
    publishManyTeamProgress(liveTeams.map((row) => row._id));

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

async function bootstrapRound1(req, res, next) {
  try {
    const data = await bootstrapRound1Defaults({
      eventId: req.params.eventId,
      actor: adminActor(req),
      createTeams: req.body?.createTeams !== false,
      enablePublicLeaderboard: req.body?.enablePublicLeaderboard !== false,
      challengeNumbers: Array.isArray(req.body?.challengeNumbers)
        ? req.body.challengeNumbers
        : (req.body?.challengeNumber != null
          ? [Number(req.body.challengeNumber)]
          : null),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

async function repairTeamRosters(req, res, next) {
  try {
    const { repairAllTeamRostersForEvent } = require('../services/rosterProvisionService');
    const data = await repairAllTeamRostersForEvent(req.params.eventId, {
      leaderPassword: req.body?.leaderPassword || 'HUNT2026',
      scannerPassword: req.body?.scannerPassword || 'HUNT2026',
    });
    await writeAudit({
      eventId: req.params.eventId,
      ...adminActor(req),
      action: 'repair_team_rosters',
      targetType: 'event',
      targetId: req.params.eventId,
      after: data,
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

async function updateEventCampusStations(req, res, next) {
  try {
    const result = await updateCampusStations({
      eventId: req.params.eventId,
      stations: req.body?.campusStations || req.body?.stations,
      starts: req.body?.campusStarts || req.body?.starts,
      stationCount: req.body?.stationCount,
      startCount: req.body?.startCount,
      actor: adminActor(req),
      reason: req.body?.reason || 'Admin updated hunt layout',
    });
    await writeAudit({
      eventId: req.params.eventId,
      ...adminActor(req),
      action: 'campus_stations_updated',
      targetType: 'event',
      targetId: req.params.eventId,
      reason: req.body?.reason || '',
      after: {
        campusStations: result.campusStations,
        campusStarts: result.campusStarts,
        stationCount: result.stationCount,
        startCount: result.startCount,
        renames: result.renames,
        checkpointsUpdated: result.checkpointsUpdated,
        challengesUpdated: result.challengesUpdated,
      },
    });
    return res.json({
      success: true,
      data: {
        campusStations: result.campusStations,
        campusStationsCatalog: result.campusStationsCatalog,
        campusStarts: result.campusStarts,
        campusStartsCatalog: result.campusStartsCatalog,
        stationCount: result.stationCount,
        startCount: result.startCount,
        renames: result.renames,
        checkpointsUpdated: result.checkpointsUpdated,
        challengesUpdated: result.challengesUpdated,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/** Export offline hunt packs — one JSON bundle per team for airplane-mode play. */
async function exportOfflinePacks(req, res, next) {
  try {
    const { exportOfflinePacks: buildPacks } = require('../services/offlineExportService');
    const data = await buildPacks(req.params.eventId);
    await writeAudit({
      eventId: req.params.eventId,
      ...adminActor(req),
      action: 'offline_packs_exported',
      targetType: 'event',
      targetId: req.params.eventId,
      after: {
        teamCount: data.teamCount,
        incomplete: data.incompleteTeams?.length || 0,
        warnings: data.warnings?.length || 0,
      },
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

module.exports = {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventOverview,
  updateEventCampusStations,
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
  resyncClue1Bindings,
  bulkSaveClue2Variants,
  bulkSaveClue1Variants,
  bulkSaveClue3Variants,
  bulkSaveClue4Variants,
  bulkSaveClue5Variants,
  saveClueScoringSettings,
  setRoundReleasesPaused,
  setStartingPointPaused,
  manualReleaseTeam,
  markTeamStartReached,
  getStartDashboard,
  createTeam,
  listTeams,
  getTeamAdmin,
  revealTeamAccess,
  setTeamPassword,
  setAllTeamPasswords,
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
  playtestCompleteScan,
  playtestResetTeam,
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
  bootstrapRound1,
  repairTeamRosters,
  exportOfflinePacks,
};
