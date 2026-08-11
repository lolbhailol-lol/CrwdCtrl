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
 * Profile sidebar — separate on/off for login vs leaderboard.
 */
async function listProfileEntries(req, res, next) {
  try {
    const events = await CampusHuntEvent.find({
      status: { $nin: ['draft'] },
      $or: [
        { publicLoginLive: true },
        { publicLeaderboardLive: true },
      ],
    })
      .select('name college slug status date publicLoginLive publicLeaderboardLive')
      .sort({ college: 1, date: -1 })
      .lean();

    const login = [];
    const leaderboard = [];
    for (const ev of events) {
      const row = {
        id: String(ev._id),
        name: ev.name,
        college: ev.college,
        slug: ev.slug,
        status: ev.status,
        date: ev.date,
      };
      if (ev.publicLoginLive) login.push(row);
      if (ev.publicLeaderboardLive) leaderboard.push(row);
    }

    return res.json({
      success: true,
      data: {
        login,
        leaderboard,
        showLogin: login.length > 0,
        showLeaderboard: leaderboard.length > 0,
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
    if (
      req.user?.huntTeamId
      && String(req.user.huntTeamId) !== String(team._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'This login is for a different team. Open your own team link.',
        code: 'WRONG_TEAM_SESSION',
      });
    }
    const isLeader = team.isLeader(userId);
    const progress = await buildPlayerProgress(team, userId, isLeader);
    return res.json({
      success: true,
      data: {
        team: publicTeamView(progress.team, { isLeader, start: progress.start, userId }),
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
        team: publicTeamView(progress.team, { isLeader, start: progress.start, userId }),
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
        team: publicTeamView(progress.team, { isLeader: req.isHuntLeader, start: progress.start, userId: req.user.userId }),
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

async function confirmStation(req, res, next) {
  try {
    const { confirmStationClaim } = require('../services/checkpointService');
    const teamCode = req.body?.teamCode;
    const stage = String(req.huntTeam.currentStage || '');
    let checkpointId = req.body?.checkpointId;
    if (!checkpointId) {
      if (stage === 'CLUE_1_COMPLETED') checkpointId = req.huntTeam.firstCheckpointId;
      else if (['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'].includes(stage)) {
        checkpointId = req.huntTeam.secondCheckpointId;
      } else if (['CLUE_3_COMPLETED', 'CLUE_3_FAILED'].includes(stage)) {
        checkpointId = req.huntTeam.thirdCheckpointId;
      }
    }
    if (!checkpointId) {
      return res.status(400).json({
        success: false,
        message: 'No station to claim for this stage — scan the QR first.',
        code: 'CHECKPOINT_REQUIRED',
      });
    }
    if (!teamCode) {
      return res.status(400).json({ success: false, message: 'Team code required' });
    }
    const result = await confirmStationClaim({
      team: req.huntTeam,
      userId: req.user.userId,
      teamCode,
      checkpointId,
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
        team: publicTeamView(progress.team, { isLeader: req.isHuntLeader, start: progress.start, userId: req.user.userId }),
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

    const team = await CampusHuntTeam.findById(req.huntTeam._id);
    const progress = await buildPlayerProgress(team, req.user.userId, req.isHuntLeader);
    return res.json({
      success: true,
      data: {
        ...result,
        team: publicTeamView(progress.team, { isLeader: req.isHuntLeader, start: progress.start, userId: req.user.userId }),
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
    const progress = await buildPlayerProgress(team, req.user.userId, req.isHuntLeader);
    return res.json({
      success: true,
      data: {
        ...result,
        team: publicTeamView(progress.team, { isLeader: req.isHuntLeader, start: progress.start, userId: req.user.userId }),
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
    // Draft events stay usable for team login / playtest from the admin dashboard.
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    return res.json({ success: true, data: { event } });
  } catch (err) {
    return next(err);
  }
}

/**
 * Public team shell only — no emails, stage, or roster (anti-enumeration).
 * Names unlock after password via POST …/unlock.
 * GET /events/by-slug/:slug/teams/:teamCode
 */
async function getTeamLoginCard(req, res, next) {
  try {
    const { normalizeTeamCode } = require('../utils/teamCode');
    const event = await CampusHuntEvent.findOne({ slug: req.params.slug })
      .select('name college slug status');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const teamCode = normalizeTeamCode(req.params.teamCode);
    if (!teamCode) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const teamDoc = await CampusHuntTeam.findOne({
      eventId: event._id,
      teamCode,
    }).select('teamCode teamName competitionPhase').lean();

    if (!teamDoc) {
      return res.status(404).json({
        success: false,
        message: `Team ${teamCode} not found. Use codes like CC001.`,
      });
    }

    const isFinale = teamDoc.competitionPhase === 'finale';

    return res.json({
      success: true,
      data: {
        event: {
          id: String(event._id),
          name: event.name,
          college: event.college,
          slug: event.slug,
        },
        team: {
          teamCode: teamDoc.teamCode,
          teamName: teamDoc.teamName,
          competitionPhase: teamDoc.competitionPhase || 'round1',
          roundLabel: isFinale ? 'Finals round' : 'Round 1',
          phaseGreeting: isFinale
            ? 'Congratulations — your team is in the Finals.'
            : null,
          playPath: `/campus-hunt/${event.slug}/play`,
          loginPath: `/campus-hunt/${event.slug}/team/${teamDoc.teamCode}`,
          // Roster intentionally omitted — unlock with password
          members: [],
          needsUnlock: true,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

function buildPublicRosterMembers(teamDoc) {
  const pack = teamDoc.accessPack || {};
  const scanners = (teamDoc.memberNames || []).map((name, idx) => {
    const stored = pack.scanners?.[idx] || {};
    return {
      slot: idx + 1,
      name: stored.name || name || `Player ${idx + 1}`,
      role: 'scanner',
    };
  });
  while (scanners.length < 3) {
    scanners.push({
      slot: scanners.length + 1,
      name: `Player ${scanners.length + 1}`,
      role: 'scanner',
    });
  }
  return [
    {
      slot: 0,
      name: pack.leader?.name || teamDoc.leaderName || 'Leader',
      role: 'leader',
    },
    ...scanners.slice(0, 3),
  ];
}

/**
 * Password gate → reveal teammate names only (no emails / stage).
 * POST /events/by-slug/:slug/teams/:teamCode/unlock  { password }
 */
async function unlockTeamRoster(req, res, next) {
  try {
    const {
      readTeamPassword,
      passwordsMatch,
      isCredentialVaultUnreadable,
    } = require('../services/teamGateService');
    const { normalizeTeamCode } = require('../utils/teamCode');
    const password = String(req.body?.password || '').trim();
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password required' });
    }

    const event = await CampusHuntEvent.findOne({ slug: req.params.slug })
      .select('_id slug name college');
    if (!event) {
      return res.status(401).json({ success: false, message: 'Wrong team or password' });
    }

    const teamCode = normalizeTeamCode(req.params.teamCode);
    const team = await CampusHuntTeam.findOne({
      eventId: event._id,
      teamCode,
    }).select(
      '+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword '
      + '+accessPack.sharedScannerPassword +accessPack.leader.encryptedPassword '
      + '+accessPack.leader.password teamCode teamName leaderName memberNames '
      + 'accessPack.leader.name accessPack.scanners',
    );

    if (!team) {
      return res.status(401).json({ success: false, message: 'Wrong team or password' });
    }

    if (isCredentialVaultUnreadable(team)) {
      return res.status(409).json({
        success: false,
        message: 'Team password vault needs reset. Organizer: set this team’s password again in Admin → Teams.',
        code: 'CREDENTIAL_VAULT_RESET_REQUIRED',
      });
    }

    const expected = readTeamPassword(team);
    if (!passwordsMatch(password, expected)) {
      return res.status(401).json({ success: false, message: 'Wrong team or password' });
    }

    return res.json({
      success: true,
      data: {
        team: {
          teamCode: team.teamCode,
          teamName: team.teamName,
          playPath: `/campus-hunt/${event.slug}/play`,
          loginPath: `/campus-hunt/${event.slug}/team/${team.teamCode}`,
          members: buildPublicRosterMembers(team),
          roles: {
            leader: 'Sees Clue 1 and submits all answers. Everyone still scans.',
            player: 'Helps on Clue 2–4. Scans station cards. No Clue 1 text.',
          },
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
    const { normalizeTeamCode } = require('../utils/teamCode');
    const email = String(req.body?.email || '').trim().toLowerCase();
    const event = await CampusHuntEvent.findOne({ slug: req.params.slug }).select('_id status');
    if (!event) {
      return res.status(401).json({ success: false, message: 'Invalid team credentials' });
    }

    const team = await CampusHuntTeam.findOne({
      eventId: event._id,
      teamCode: normalizeTeamCode(req.params.teamCode),
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

/**
 * Simple team entry: team code (URL) + shared password + who you are.
 * Admin sets the one password; leader and all players use it.
 */
async function enterTeamAsMember(req, res, next) {
  try {
    const User = require('../../../model/usermodel');
    const jwt = require('jsonwebtoken');
    const { getJwtSecret } = require('../../../config/jwtSecret');
    const {
      readTeamPassword,
      passwordsMatch,
      resolveRosterUserId,
      isCredentialVaultUnreadable,
    } = require('../services/teamGateService');
    const { normalizeTeamCode } = require('../utils/teamCode');

    const password = String(req.body?.password || '').trim();
    const role = String(req.body?.role || '').trim().toLowerCase();
    const slot = Number(req.body?.slot || 0);

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password required' });
    }

    const event = await CampusHuntEvent.findOne({ slug: req.params.slug })
      .select('_id status name slug college');
    if (!event) {
      return res.status(401).json({ success: false, message: 'Invalid team credentials' });
    }

    const teamCode = normalizeTeamCode(req.params.teamCode);
    if (!teamCode) {
      return res.status(401).json({ success: false, message: 'Invalid team credentials' });
    }

    const team = await CampusHuntTeam.findOne({
      eventId: event._id,
      teamCode,
    }).select(
      '+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword '
      + '+accessPack.sharedScannerPassword +accessPack.leader.encryptedPassword '
      + '+accessPack.leader.password leaderUserId memberUserIds teamCode teamName '
      + 'leaderName memberNames accessPack.leader.name accessPack.scanners.name '
      + 'accessPack.scanners.loginEmail accessPack.leader.loginEmail',
    );

    if (!team) {
      return res.status(401).json({ success: false, message: 'Invalid team credentials' });
    }

    if (isCredentialVaultUnreadable(team)) {
      return res.status(409).json({
        success: false,
        message: 'Team password vault needs reset. Organizer: set this team’s password again in Admin → Teams.',
        code: 'CREDENTIAL_VAULT_RESET_REQUIRED',
      });
    }

    const expected = readTeamPassword(team);
    if (!passwordsMatch(password, expected)) {
      return res.status(401).json({ success: false, message: 'Wrong team code or password' });
    }

    const userId = resolveRosterUserId(team, role === 'scanner' ? 'player' : role, slot);
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      return res.status(401).json({ success: false, message: 'That player account is missing' });
    }

    const token = jwt.sign({
      userId: user._id,
      huntTeamId: String(team._id),
      huntEventId: String(event._id),
      huntRole: role === 'leader' ? 'leader' : 'player',
    }, getJwtSecret(), {
      expiresIn: process.env.USER_JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '30d',
    });

    const safeUser = {
      _id: user._id,
      id: String(user._id),
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'user',
    };

    const teamPayload = {
      id: String(team._id),
      teamCode: team.teamCode,
      teamName: team.teamName,
      role: role === 'leader' ? 'leader' : 'player',
      isLeader: role === 'leader',
      myName: role === 'leader'
        ? (team.leaderName || team.accessPack?.leader?.name || 'Leader')
        : (
          team.memberNames?.[Math.max(0, slot - 1)]
          || team.accessPack?.scanners?.[Math.max(0, slot - 1)]?.name
          || `Player ${slot}`
        ),
      playPath: `/campus-hunt/${event.slug}/play`,
      sees: role === 'leader'
        ? 'Clue 1 + submit answers + scan'
        : 'Scan + help on Clue 2–4 (no Clue 1 text)',
    };

    return res.json({
      success: true,
      isAdmin: false,
      message: 'Login successful',
      data: {
        user: safeUser,
        token,
        team: teamPayload,
      },
      user: safeUser,
      token,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

/** Local/dev only: force current pending checkpoint — requires 4 distinct members. */
async function forceUnlockClue2(req, res, next) {
  try {
    // Never in production. Staging/local also need CAMPUS_HUNT_DEV_CHEATS=1.
    if (
      process.env.NODE_ENV === 'production'
      || String(process.env.CAMPUS_HUNT_DEV_CHEATS || '') !== '1'
    ) {
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
        team: publicTeamView(progress.team, { isLeader: req.isHuntLeader, start: progress.start, userId: req.user.userId }),
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
        team: publicTeamView(progress.team, { isLeader: true, userId: req.user.userId }),
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
  listProfileEntries,
  getPublicLeaderboard,
  getMyTeam,
  getTeamProgress,
  submitChallengeAnswer,
  submitClue1,
  requestChallengeHint,
  getLeaderboard,
  getEventBySlug,
  getTeamLoginCard,
  unlockTeamRoster,
  loginTeamMember,
  enterTeamAsMember,
  scanStation,
  confirmStation,
  rewindStep,
  forceUnlockClue2,
};
