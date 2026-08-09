const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntRound = require('../models/CampusHuntRound');
const { findTeamForUser, publicTeamView } = require('../services/teamService');
const {
  submitAnswer,
  requestHint,
  rewindPreviousStep,
  buildPlayerProgress,
} = require('../services/challengeService');
const { buildLeaderboard } = require('../services/leaderboardService');
const {
  validateAnswerBody,
  validateHintBody,
  parseChallengeNumber,
} = require('../validators/challengeValidators');
const { resolveRequestId } = require('../utils/idempotency');
const { isCampusHuntEnabled } = require('../middleware/featureEnabled');

async function getStatus(req, res) {
  const enabled = isCampusHuntEnabled();
  let eventsVisible = [];
  if (enabled) {
    const events = await CampusHuntEvent.find({
      status: { $nin: ['draft'] },
    })
      .select('name college slug status date')
      .lean();
    eventsVisible = events;
  }
  return res.json({
    success: true,
    data: { enabled, eventsVisible },
  });
}

/**
 * Public: colleges with events marked live for Profile leaderboard only.
 * Does not advertise Campus Hunt on the main website.
 */
async function listColleges(req, res, next) {
  try {
    const events = await CampusHuntEvent.find({
      publicLeaderboardLive: true,
      status: { $nin: ['draft'] },
    })
      .select('name college slug status date teamCapacity publicLeaderboardLive')
      .sort({ college: 1, date: -1 })
      .lean();

    const byCollege = new Map();
    for (const ev of events) {
      const key = String(ev.college || '').trim() || 'Other';
      if (!byCollege.has(key)) {
        byCollege.set(key, {
          college: key,
          events: [],
        });
      }
      byCollege.get(key).events.push({
        id: String(ev._id),
        name: ev.name,
        slug: ev.slug,
        status: ev.status,
        date: ev.date,
        teamCapacity: ev.teamCapacity,
      });
    }

    return res.json({
      success: true,
      data: {
        colleges: [...byCollege.values()],
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Public live leaderboard — only when admin enabled Profile live display.
 */
async function getPublicLeaderboard(req, res, next) {
  try {
    const event = await CampusHuntEvent.findById(req.params.eventId)
      .select('name college slug status publicLeaderboardLive');
    const finalizedRound = event
      ? await CampusHuntRound.exists({ eventId: event._id, status: 'finalized' })
      : null;
    if (
      !event
      || event.status === 'draft'
      || (!event.publicLeaderboardLive && !finalizedRound)
    ) {
      return res.status(404).json({ success: false, message: 'Leaderboard not live' });
    }
    const rows = await buildLeaderboard(event._id, { includeUnfinished: true });
    return res.json({
      success: true,
      data: {
        event: {
          id: String(event._id),
          name: event.name,
          college: event.college,
          slug: event.slug,
          status: event.status,
        },
        leaderboard: rows,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function getMyTeam(req, res, next) {
  try {
    const eventId = req.query.eventId;
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'eventId is required' });
    }
    const userId = req.user.userId;
    const team = await findTeamForUser(eventId, userId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'No team found for this event' });
    }
    const isLeader = team.isLeader(userId);
    const progress = await buildPlayerProgress(team, userId, isLeader);
    return res.json({
      success: true,
      data: {
        team: publicTeamView(progress.team, { isLeader, start: progress.start }),
        challenges: progress.challenges,
        checkpointStatus: progress.checkpointStatus || null,
        serverTime: progress.serverTime,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function getTeamProgress(req, res, next) {
  try {
    const team = req.huntTeam;
    const userId = req.user.userId;
    const isLeader = req.isHuntLeader;
    const progress = await buildPlayerProgress(team, userId, isLeader);
    return res.json({
      success: true,
      data: {
        team: publicTeamView(progress.team, { isLeader, start: progress.start }),
        challenges: progress.challenges,
        checkpointStatus: progress.checkpointStatus || null,
        serverTime: progress.serverTime,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function scanStation(req, res, next) {
  try {
    const { playerScanStation } = require('../services/checkpointService');
    const raw = req.body?.raw || req.body?.qr || req.body?.payload;
    if (!raw) {
      return res.status(400).json({ success: false, message: 'Station QR payload required' });
    }
    const result = await playerScanStation({
      team: req.huntTeam,
      userId: req.user.userId,
      raw,
    });
    const progress = await buildPlayerProgress(
      await require('../models/CampusHuntTeam').findById(req.huntTeam._id),
      req.user.userId,
      req.isHuntLeader,
    );
    return res.json({
      success: true,
      data: {
        ...result,
        team: publicTeamView(progress.team, {
          isLeader: req.isHuntLeader,
          start: progress.start,
        }),
        challenges: progress.challenges,
        checkpointStatus: progress.checkpointStatus,
        serverTime: progress.serverTime,
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

async function submitChallengeAnswer(req, res, next) {
  try {
    const challengeNumber = parseChallengeNumber(
      req.params.n || req.params.challengeNumber || req.body.challengeNumber,
    );
    const { answer, requestId: bodyRequestId } = validateAnswerBody(req.body);
    const requestId = resolveRequestId(req, [
      'answer',
      req.huntTeam._id,
      challengeNumber,
      bodyRequestId,
    ]);

    const result = await submitAnswer({
      team: req.huntTeam,
      userId: req.user.userId,
      isLeader: req.isHuntLeader,
      challengeNumber,
      answer,
      requestId,
    });

    // Refresh team
    const team = await CampusHuntTeam.findById(req.huntTeam._id);
    return res.json({
      success: true,
      data: {
        ...result,
        team: publicTeamView(team, { isLeader: req.isHuntLeader }),
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

async function submitClue1(req, res, next) {
  req.params.n = '1';
  return submitChallengeAnswer(req, res, next);
}

async function requestChallengeHint(req, res, next) {
  try {
    const challengeNumber = parseChallengeNumber(req.params.n);
    const { requestId: bodyRequestId } = validateHintBody(req.body);
    const requestId = resolveRequestId(req, [
      'hint',
      req.huntTeam._id,
      challengeNumber,
      bodyRequestId,
    ]);

    const result = await requestHint({
      team: req.huntTeam,
      userId: req.user.userId,
      isLeader: req.isHuntLeader,
      challengeNumber,
      requestId,
    });

    const team = await CampusHuntTeam.findById(req.huntTeam._id);
    return res.json({
      success: true,
      data: {
        ...result,
        team: publicTeamView(team, { isLeader: req.isHuntLeader }),
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

async function getLeaderboard(req, res, next) {
  try {
    const { eventId } = req.params;
    const [event, finalizedRound, team] = await Promise.all([
      CampusHuntEvent.findById(eventId).select('publicLeaderboardLive'),
      CampusHuntRound.exists({ eventId, status: 'finalized' }),
      findTeamForUser(eventId, req.user.userId),
    ]);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (!team) {
      return res.status(403).json({ success: false, message: 'No team found for this event' });
    }
    const rows = await buildLeaderboard(eventId, { includeUnfinished: true });
    const fullVisible = Boolean(event.publicLeaderboardLive || finalizedRound);
    const visibleRows = fullVisible
      ? rows
      : rows.filter((row) => row.teamId === String(team._id));
    return res.json({
      success: true,
      data: {
        leaderboard: visibleRows,
        visibility: fullVisible ? 'full' : 'team_only',
        serverTime: new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function getEventBySlug(req, res, next) {
  try {
    const event = await CampusHuntEvent.findOne({ slug: req.params.slug })
      .select('name college slug status date teamCapacity teamSize startingScore');
    if (!event || event.status === 'draft') {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    return res.json({ success: true, data: { event } });
  } catch (err) {
    return next(err);
  }
}

/**
 * Public team login card — names + login emails only (no passwords).
 * GET /events/by-slug/:slug/teams/:teamCode
 */
async function getTeamLoginCard(req, res, next) {
  try {
    const User = require('../../../model/usermodel');
    const event = await CampusHuntEvent.findOne({ slug: req.params.slug })
      .select('name college slug status');
    if (!event || event.status === 'draft') {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const teamDoc = await CampusHuntTeam.findOne({
      eventId: event._id,
      teamCode: String(req.params.teamCode || '').trim().toUpperCase(),
    }).lean();

    if (!teamDoc) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const pack = teamDoc.accessPack || {};
    const rosterUsers = [];
    for (const userId of [teamDoc.leaderUserId, ...(teamDoc.memberUserIds || [])]) {
      // eslint-disable-next-line no-await-in-loop
      const user = userId
        ? await User.findById(userId).select('name email').lean()
        : null;
      rosterUsers.push(user);
    }

    const scanners = (teamDoc.memberNames || []).map((name, idx) => {
      const stored = pack.scanners?.[idx] || {};
      const rosterUser = rosterUsers[idx + 1];
      return {
        slot: idx + 1,
        name: stored.name || name || rosterUser?.name || `Member ${idx + 1}`,
        loginEmail: stored.loginEmail || rosterUser?.email || '',
        role: 'scanner',
      };
    });

    // Fallback when accessPack not stored (legacy teams)
    if (!scanners.length && teamDoc.memberUserIds?.length) {
      teamDoc.memberUserIds.forEach((userId, idx) => {
        const rosterUser = rosterUsers[idx + 1];
        scanners.push({
          slot: idx + 1,
          name: rosterUser?.name || `Member ${idx + 1}`,
          loginEmail: rosterUser?.email || '',
          role: 'scanner',
        });
      });
    }

    return res.json({
      success: true,
      data: {
        event: {
          id: String(event._id),
          name: event.name,
          college: event.college,
          slug: event.slug,
          status: event.status,
        },
        team: {
          teamCode: teamDoc.teamCode,
          teamName: teamDoc.teamName,
          status: teamDoc.status,
          currentStage: teamDoc.currentStage,
          playPath: `/campus-hunt/${event.slug}/play`,
          loginPath: `/campus-hunt/${event.slug}/team/${teamDoc.teamCode}`,
          members: [
            {
              slot: 0,
              name: pack.leader?.name || teamDoc.leaderName || rosterUsers[0]?.name || 'Leader',
              loginEmail: pack.leader?.loginEmail || rosterUsers[0]?.email || '',
              role: 'leader',
            },
            ...scanners,
          ],
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Team-scoped password login. Membership is verified before delegating to the
 * normal user login controller, so Campus Hunt credentials do not depend on
 * browser reCAPTCHA being available at the venue.
 */
async function loginTeamMember(req, res, next) {
  try {
    const User = require('../../../model/usermodel');
    const { login } = require('../../../controllers/usercontroller');
    const email = String(req.body?.email || '').trim().toLowerCase();
    const event = await CampusHuntEvent.findOne({ slug: req.params.slug }).select('_id status');
    if (!event || event.status === 'draft') {
      return res.status(401).json({ success: false, message: 'Invalid team credentials' });
    }

    const team = await CampusHuntTeam.findOne({
      eventId: event._id,
      teamCode: String(req.params.teamCode || '').trim().toUpperCase(),
    }).select('leaderUserId memberUserIds');
    const user = email ? await User.findOne({ email }).select('_id') : null;
    const rosterIds = team
      ? [team.leaderUserId, ...(team.memberUserIds || [])].map((id) => String(id))
      : [];

    if (!user || !rosterIds.includes(String(user._id))) {
      return res.status(401).json({ success: false, message: 'Invalid team credentials' });
    }

    return login(req, res);
  } catch (err) {
    return next(err);
  }
}

/** Local/dev only: force current pending checkpoint — requires 4 distinct members. */
async function forceUnlockClue2(req, res, next) {
  try {
    // Never available in production (even with CAMPUS_HUNT_DEV_CHEATS)
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const {
      completeCheckpoint,
      getPendingCheckpointStatus,
    } = require('../services/checkpointService');
    const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
    const { assertOnlineRosterReady } = require('../utils/roster');
    let team = req.huntTeam;

    // Optional: jump Clue 1 typing → scan stage
    if (team.currentStage === 'CLUE_1_ACTIVE' && req.body?.completeClue1) {
      team.currentStage = 'CLUE_1_COMPLETED';
      await team.save();
      team = await CampusHuntTeam.findById(team._id);
    }

    const pending = await getPendingCheckpointStatus(team, req.user.userId);
    if (!pending?.checkpointId) {
      return res.status(409).json({
        success: false,
        message: `No pending checkpoint scan at stage ${team.currentStage}`,
      });
    }

    const checkpoint = await CampusHuntCheckpoint.findById(pending.checkpointId);
    if (!checkpoint) {
      return res.status(404).json({ success: false, message: 'Checkpoint not found' });
    }

    const memberIds = assertOnlineRosterReady(team, 4);

    await completeCheckpoint({
      team,
      checkpoint,
      volunteer: {
        actorType: 'player',
        actorId: req.user.userId,
        label: 'dev_force_checkpoint',
      },
      source: 'manual',
      notes: `Dev cheat force checkpoint ${checkpoint.checkpointKey}`,
      forceMemberIds: memberIds,
    });

    const fresh = await CampusHuntTeam.findById(team._id);
    const progress = await buildPlayerProgress(fresh, req.user.userId, req.isHuntLeader);
    return res.json({
      success: true,
      data: {
        forced: true,
        checkpointKey: checkpoint.checkpointKey,
        team: publicTeamView(progress.team, {
          isLeader: req.isHuntLeader,
          start: progress.start,
        }),
        challenges: progress.challenges,
        checkpointStatus: progress.checkpointStatus,
        serverTime: progress.serverTime,
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

async function rewindStep(req, res, next) {
  try {
    const result = await rewindPreviousStep({
      team: req.huntTeam,
      userId: req.user.userId,
      isLeader: req.isHuntLeader,
    });
    const team = await CampusHuntTeam.findById(req.huntTeam._id);
    const progress = await buildPlayerProgress(team, req.user.userId, true);
    return res.json({
      success: true,
      data: {
        ...result,
        team: publicTeamView(progress.team, { isLeader: true }),
        challenges: progress.challenges,
        checkpointStatus: progress.checkpointStatus || null,
        serverTime: progress.serverTime,
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

module.exports = {
  getStatus,
  listColleges,
  getPublicLeaderboard,
  getMyTeam,
  getTeamProgress,
  submitChallengeAnswer,
  submitClue1,
  requestChallengeHint,
  getLeaderboard,
  getEventBySlug,
  getTeamLoginCard,
  loginTeamMember,
  scanStation,
  rewindStep,
  forceUnlockClue2,
};
