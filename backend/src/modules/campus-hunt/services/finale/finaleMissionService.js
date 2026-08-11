const CampusHuntFinaleEntry = require('../../models/CampusHuntFinaleEntry');
const CampusHuntFinaleMissionRun = require('../../models/CampusHuntFinaleMissionRun');
const CampusHuntTeam = require('../../models/CampusHuntTeam');
const { getHandler, missionMeta, isMissionPlayable } = require('../../finale/missions/registry');
const { isFieldTerminalMission } = require('../../finale/missions/fieldTerminal');
const { getFinaleRound, getOrCreateMissionConfig } = require('./finaleBootstrapService');
const { isRoundClosed, remainingMs } = require('../timerService');
const { writeAudit } = require('../auditService');
const { createGridSession, validateCompletionCode, claimCompletionCode, expireGridSessionForRun } = require('../grid/gridSessionService');
const {
  assignIntelLocations,
  missionExpiresAt,
  isMissionTimedOut,
  missionTimeRemainingMs,
} = require('./intelLocationService');
const blackout = require('../../finale/missions/blackout');
const lockbox = require('../../finale/missions/lockbox');
const { assignLockboxKey, assignLockboxCode, findResumableLockboxRun, hasActiveAssignmentConflict } = require('./lockboxKeyService');
const {
  releaseDueFinaleTeams,
  isEntryReleased,
} = require('./finaleReleaseService');
const { FINALE_DEFAULTS, FINALE_MISSION_IDS } = require('../../constants');
const { sanitizePublicMissionState } = require('./finalePublicState');

function seatForUser(team, userId) {
  if (!team || !userId) return -1;
  if (typeof team.isLeader === 'function' ? team.isLeader(userId) : String(team.leaderUserId) === String(userId)) {
    return 0;
  }
  const idx = (team.memberUserIds || []).findIndex((id) => String(id) === String(userId));
  return idx >= 0 ? idx + 1 : -1;
}

function finaleError(message, code, status = 409) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function isMissionCompleted(entry, missionId) {
  const done = entry.completedMissionIds || [];
  if (isFieldTerminalMission(missionId)) {
    return done.some((id) => isFieldTerminalMission(id));
  }
  return done.includes(String(missionId || ''));
}

function isSameMission(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return isFieldTerminalMission(a) && isFieldTerminalMission(b);
}

/** Clear activeMission* when the run is missing or no longer active (common after failed starts / renames). */
async function healStaleActiveMission(entry) {
  if (!entry?.activeMissionId && !entry?.activeMissionRunId) {
    return { entry, activeRun: null, healed: false };
  }

  let activeRun = null;
  if (entry.activeMissionRunId) {
    activeRun = await CampusHuntFinaleMissionRun.findById(entry.activeMissionRunId);
  }

  if (activeRun && activeRun.status === 'active') {
    return { entry, activeRun, healed: false };
  }

  entry.activeMissionId = null;
  entry.activeMissionRunId = null;
  await entry.save();
  return { entry, activeRun: null, healed: true };
}

async function loadEntryForTeam(eventId, teamId) {
  const entry = await CampusHuntFinaleEntry.findOne({ eventId, teamId });
  if (!entry) {
    throw finaleError('Team is not a finale participant.', 'NOT_FINALE_PARTICIPANT', 403);
  }
  return entry;
}

/** Avoid running wave-release on every board poll/submit — once per event every 12s. */
const releaseDueThrottleMs = 12000;
const releaseDueLastAt = new Map();

async function maybeReleaseDueTeams(eventId, { force = false, actorId = 'board' } = {}) {
  const key = String(eventId);
  const now = Date.now();
  if (!force) {
    const last = releaseDueLastAt.get(key) || 0;
    if (now - last < releaseDueThrottleMs) return false;
  }
  releaseDueLastAt.set(key, now);
  await releaseDueFinaleTeams({
    eventId,
    actor: { actorType: 'system', actorId },
  });
  return true;
}

async function buildBoardPayload({
  eventId,
  teamId,
  userId,
  isLeader,
  skipAutoRelease = false,
}) {
  const [entry, round, config, team] = await Promise.all([
    loadEntryForTeam(eventId, teamId),
    getFinaleRound(eventId),
    getOrCreateMissionConfig(eventId),
    CampusHuntTeam.findById(teamId).select('leaderUserId memberUserIds'),
  ]);
  const seat = seatForUser(team, userId);

  if (round?.status === 'live' && !skipAutoRelease) {
    const didRelease = await maybeReleaseDueTeams(eventId, { actorId: 'board' });
    if (didRelease) {
      const fresh = await CampusHuntFinaleEntry.findById(entry._id);
      if (fresh) {
        entry.releasedAt = fresh.releasedAt;
        entry.status = fresh.status;
        entry.scheduledStartAt = fresh.scheduledStartAt;
        entry.meetLocationCode = fresh.meetLocationCode;
        entry.meetLocationName = fresh.meetLocationName;
      }
    }
  }

  let activeRun = null;
  if (entry.activeMissionId || entry.activeMissionRunId) {
    const healed = await healStaleActiveMission(entry);
    activeRun = healed.activeRun;
  }

  // Only the 4 live finale missions — never surface Mission 5 / legacy placeholders
  const missionRows = (config.missions || []).filter((meta) => {
    const id = meta?.id === 'borrowed_device' ? 'field_terminal' : meta?.id;
    return FINALE_MISSION_IDS.includes(id);
  });
  const missions = missionRows.map((meta) => {
    const handler = getHandler(meta.id);
    if (!handler) {
      return { id: meta.id, title: meta.title, status: 'coming_soon', points: meta.points || 0 };
    }
    return handler.getBoardCard(entry, config, meta);
  });

  const roundClosed = isRoundClosed(round);
  const timerMs = round?.endsAt ? remainingMs(round.endsAt) : null;
  const roundLive = round?.status === 'live';
  const released = isEntryReleased(entry, round, config);
  // Congrats / holding screen until Finals is live AND this team’s wave unlocks.
  // Before Start Finals (scheduled), always hold — even if a prior playtest set releasedAt.
  const waitingForRelease = !roundClosed
    && entry.status !== 'locked'
    && entry.status !== 'stopped'
    && (!roundLive || !released);

  let activeMission = null;
  if (entry.activeMissionId && activeRun?.status === 'active') {
    const handler = getHandler(entry.activeMissionId);
    if (handler) {
      const meta = missionMeta(config, entry.activeMissionId);
      const viewCtx = { userId, isLeader, seat, team };
      const playerView = handler.rebuildPlayerView
        ? handler.rebuildPlayerView(activeRun, config, viewCtx)
        : rebuildPlayerView(handler, entry, activeRun, config, viewCtx);
      activeMission = {
        missionId: isFieldTerminalMission(entry.activeMissionId)
          ? 'field_terminal'
          : entry.activeMissionId,
        title: meta.title,
        points: meta.points,
        runId: String(activeRun._id),
        state: sanitizePublicMissionState(entry.activeMissionId, activeRun.state),
        playerView,
        missionExpiresAt: activeRun.state?.missionExpiresAt || null,
        missionTimeRemainingMs: missionTimeRemainingMs(activeRun),
      };
    }
  }

  return {
    entry: {
      id: String(entry._id),
      finaleScore: entry.finaleScore,
      status: entry.status,
      completedMissionIds: (entry.completedMissionIds || []).map((id) => (
        isFieldTerminalMission(id) ? 'field_terminal' : id
      )),
      activeMissionId: entry.activeMissionId
        ? (isFieldTerminalMission(entry.activeMissionId) ? 'field_terminal' : entry.activeMissionId)
        : null,
      promotionSource: entry.promotionSource,
      stoppedAt: entry.stoppedAt,
      finaleSlot: entry.finaleSlot,
      meetLocationCode: entry.meetLocationCode,
      meetLocationName: entry.meetLocationName,
      scheduledStartAt: entry.scheduledStartAt,
      releasedAt: entry.releasedAt,
      released,
      finalScore: entry.finalScore ?? null,
    },
    round: round ? {
      id: String(round._id),
      status: round.status,
      startsAt: round.startsAt,
      endsAt: round.endsAt,
      closed: roundClosed,
      scheduleStatus: round.scheduleStatus,
      releasesPaused: Boolean(round.releasesPaused),
      label: 'Finals round',
    } : null,
    timerMs,
    missions,
    activeMission,
    isLeader,
    waitingForRelease,
    canStartMission: !roundClosed
      && released
      && round?.status === 'live'
      && entry.status !== 'locked'
      && entry.status !== 'stopped'
      && !entry.activeMissionId,
  };
}

function rebuildPlayerView(handler, entry, run, config, viewCtx = {}) {
  if (handler.rebuildPlayerView) {
    return handler.rebuildPlayerView(run, config, viewCtx);
  }
  const state = run.state || {};
  if (isFieldTerminalMission(handler.id)) {
    const device = (config.fieldTerminal || config.borrowedDevice) || {};
    const base = {
      missionId: 'field_terminal',
      step: state.step || 'grid_game',
      locationName: device.locationName || 'Field Terminal',
      instruction: device.instruction,
      gameUrl: '/campus-hunt/grid',
      accessCode: state.accessCode || null,
      leaderOnly: true,
    };
    return handler.enrichPlayerView ? handler.enrichPlayerView(base, state) : base;
  }
  return { missionId: handler.id };
}

async function startMission({ eventId, teamId, missionId, userId, actor = {} }) {
  const [entry, round, config] = await Promise.all([
    loadEntryForTeam(eventId, teamId),
    getFinaleRound(eventId),
    getOrCreateMissionConfig(eventId),
  ]);

  if (isRoundClosed(round)) {
    throw finaleError('Finale timer has ended.', 'FINALE_CLOSED');
  }
  if (round?.status !== 'live') {
    throw finaleError('Finals round has not started yet.', 'FINALE_NOT_LIVE');
  }
  await maybeReleaseDueTeams(eventId, { force: true, actorId: 'start-mission' });
  const freshEntry = await CampusHuntFinaleEntry.findById(entry._id);
  if (freshEntry) {
    entry.releasedAt = freshEntry.releasedAt;
    entry.status = freshEntry.status;
  }
  if (!isEntryReleased(entry, round, config)) {
    throw finaleError(
      'Your team is not released yet. Wait at your meet location — or ask an organizer to Release your team.',
      'NOT_RELEASED',
    );
  }
  if (entry.status === 'locked' || entry.status === 'stopped') {
    throw finaleError('Your team cannot start new missions.', 'ENTRY_STOPPED');
  }

  // Heal stale activeMission* then allow idempotent re-open of the same mission
  const healed = await healStaleActiveMission(entry);
  if (healed.activeRun && isSameMission(entry.activeMissionId, missionId)) {
    const board = await buildBoardPayload({
      eventId, teamId, userId, isLeader: true, skipAutoRelease: true,
    });
    return {
      ...board,
      activeMission: board.activeMission,
      resumed: true,
    };
  }
  if (entry.activeMissionId) {
    throw finaleError('Finish or abandon your current mission first.', 'MISSION_ACTIVE');
  }
  if (isMissionCompleted(entry, missionId)) {
    throw finaleError('Mission already completed.', 'MISSION_COMPLETED');
  }

  const meta = missionMeta(config, missionId);
  if (!isMissionPlayable(meta)) {
    throw finaleError(
      meta?.enabled === false
        ? 'This mission is turned off by organizers.'
        : 'This mission is coming soon.',
      meta?.enabled === false ? 'MISSION_DISABLED' : 'MISSION_COMING_SOON',
    );
  }

  const handler = getHandler(missionId);
  if (!handler) {
    throw finaleError('Unknown mission.', 'UNKNOWN_MISSION', 404);
  }

  let assignment = null;
  let assignedKey = null;
  let assignedCode = null;

  // Lockbox: resume abandoned run with same key/code/attempts (no farming)
  if (missionId === 'lockbox') {
    const resumable = await findResumableLockboxRun(eventId, teamId);
    if (resumable?.state?.assignedKeyId) {
      const expiresAt = missionExpiresAt(config, missionId);
      resumable.status = 'active';
      resumable.state = {
        ...(resumable.state || {}),
        missionExpiresAt: expiresAt.toISOString(),
      };
      await resumable.save();

      entry.activeMissionId = 'lockbox';
      entry.activeMissionRunId = resumable._id;
      entry.status = 'playing';
      await entry.save();

      await writeAudit({
        eventId,
        ...actor,
        action: 'finale_mission_resumed',
        targetType: 'team',
        targetId: teamId,
        after: { missionId: 'lockbox', runId: String(resumable._id) },
      });

      const board = await buildBoardPayload({
        eventId, teamId, userId, isLeader: true, skipAutoRelease: true,
      });
      return {
        ...board,
        resumed: true,
      };
    }
  }

  if (missionId === 'intel_hunt') {
    assignment = await assignIntelLocations({ eventId, config });
  }
  if (missionId === 'lockbox') {
    assignedKey = await assignLockboxKey({ eventId, config });
    assignedCode = await assignLockboxCode({ eventId, config });
  }

  const { state, playerView } = handler.startRun(entry, config, {
    assignment,
    assignedKey,
    assignedCode,
    teamId,
  });
  const expiresAt = missionExpiresAt(config, missionId);
  const initialState = {
    ...state,
    missionExpiresAt: expiresAt.toISOString(),
  };

  let run = await CampusHuntFinaleMissionRun.create({
    eventId,
    roundId: round._id,
    entryId: entry._id,
    teamId,
    missionId: isFieldTerminalMission(missionId) ? 'field_terminal' : missionId,
    status: 'active',
    state: initialState,
  });

  // Lockbox: if another active run grabbed the same key/code, reassign once
  if (missionId === 'lockbox') {
    const conflict = await hasActiveAssignmentConflict({
      eventId,
      runId: run._id,
      keyId: run.state?.assignedKeyId,
      codeId: run.state?.assignedCodeId || run.state?.assignedCode?.id,
    });
    if (conflict) {
      const freshKey = await assignLockboxKey({ eventId, config });
      const freshCode = await assignLockboxCode({ eventId, config });
      const restarted = handler.startRun(entry, config, {
        assignedKey: freshKey,
        assignedCode: freshCode,
      });
      run.state = {
        ...restarted.state,
        missionExpiresAt: expiresAt.toISOString(),
      };
      await run.save();
    }
  }

  let finalPlayerView = {
    ...playerView,
    missionExpiresAt: expiresAt.toISOString(),
  };
  const canonicalMissionId = isFieldTerminalMission(missionId) ? 'field_terminal' : missionId;

  if (isFieldTerminalMission(missionId)) {
    try {
      const gridSession = await createGridSession({
        eventId,
        teamId,
        entryId: entry._id,
        missionRunId: run._id,
        durationMinutes: config.durationMinutes || FINALE_DEFAULTS.durationMinutes,
      });
      run.state = {
        ...run.state,
        gridSessionId: String(gridSession._id),
        accessCode: gridSession.accessCode,
      };
      await run.save();
      finalPlayerView = {
        ...(handler.enrichPlayerView
          ? handler.enrichPlayerView(playerView, run.state)
          : { ...playerView, accessCode: gridSession.accessCode }),
        missionExpiresAt: expiresAt.toISOString(),
      };
    } catch (gridErr) {
      run.status = 'abandoned';
      await run.save();
      throw gridErr;
    }
  }

  entry.activeMissionId = canonicalMissionId;
  entry.activeMissionRunId = run._id;
  entry.status = 'playing';
  await entry.save();

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_mission_started',
    targetType: 'team',
    targetId: teamId,
    after: { missionId: canonicalMissionId },
  });

  return buildBoardPayload({
    eventId, teamId, userId, isLeader: true, skipAutoRelease: true,
  }).then((board) => ({
    ...board,
    activeMission: board.activeMission || {
      missionId: canonicalMissionId,
      runId: String(run._id),
      state: sanitizePublicMissionState(canonicalMissionId, run.state),
      playerView: finalPlayerView,
      missionExpiresAt: expiresAt.toISOString(),
      missionTimeRemainingMs: missionTimeRemainingMs(run),
    },
  }));
}

async function submitMissionStep({
  eventId,
  teamId,
  missionId,
  answer,
  userId,
  actor = {},
}) {
  // Authoritative leadership from roster — never trust route middleware alone
  const team = await CampusHuntTeam.findById(teamId).select('leaderUserId memberUserIds');
  if (!team) {
    throw finaleError('Team not found.', 'TEAM_NOT_FOUND', 404);
  }
  const isLeader = Boolean(team.isLeader(userId));
  const allowMemberSubmit = missionId === 'operation_blackout';
  if (!isLeader && !allowMemberSubmit) {
    throw finaleError('Only the Team Leader can submit.', 'LEADER_ONLY', 403);
  }

  const [entry, round, config] = await Promise.all([
    loadEntryForTeam(eventId, teamId),
    getFinaleRound(eventId),
    getOrCreateMissionConfig(eventId),
  ]);

  if (isRoundClosed(round)) {
    throw finaleError('Finale timer has ended.', 'FINALE_CLOSED');
  }
  if (!isSameMission(entry.activeMissionId, missionId)) {
    throw finaleError('This mission is not active.', 'WRONG_MISSION');
  }

  const run = await CampusHuntFinaleMissionRun.findById(entry.activeMissionRunId);
  if (!run || run.status !== 'active') {
    throw finaleError('No active mission run.', 'NO_ACTIVE_RUN');
  }

  if (isMissionTimedOut(run)) {
    await abandonMission({ eventId, teamId, userId, actor });
    throw finaleError(
      'Mission time is up. That attempt was cleared — start again from the board.',
      'MISSION_TIME_UP',
    );
  }

  const handler = getHandler(missionId);
  if (!handler) {
    throw finaleError('Unknown mission.', 'UNKNOWN_MISSION', 404);
  }

  const seat = seatForUser(team, userId);

  let result;
  if (isFieldTerminalMission(missionId)) {
    const gridValidation = await validateCompletionCode(answer, {
      teamId,
      missionRunId: run._id,
    });
    result = handler.submitStep(entry, run, { answer }, config, { gridValidation });
  } else if (missionId === 'lockbox') {
    result = handler.submitStep(entry, run, { answer }, config, { isLeader, seat });
  } else if (missionId === 'operation_blackout') {
    result = handler.submitStep(entry, run, { answer }, config, { isLeader, seat });
  } else {
    result = handler.submitStep(entry, run, { answer }, config);
  }

  // Apply mission penalties immediately (Blackout wrong answers)
  if (Number(result.penalty) > 0) {
    const current = Number(entry.finaleScore || 0);
    const nextScore = Math.max(0, current - Number(result.penalty));
    entry.finaleScore = nextScore;
    await CampusHuntFinaleEntry.updateOne(
      { _id: entry._id },
      { $set: { finaleScore: nextScore } },
    );
  }

  if (!result.ok) {
    run.state = result.state;
    await run.save();
    const board = await buildBoardPayload({ eventId, teamId, userId, isLeader, skipAutoRelease: true });
    return {
      ...board,
      submitResult: {
        ok: false,
        complete: false,
        message: result.playerView?.message,
        playerView: result.playerView,
        pointsAwarded: 0,
        penalty: result.penalty || 0,
      },
    };
  }

  if (result.complete && isFieldTerminalMission(missionId)) {
    const claim = await claimCompletionCode(answer, { teamId, missionRunId: run._id });
    if (!claim.ok) {
      run.state = { ...result.state, attempts: Math.max(0, (result.state?.attempts || 1) - 1) };
      await run.save();
      const board = await buildBoardPayload({ eventId, teamId, userId, isLeader, skipAutoRelease: true });
      return {
        ...board,
        submitResult: {
          ok: false,
          complete: false,
          message: claim.message || 'Completion code could not be claimed. Try again.',
          playerView: {
            missionId: 'field_terminal',
            step: 'grid_game',
            message: claim.message,
            accessCode: run.state?.accessCode,
          },
          pointsAwarded: 0,
        },
      };
    }
  }

  if (!result.complete) {
    run.state = result.state;
    await run.save();
    const board = await buildBoardPayload({ eventId, teamId, userId, isLeader, skipAutoRelease: true });
    return {
      ...board,
      submitResult: {
        ok: result.ok,
        complete: false,
        message: result.playerView?.message,
        playerView: result.playerView,
        pointsAwarded: 0,
      },
    };
  }

  // Atomic complete — only one concurrent submit may win the score award
  const points = result.points || 0;
  const completedRun = await CampusHuntFinaleMissionRun.findOneAndUpdate(
    { _id: run._id, status: 'active' },
    {
      $set: {
        status: 'completed',
        pointsAwarded: points,
        completedAt: new Date(),
        state: result.state,
      },
    },
    { new: true },
  );

  if (!completedRun) {
    const board = await buildBoardPayload({ eventId, teamId, userId, isLeader, skipAutoRelease: true });
    return {
      ...board,
      submitResult: {
        ok: true,
        complete: true,
        message: result.playerView?.message || 'Mission already completed.',
        playerView: result.playerView,
        pointsAwarded: 0,
      },
    };
  }

  const alreadyDone = isMissionCompleted(entry, missionId);
  const canonicalDoneId = isFieldTerminalMission(missionId) ? 'field_terminal' : missionId;

  if (!alreadyDone) {
    await CampusHuntFinaleEntry.findOneAndUpdate(
      {
        _id: entry._id,
        completedMissionIds: { $nin: isFieldTerminalMission(missionId)
          ? ['field_terminal', 'borrowed_device']
          : [missionId] },
      },
      {
        $inc: { finaleScore: points },
        $addToSet: { completedMissionIds: canonicalDoneId },
        $set: {
          activeMissionId: null,
          activeMissionRunId: null,
        },
      },
    );
  } else {
    await CampusHuntFinaleEntry.updateOne(
      { _id: entry._id },
      {
        $set: {
          activeMissionId: null,
          activeMissionRunId: null,
        },
      },
    );
  }

  // Reload entry score for audit
  const freshEntry = await CampusHuntFinaleEntry.findById(entry._id).select('finaleScore');

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_mission_completed',
    targetType: 'team',
    targetId: teamId,
    after: {
      missionId: canonicalDoneId,
      points: alreadyDone ? 0 : points,
      finaleScore: freshEntry?.finaleScore,
    },
  });

  const board = await buildBoardPayload({ eventId, teamId, userId, isLeader, skipAutoRelease: true });
  return {
    ...board,
    submitResult: {
      ok: true,
      complete: true,
      message: result.playerView?.message,
      playerView: result.playerView,
      pointsAwarded: alreadyDone ? 0 : points,
    },
  };
}

async function abandonMission({ eventId, teamId, userId, actor = {} }) {
  const entry = await loadEntryForTeam(eventId, teamId);
  if (!entry.activeMissionRunId) {
    return buildBoardPayload({ eventId, teamId, userId, isLeader: true, skipAutoRelease: true });
  }

  const run = await CampusHuntFinaleMissionRun.findById(entry.activeMissionRunId);
  if (run && run.status === 'active') {
    if (isFieldTerminalMission(run.missionId)) {
      await expireGridSessionForRun(run._id);
    }
    run.status = 'abandoned';
    await run.save();
  }

  entry.activeMissionId = null;
  entry.activeMissionRunId = null;
  await entry.save();

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_mission_abandoned',
    targetType: 'team',
    targetId: teamId,
  });

  return buildBoardPayload({ eventId, teamId, userId, isLeader: true, skipAutoRelease: true });
}

async function stopTeam({ eventId, teamId, actor = {} }) {
  if (await CampusHuntFinaleEntry.findOne({ eventId, teamId, activeMissionRunId: { $ne: null } })) {
    await abandonMission({ eventId, teamId, userId: null, actor });
  }

  const entry = await loadEntryForTeam(eventId, teamId);
  entry.status = 'stopped';
  entry.stoppedAt = new Date();
  entry.activeMissionId = null;
  entry.activeMissionRunId = null;
  await entry.save();

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_team_stopped',
    targetType: 'team',
    targetId: teamId,
  });

  const team = await CampusHuntTeam.findById(teamId);
  return buildBoardPayload({
    eventId,
    teamId,
    userId: team?.leaderUserId,
    isLeader: true,
    skipAutoRelease: true,
  });
}

/** Admin / playtest — reopen a stopped team so they can play again. */
async function resumeTeam({ eventId, teamId, actor = {} }) {
  const entry = await loadEntryForTeam(eventId, teamId);
  if (entry.status === 'locked') {
    throw finaleError('Finale scores are locked for this team.', 'ENTRY_LOCKED');
  }
  // Must $unset — assigning undefined + save() does not clear fields in Mongo
  await CampusHuntFinaleEntry.updateOne(
    { _id: entry._id },
    {
      $set: { status: entry.releasedAt ? 'playing' : 'eligible' },
      $unset: { stoppedAt: 1 },
    },
  );

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_team_resumed',
    targetType: 'team',
    targetId: teamId,
  });

  const team = await CampusHuntTeam.findById(teamId);
  return buildBoardPayload({
    eventId,
    teamId,
    userId: team?.leaderUserId,
    isLeader: true,
    skipAutoRelease: true,
  });
}

/**
 * Playtest cheat — force-complete Intel Hunt or Field Terminal (+points).
 * Does not require going through mission steps or grid levels.
 */
async function playtestCompleteMission({ eventId, teamId, missionId, actor = {} }) {
  const id = String(missionId || '');
  if (
    id !== 'intel_hunt'
    && id !== 'lockbox'
    && id !== 'operation_blackout'
    && !isFieldTerminalMission(id)
  ) {
    throw finaleError(
      'Playtest only supports Intel Hunt, Lockbox, Field Terminal, or Blackout.',
      'BAD_MISSION',
      400,
    );
  }

  let entry = await loadEntryForTeam(eventId, teamId);
  const round = await getFinaleRound(eventId);
  const config = await getOrCreateMissionConfig(eventId);

  if (!round) {
    throw finaleError('Finale round not bootstrapped.', 'FINALE_NOT_BOOTSTRAPPED', 400);
  }
  if (entry.status === 'locked') {
    throw finaleError('Entry is locked.', 'ENTRY_LOCKED');
  }
  if (entry.status === 'stopped') {
    await CampusHuntFinaleEntry.updateOne(
      { _id: entry._id },
      {
        $set: { status: entry.releasedAt ? 'playing' : 'eligible' },
        $unset: { stoppedAt: 1 },
      },
    );
    entry = await loadEntryForTeam(eventId, teamId);
  }

  if ((entry.completedMissionIds || []).includes(id)) {
    throw finaleError('Mission already completed.', 'MISSION_COMPLETED');
  }

  if (entry.activeMissionRunId && entry.activeMissionId !== id) {
    await abandonMission({ eventId, teamId, userId: null, actor });
    entry = await loadEntryForTeam(eventId, teamId);
  }

  const meta = missionMeta(config, id);
  const points = Number(meta.points) || 0;

  if (entry.activeMissionRunId && entry.activeMissionId === id) {
    const run = await CampusHuntFinaleMissionRun.findById(entry.activeMissionRunId);
    if (run && run.status === 'active') {
      if (isFieldTerminalMission(id)) {
        await expireGridSessionForRun(run._id);
      }
      run.status = 'completed';
      run.pointsAwarded = points;
      run.state = {
        ...(run.state || {}),
        playtestForced: true,
        step: 'done',
      };
      await run.save();
    }
  } else {
    await CampusHuntFinaleMissionRun.create({
      eventId,
      roundId: round._id,
      entryId: entry._id,
      teamId,
      missionId: id,
      status: 'completed',
      pointsAwarded: points,
      state: { playtestForced: true, step: 'done' },
    });
  }

  entry.completedMissionIds = [...(entry.completedMissionIds || []), id];
  entry.finaleScore = (entry.finaleScore || 0) + points;
  entry.activeMissionId = null;
  entry.activeMissionRunId = null;
  if (entry.releasedAt) entry.status = 'playing';
  await entry.save();

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_playtest_complete_mission',
    targetType: 'team',
    targetId: teamId,
    after: { missionId: id, points, finaleScore: entry.finaleScore },
  });

  const team = await CampusHuntTeam.findById(teamId);
  return buildBoardPayload({
    eventId,
    teamId,
    userId: team?.leaderUserId,
    isLeader: true,
    skipAutoRelease: true,
  });
}

/**
 * Playtest cheat — start mission if needed, then force-pass one task.
 * Blackout: scout|cracker|navigator|controller|next
 * Lockbox: key|code|next
 * Intel: loc1|loc2|combine|next
 * Field Terminal: complete (whole mission)
 */
async function playtestAdvanceMissionStep({
  eventId,
  teamId,
  missionId,
  task = 'next',
  actor = {},
}) {
  const id = String(missionId || '');
  if (
    id !== 'intel_hunt'
    && id !== 'lockbox'
    && id !== 'operation_blackout'
    && !isFieldTerminalMission(id)
  ) {
    throw finaleError('Unknown playtest mission.', 'BAD_MISSION', 400);
  }

  let entry = await loadEntryForTeam(eventId, teamId);
  const round = await getFinaleRound(eventId);
  const config = await getOrCreateMissionConfig(eventId);

  if (!round) {
    throw finaleError('Finale round not bootstrapped.', 'FINALE_NOT_BOOTSTRAPPED', 400);
  }
  if (entry.status === 'locked') {
    throw finaleError('Entry is locked.', 'ENTRY_LOCKED');
  }
  if (entry.status === 'stopped') {
    await CampusHuntFinaleEntry.updateOne(
      { _id: entry._id },
      {
        $set: { status: entry.releasedAt ? 'playing' : 'eligible' },
        $unset: { stoppedAt: 1 },
      },
    );
    entry = await loadEntryForTeam(eventId, teamId);
  }

  if (isMissionCompleted(entry, id)) {
    throw finaleError('Mission already completed.', 'MISSION_COMPLETED');
  }

  // Field Terminal has no sub-tasks — complete whole mission
  if (isFieldTerminalMission(id)) {
    return playtestCompleteMission({ eventId, teamId, missionId: 'field_terminal', actor });
  }

  if (entry.activeMissionRunId && !isSameMission(entry.activeMissionId, id)) {
    await abandonMission({ eventId, teamId, userId: null, actor });
    entry = await loadEntryForTeam(eventId, teamId);
  }

  let run = null;
  if (entry.activeMissionRunId && isSameMission(entry.activeMissionId, id)) {
    run = await CampusHuntFinaleMissionRun.findById(entry.activeMissionRunId);
  }

  const handler = getHandler(id);
  if (!handler) {
    throw finaleError('Unknown mission.', 'UNKNOWN_MISSION', 404);
  }

  // Ensure an active run exists
  if (!run || run.status !== 'active') {
    let assignment = null;
    let assignedKey = null;
    let assignedCode = null;
    if (id === 'intel_hunt') {
      assignment = await assignIntelLocations({ eventId, config });
    }
    if (id === 'lockbox') {
      const resumable = await findResumableLockboxRun(eventId, teamId);
      if (resumable?.state?.assignedKeyId) {
        resumable.status = 'active';
        const expiresAt = missionExpiresAt(config, id);
        resumable.state = {
          ...(resumable.state || {}),
          missionExpiresAt: expiresAt.toISOString(),
        };
        await resumable.save();
        entry.activeMissionId = 'lockbox';
        entry.activeMissionRunId = resumable._id;
        entry.status = 'playing';
        await entry.save();
        run = resumable;
      } else {
        assignedKey = await assignLockboxKey({ eventId, config });
        assignedCode = await assignLockboxCode({ eventId, config });
      }
    }

    if (!run) {
      const started = handler.startRun(entry, config, {
        assignment,
        assignedKey,
        assignedCode,
        teamId,
      });
      const expiresAt = missionExpiresAt(config, id);
      run = await CampusHuntFinaleMissionRun.create({
        eventId,
        roundId: round._id,
        entryId: entry._id,
        teamId,
        missionId: id,
        status: 'active',
        state: {
          ...started.state,
          missionExpiresAt: expiresAt.toISOString(),
          playtestStarted: true,
        },
      });
      entry.activeMissionId = id;
      entry.activeMissionRunId = run._id;
      entry.status = 'playing';
      await entry.save();
    }
  }

  let advance;
  const taskKey = String(task || 'next').toLowerCase();

  if (id === 'operation_blackout') {
    advance = blackout.playtestForceAdvance(run.state, config, { task: taskKey, teamId });
  } else if (id === 'lockbox') {
    advance = playtestAdvanceLockbox(run, config, taskKey);
  } else if (id === 'intel_hunt') {
    advance = playtestAdvanceIntel(run, config, taskKey);
  } else {
    throw finaleError('No step advance for this mission.', 'BAD_MISSION', 400);
  }

  run.state = advance.state;
  await run.save();

  if (advance.complete) {
    const points = advance.points || 0;
    const completedRun = await CampusHuntFinaleMissionRun.findOneAndUpdate(
      { _id: run._id, status: 'active' },
      {
        $set: {
          status: 'completed',
          pointsAwarded: points,
          completedAt: new Date(),
          state: advance.state,
        },
      },
      { new: true },
    );
    if (completedRun) {
      await CampusHuntFinaleEntry.findOneAndUpdate(
        {
          _id: entry._id,
          completedMissionIds: { $ne: id },
        },
        {
          $inc: { finaleScore: points },
          $addToSet: { completedMissionIds: id },
          $set: { activeMissionId: null, activeMissionRunId: null },
        },
      );
    } else {
      await CampusHuntFinaleEntry.updateOne(
        { _id: entry._id },
        { $set: { activeMissionId: null, activeMissionRunId: null } },
      );
    }
  }

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_playtest_advance_step',
    targetType: 'team',
    targetId: teamId,
    after: {
      missionId: id,
      task: taskKey,
      step: advance.step,
      complete: Boolean(advance.complete),
      points: advance.points || 0,
      message: advance.message,
    },
  });

  const team = await CampusHuntTeam.findById(teamId);
  const board = await buildBoardPayload({
    eventId,
    teamId,
    userId: team?.leaderUserId,
    isLeader: true,
    skipAutoRelease: true,
  });
  return {
    ...board,
    playtestAdvance: {
      missionId: id,
      task: taskKey,
      step: advance.step,
      complete: Boolean(advance.complete),
      pointsAwarded: advance.complete ? (advance.points || 0) : 0,
      message: advance.message,
      // Admin-only hints for testing
      accessToken: advance.state?.accessToken || null,
      route: advance.state?.route || null,
      frequency: advance.state?.frequency || null,
      intel1Fragment: advance.state?.intel1Fragment || null,
      intel2Fragment: advance.state?.intel2Fragment || null,
    },
  };
}

function playtestAdvanceLockbox(run, config, taskKey) {
  const state = { ...(run.state || {}), attempts: { key: 0, code: 0, ...(run.state?.attempts || {}) } };
  const points = lockbox.missionPoints(config);
  let target = taskKey;
  if (target === 'next') {
    target = (state.step || 'find_key') === 'find_key' ? 'key' : 'code';
  }

  if (target === 'key') {
    state.step = 'lockbox_code';
    return {
      ok: true,
      complete: false,
      points: 0,
      state,
      message: 'Lockbox Task 1 (key) forced.',
      step: state.step,
    };
  }

  if (target === 'code') {
    state.step = 'done';
    return {
      ok: true,
      complete: true,
      points,
      state,
      message: `Lockbox complete · +${points}`,
      step: 'done',
    };
  }

  const err = new Error(`Unknown Lockbox playtest task: ${target}`);
  err.status = 400;
  err.code = 'BAD_PLAYTEST_TASK';
  throw err;
}

function playtestAdvanceIntel(run, config, taskKey) {
  const state = {
    ...(run.state || {}),
    attempts: { loc1: 0, loc2: 0, combine: 0, ...(run.state?.attempts || {}) },
  };
  const assignment = state.assignment;
  if (!assignment?.location1 || !assignment?.location2) {
    const err = new Error('Intel assignment missing — start Intel first.');
    err.status = 409;
    err.code = 'INTEL_NOT_ASSIGNED';
    throw err;
  }

  let target = taskKey;
  if (target === 'next') {
    const step = state.step || 'loc1';
    if (step === 'loc1') target = 'loc1';
    else if (step === 'loc2') target = 'loc2';
    else target = 'combine';
  }

  const points = Number(missionMeta(config, 'intel_hunt').points) || 50;

  if (target === 'loc1') {
    state.step = 'loc2';
    state.intel1Fragment = assignment.location1.fragment
      || assignment.location1.acceptedAnswers?.[0]
      || 'FRAG1';
    return {
      ok: true,
      complete: false,
      points: 0,
      state,
      message: `Intel loc1 forced · ${state.intel1Fragment}`,
      step: state.step,
    };
  }

  if (target === 'loc2') {
    if (!state.intel1Fragment) {
      state.intel1Fragment = assignment.location1.fragment
        || assignment.location1.acceptedAnswers?.[0]
        || 'FRAG1';
    }
    state.step = 'combine';
    state.intel2Fragment = assignment.location2.fragment
      || assignment.location2.acceptedAnswers?.[0]
      || 'FRAG2';
    return {
      ok: true,
      complete: false,
      points: 0,
      state,
      message: `Intel loc2 forced · ${state.intel2Fragment}`,
      step: state.step,
    };
  }

  if (target === 'combine') {
    if (!state.intel1Fragment) {
      state.intel1Fragment = assignment.location1.fragment
        || assignment.location1.acceptedAnswers?.[0]
        || 'FRAG1';
    }
    if (!state.intel2Fragment) {
      state.intel2Fragment = assignment.location2.fragment
        || assignment.location2.acceptedAnswers?.[0]
        || 'FRAG2';
    }
    state.step = 'done';
    return {
      ok: true,
      complete: true,
      points,
      state,
      message: `Intel Hunt complete · +${points}`,
      step: 'done',
    };
  }

  const err = new Error(`Unknown Intel playtest task: ${target}`);
  err.status = 400;
  err.code = 'BAD_PLAYTEST_TASK';
  throw err;
}

/**
 * Playtest reset — clear mission progress, restore starting score, clear release/stop.
 * Admin must Release again before the team can open missions.
 */
async function playtestResetFinaleTeam({ eventId, teamId, actor = {} }) {
  const entry = await loadEntryForTeam(eventId, teamId);
  const config = await getOrCreateMissionConfig(eventId);
  const starting = Number(config.startingScore) || FINALE_DEFAULTS.startingScore;

  if (entry.activeMissionRunId) {
    const run = await CampusHuntFinaleMissionRun.findById(entry.activeMissionRunId);
    if (run && run.status === 'active') {
      if (isFieldTerminalMission(run.missionId)) {
        await expireGridSessionForRun(run._id);
      }
      run.status = 'abandoned';
      await run.save();
    }
  }

  await CampusHuntFinaleMissionRun.updateMany(
    { entryId: entry._id, status: { $in: ['active', 'completed'] } },
    { $set: { status: 'abandoned' } },
  );

  // Must $unset optional timestamps/scores — undefined + save() leaves them in Mongo
  await CampusHuntFinaleEntry.updateOne(
    { _id: entry._id },
    {
      $set: {
        completedMissionIds: [],
        activeMissionId: null,
        activeMissionRunId: null,
        finaleScore: starting,
        status: 'eligible',
      },
      $unset: {
        finalScore: 1,
        stoppedAt: 1,
        lockedAt: 1,
        releasedAt: 1,
        scheduledStartAt: 1,
      },
    },
  );

  await writeAudit({
    eventId,
    ...actor,
    action: 'finale_playtest_reset',
    targetType: 'team',
    targetId: teamId,
    after: { finaleScore: starting },
  });

  const team = await CampusHuntTeam.findById(teamId);
  return buildBoardPayload({
    eventId,
    teamId,
    userId: team?.leaderUserId,
    isLeader: true,
    skipAutoRelease: true,
  });
}

module.exports = {
  loadEntryForTeam,
  buildBoardPayload,
  startMission,
  submitMissionStep,
  abandonMission,
  stopTeam,
  resumeTeam,
  playtestCompleteMission,
  playtestAdvanceMissionStep,
  playtestResetFinaleTeam,
  seatForUser,
  sanitizePublicMissionState,
};
