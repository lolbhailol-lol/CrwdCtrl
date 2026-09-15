const { findTeamForUser } = require('../services/teamService');
const {
  bootstrapFinale,
  getFinaleRound,
  getOrCreateMissionConfig,
  resetFinaleForRetest,
} = require('../services/finale/finaleBootstrapService');
const {
  promoteTop5FromR1,
  promoteManualPick,
  promoteDemoFinalists,
  setFinalePlayingTeams,
  listEntries,
  listPromotionCandidates,
} = require('../services/finale/finalePromotionService');
const {
  buildFinaleLeaderboard,
  startFinaleRound,
  lockFinaleRound,
  finalizeFinaleLeaderboard,
} = require('../services/finale/finaleLeaderboardService');
const { listGridSessionsForEvent } = require('../services/grid/gridSessionService');
const { listMissionAssignments } = require('../services/finale/finaleAssignmentService');
const {
  previewFinaleSchedule,
  generateFinaleSchedule,
  lockFinaleSchedule,
  getFinaleLiveDashboard,
  releaseFinaleTeam,
  setFinaleReleasesPaused,
  setFinaleMeetLocationPaused,
  releaseDueFinaleTeams,
} = require('../services/finale/finaleReleaseService');
const {
  buildBoardPayload,
  startMission,
  submitMissionStep,
  abandonMission,
  stopTeam,
  resumeTeam,
  playtestCompleteMission,
  playtestAdvanceMissionStep,
  playtestResetFinaleTeam,
  loadEntryForTeam,
} = require('../services/finale/finaleMissionService');
const { publishTeamProgress } = require('../services/teamProgressBus');

function notifyFinaleTeam(teamId) {
  if (teamId) publishTeamProgress(teamId);
}
const CampusHuntEvent = require('../models/CampusHuntEvent');
const { buildPlayerRoundsHub, assertRoundPlayable } = require('../services/playerRoundAccess');

function actorFromReq(req) {
  return {
    actorType: 'admin',
    actorId: req.user?.userId || req.user?.id || 'admin',
  };
}

function playerActor(req) {
  return {
    actorType: 'player',
    actorId: req.user?.userId,
  };
}

// --- Admin ---

async function bootstrap(req, res, next) {
  try {
    const { round, config } = await bootstrapFinale({
      eventId: req.params.eventId,
      actor: actorFromReq(req),
    });
    return res.json({
      success: true,
      data: { round, config },
    });
  } catch (err) {
    return next(err);
  }
}

async function getConfig(req, res, next) {
  try {
    const round = await getFinaleRound(req.params.eventId);
    const config = await getOrCreateMissionConfig(req.params.eventId, round?._id);
    return res.json({ success: true, data: { round, config } });
  } catch (err) {
    return next(err);
  }
}

async function patchConfig(req, res, next) {
  try {
    const config = await getOrCreateMissionConfig(req.params.eventId);
    const body = req.body || {};
    if (body.startingScore != null) config.startingScore = Number(body.startingScore);
    if (body.durationMinutes != null) config.durationMinutes = Number(body.durationMinutes);
    if (body.missionDurationMinutes != null) {
      config.missionDurationMinutes = Number(body.missionDurationMinutes);
    }
    if (body.intelHunt) {
      config.intelHunt = { ...(config.intelHunt?.toObject?.() || config.intelHunt || {}), ...body.intelHunt };
      config.markModified('intelHunt');
    }
    if (body.borrowedDevice || body.fieldTerminal) {
      const incoming = body.fieldTerminal || body.borrowedDevice;
      const merged = {
        ...(config.fieldTerminal?.toObject?.() || config.fieldTerminal
          || config.borrowedDevice?.toObject?.() || config.borrowedDevice || {}),
        ...incoming,
      };
      config.fieldTerminal = merged;
      config.borrowedDevice = merged; // keep legacy field in sync
      config.markModified('fieldTerminal');
      config.markModified('borrowedDevice');
    }
    if (body.lockbox) {
      config.lockbox = {
        ...(config.lockbox?.toObject?.() || config.lockbox || {}),
        ...body.lockbox,
      };
      config.markModified('lockbox');
    }
    if (body.blackout) {
      config.blackout = {
        ...(config.blackout?.toObject?.() || config.blackout || {}),
        ...body.blackout,
      };
      config.markModified('blackout');
    }
    if (Array.isArray(body.missions)) {
      const byId = new Map(
        (config.missions || []).map((m) => [m.id === 'borrowed_device' ? 'field_terminal' : m.id, m]),
      );
      for (const row of body.missions) {
        if (!row?.id) continue;
        const id = row.id === 'borrowed_device' ? 'field_terminal' : row.id;
        const prev = byId.get(id) || { id };
        byId.set(id, {
          ...(prev.toObject?.() || prev),
          ...row,
          id,
        });
      }
      // Keep board order from FINALE_MISSION_BOARD / existing synced order
      const ordered = (config.missions || []).map((m) => {
        const id = m.id === 'borrowed_device' ? 'field_terminal' : m.id;
        return byId.get(id) || m;
      });
      // Append any new ids not already present
      for (const [id, row] of byId) {
        if (!ordered.some((m) => (m.id === 'borrowed_device' ? 'field_terminal' : m.id) === id)) {
          ordered.push(row);
        }
      }
      config.missions = ordered;
      config.markModified('missions');
    }
    await config.save();
    return res.json({ success: true, data: { config } });
  } catch (err) {
    return next(err);
  }
}

async function promoteAuto(req, res, next) {
  try {
    const result = await promoteTop5FromR1({
      eventId: req.params.eventId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function promoteManual(req, res, next) {
  try {
    const result = await promoteManualPick({
      eventId: req.params.eventId,
      teamIds: req.body?.teamIds || [],
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function promoteDemo(req, res, next) {
  try {
    const result = await promoteDemoFinalists({
      eventId: req.params.eventId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

/** Dry-run / custom: pick exact teams that play Finale (updates mission roster). */
async function promoteSelected(req, res, next) {
  try {
    const result = await setFinalePlayingTeams({
      eventId: req.params.eventId,
      teamIds: req.body?.teamIds || [],
      replace: req.body?.replace !== false,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function getEntries(req, res, next) {
  try {
    const entries = await listEntries(req.params.eventId);
    const round = await getFinaleRound(req.params.eventId);
    return res.json({ success: true, data: { entries, round } });
  } catch (err) {
    return next(err);
  }
}

async function getCandidates(req, res, next) {
  try {
    const candidates = await listPromotionCandidates(req.params.eventId);
    return res.json({ success: true, data: { candidates } });
  } catch (err) {
    return next(err);
  }
}

async function startFinale(req, res, next) {
  try {
    const round = await startFinaleRound({
      roundId: req.params.roundId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data: { round } });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

async function lockFinale(req, res, next) {
  try {
    const result = await lockFinaleRound({
      roundId: req.params.roundId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

async function finalizeFinale(req, res, next) {
  try {
    const result = await finalizeFinaleLeaderboard({
      roundId: req.params.roundId,
      actor: actorFromReq(req),
      confirmLock: req.body?.confirmLock === true,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

async function getGridSessions(req, res, next) {
  try {
    const sessions = await listGridSessionsForEvent(req.params.eventId);
    return res.json({ success: true, data: { sessions } });
  } catch (err) {
    return next(err);
  }
}

async function getMissionAssignments(req, res, next) {
  try {
    const data = await listMissionAssignments(req.params.eventId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function previewSchedule(req, res, next) {
  try {
    const data = await previewFinaleSchedule({
      eventId: req.params.eventId,
      startsAt: req.body?.startsAt,
      releaseIntervalMinutes: req.body?.releaseIntervalMinutes,
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function generateSchedule(req, res, next) {
  try {
    const data = await generateFinaleSchedule({
      eventId: req.params.eventId,
      startsAt: req.body?.startsAt,
      releaseIntervalMinutes: req.body?.releaseIntervalMinutes,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function lockSchedule(req, res, next) {
  try {
    const data = await lockFinaleSchedule({
      eventId: req.params.eventId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function getLiveDashboard(req, res, next) {
  try {
    const data = await getFinaleLiveDashboard(req.params.eventId);
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function releaseTeam(req, res, next) {
  try {
    const entry = await releaseFinaleTeam({
      eventId: req.params.eventId,
      teamId: req.params.teamId,
      actor: actorFromReq(req),
    });
    notifyFinaleTeam(req.params.teamId);
    return res.json({ success: true, data: { entry } });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function adminStopFinaleTeam(req, res, next) {
  try {
    const data = await stopTeam({
      eventId: req.params.eventId,
      teamId: req.params.teamId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function adminResumeFinaleTeam(req, res, next) {
  try {
    const data = await resumeTeam({
      eventId: req.params.eventId,
      teamId: req.params.teamId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function adminPlaytestCompleteFinaleMission(req, res, next) {
  try {
    const missionId = req.body?.missionId || req.params.missionId;
    const data = await playtestCompleteMission({
      eventId: req.params.eventId,
      teamId: req.params.teamId,
      missionId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function adminPlaytestAdvanceFinaleMission(req, res, next) {
  try {
    const missionId = req.body?.missionId || req.params.missionId;
    const task = req.body?.task || 'next';
    const data = await playtestAdvanceMissionStep({
      eventId: req.params.eventId,
      teamId: req.params.teamId,
      missionId,
      task,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function adminPlaytestResetFinaleTeam(req, res, next) {
  try {
    const data = await playtestResetFinaleTeam({
      eventId: req.params.eventId,
      teamId: req.params.teamId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function adminResetFinaleForRetest(req, res, next) {
  try {
    const keepLive = Boolean(req.body?.keepLive);
    const data = await resetFinaleForRetest({
      eventId: req.params.eventId,
      actor: actorFromReq(req),
      keepLive,
    });
    return res.json({
      success: true,
      data,
      message: data.keepLive
        ? 'All finalists wiped — Finals still live. Release teams again.'
        : 'Finals reset — Schedule → Generate → Lock → Start again.',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function setReleasesPaused(req, res, next) {
  try {
    let paused;
    if (req.body?.paused != null) paused = Boolean(req.body.paused);
    else paused = String(req.path || '').endsWith('/pause');
    const round = await setFinaleReleasesPaused({
      eventId: req.params.eventId,
      paused,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data: { round } });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function setMeetPaused(req, res, next) {
  try {
    const paused = req.body?.paused != null
      ? Boolean(req.body.paused)
      : req.path.includes('pause');
    const data = await setFinaleMeetLocationPaused({
      eventId: req.params.eventId,
      meetLocationCode: req.params.meetCode,
      paused,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function syncReleases(req, res, next) {
  try {
    const data = await releaseDueFinaleTeams({
      eventId: req.params.eventId,
      actor: actorFromReq(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function getFinaleLeaderboardAdmin(req, res, next) {
  try {
    const leaderboard = await buildFinaleLeaderboard(req.params.eventId);
    const round = await getFinaleRound(req.params.eventId);
    return res.json({ success: true, data: { leaderboard, round } });
  } catch (err) {
    return next(err);
  }
}

// --- Player ---

async function getFinaleMe(req, res, next) {
  try {
    const team = req.huntTeam;
    const event = await CampusHuntEvent.findById(team.eventId)
      .select('playerRoundAccess')
      .lean();
    const hub = buildPlayerRoundsHub({
      event,
      team,
      hasFinaleEntry: Boolean(team.finaleEntryId),
    });
    assertRoundPlayable(hub, 'finale');

    const data = await buildBoardPayload({
      eventId: team.eventId,
      teamId: team._id,
      userId: req.user.userId,
      isLeader: req.isHuntLeader,
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function startFinaleMission(req, res, next) {
  try {
    const team = req.huntTeam;
    const event = await CampusHuntEvent.findById(team.eventId)
      .select('playerRoundAccess')
      .lean();
    const hub = buildPlayerRoundsHub({
      event,
      team,
      hasFinaleEntry: Boolean(team.finaleEntryId),
    });
    assertRoundPlayable(hub, 'finale');

    const data = await startMission({
      eventId: team.eventId,
      teamId: team._id,
      missionId: req.params.missionId,
      userId: req.user.userId,
      actor: playerActor(req),
    });
    notifyFinaleTeam(team._id);
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function submitFinaleMission(req, res, next) {
  try {
    const team = req.huntTeam;
    const userId = req.user.userId;
    // Recompute from roster (requireTeamMember also sets this — double-check)
    const isLeader = Boolean(team?.isLeader?.(userId) ?? req.isHuntLeader);
    const data = await submitMissionStep({
      eventId: team.eventId,
      teamId: team._id,
      missionId: req.params.missionId,
      answer: req.body?.answer,
      userId,
      isLeader,
      actor: playerActor(req),
    });
    notifyFinaleTeam(team._id);
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function abandonFinaleMission(req, res, next) {
  try {
    const team = req.huntTeam;
    const data = await abandonMission({
      eventId: team.eventId,
      teamId: team._id,
      userId: req.user.userId,
      actor: playerActor(req),
    });
    notifyFinaleTeam(team._id);
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function stopFinaleTeam(req, res, next) {
  try {
    const team = req.huntTeam;
    const data = await stopTeam({
      eventId: team.eventId,
      teamId: team._id,
      actor: playerActor(req),
    });
    notifyFinaleTeam(team._id);
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

async function getFinaleLeaderboardPublic(req, res, next) {
  try {
    const CampusHuntEvent = require('../models/CampusHuntEvent');
    const event = await CampusHuntEvent.findById(req.params.eventId);
    const round = await getFinaleRound(req.params.eventId);
    const visible = event?.publicFinaleLeaderboardLive
      || round?.status === 'finalized'
      || round?.status === 'locked';
    if (!visible) {
      return res.status(403).json({ success: false, message: 'Finale leaderboard not public yet' });
    }
    const leaderboard = await buildFinaleLeaderboard(req.params.eventId);
    return res.json({
      success: true,
      data: { leaderboard, round, serverTime: new Date().toISOString() },
    });
  } catch (err) {
    return next(err);
  }
}

async function loadHuntTeamFromEvent(req, res, next) {
  try {
    const eventId = req.params.eventId;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
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
        message: 'This login is for a different team.',
        code: 'WRONG_TEAM_SESSION',
      });
    }
    req.huntTeam = team;
    req.isHuntLeader = team.isLeader(userId);
    return next();
  } catch (err) {
    return next(err);
  }
}

async function requireFinaleParticipant(req, res, next) {
  try {
    if (!req.huntTeam) {
      return res.status(500).json({ success: false, message: 'Team context missing' });
    }
    if (req.huntTeam.competitionPhase !== 'finale') {
      return res.status(403).json({
        success: false,
        message: 'Team is not in the Finale phase.',
        code: 'NOT_FINALE_PARTICIPANT',
      });
    }
    await loadEntryForTeam(req.huntTeam.eventId, req.huntTeam._id);
    return next();
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message, code: err.code });
    }
    return next(err);
  }
}

module.exports = {
  bootstrap,
  getConfig,
  patchConfig,
  promoteAuto,
  promoteManual,
  promoteDemo,
  promoteSelected,
  getEntries,
  getCandidates,
  startFinale,
  lockFinale,
  finalizeFinale,
  getGridSessions,
  getMissionAssignments,
  previewSchedule,
  generateSchedule,
  lockSchedule,
  getLiveDashboard,
  releaseTeam,
  adminStopFinaleTeam,
  adminResumeFinaleTeam,
  adminPlaytestCompleteFinaleMission,
  adminPlaytestAdvanceFinaleMission,
  adminPlaytestResetFinaleTeam,
  adminResetFinaleForRetest,
  setReleasesPaused,
  setMeetPaused,
  syncReleases,
  getFinaleLeaderboardAdmin,
  getFinaleMe,
  startFinaleMission,
  submitFinaleMission,
  abandonFinaleMission,
  stopFinaleTeam,
  getFinaleLeaderboardPublic,
  loadHuntTeamFromEvent,
  requireFinaleParticipant,
};
