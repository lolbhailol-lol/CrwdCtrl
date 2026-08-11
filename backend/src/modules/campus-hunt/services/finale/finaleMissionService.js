const CampusHuntFinaleEntry = require('../../models/CampusHuntFinaleEntry');
const CampusHuntFinaleMissionRun = require('../../models/CampusHuntFinaleMissionRun');
const CampusHuntTeam = require('../../models/CampusHuntTeam');
const { getHandler, missionMeta } = require('../../finale/missions/registry');
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
const {
  releaseDueFinaleTeams,
  isEntryReleased,
} = require('./finaleReleaseService');
const { FINALE_DEFAULTS } = require('../../constants');

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

async function buildBoardPayload({ eventId, teamId, userId, isLeader }) {
  const [entry, round, config] = await Promise.all([
    loadEntryForTeam(eventId, teamId),
    getFinaleRound(eventId),
    getOrCreateMissionConfig(eventId),
  ]);

  if (round?.status === 'live') {
    await releaseDueFinaleTeams({
      eventId,
      actor: { actorType: 'system', actorId: 'board' },
    });
    const fresh = await CampusHuntFinaleEntry.findById(entry._id);
    if (fresh) {
      entry.releasedAt = fresh.releasedAt;
      entry.status = fresh.status;
      entry.scheduledStartAt = fresh.scheduledStartAt;
      entry.meetLocationCode = fresh.meetLocationCode;
      entry.meetLocationName = fresh.meetLocationName;
    }
  }

  let activeRun = null;
  if (entry.activeMissionId || entry.activeMissionRunId) {
    const healed = await healStaleActiveMission(entry);
    activeRun = healed.activeRun;
  }

  const missions = (config.missions || []).map((meta) => {
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
      const playerView = handler.rebuildPlayerView
        ? handler.rebuildPlayerView(activeRun, config)
        : rebuildPlayerView(handler, entry, activeRun, config);
      activeMission = {
        missionId: isFieldTerminalMission(entry.activeMissionId)
          ? 'field_terminal'
          : entry.activeMissionId,
        title: meta.title,
        points: meta.points,
        runId: String(activeRun._id),
        state: activeRun.state,
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

function rebuildPlayerView(handler, entry, run, config) {
  if (handler.rebuildPlayerView) {
    return handler.rebuildPlayerView(run, config);
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
  await releaseDueFinaleTeams({
    eventId,
    actor: { actorType: 'system', actorId: 'start-mission' },
  });
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
    const board = await buildBoardPayload({ eventId, teamId, userId, isLeader: true });
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
  if (meta.comingSoon) {
    throw finaleError('This mission is coming soon.', 'MISSION_COMING_SOON');
  }

  const handler = getHandler(missionId);
  if (!handler) {
    throw finaleError('Unknown mission.', 'UNKNOWN_MISSION', 404);
  }

  let assignment = null;
  if (missionId === 'intel_hunt') {
    assignment = await assignIntelLocations({ eventId, config });
  }

  const { state, playerView } = handler.startRun(entry, config, { assignment });
  const expiresAt = missionExpiresAt(config, missionId);
  const initialState = {
    ...state,
    missionExpiresAt: expiresAt.toISOString(),
  };

  const run = await CampusHuntFinaleMissionRun.create({
    eventId,
    roundId: round._id,
    entryId: entry._id,
    teamId,
    missionId: isFieldTerminalMission(missionId) ? 'field_terminal' : missionId,
    status: 'active',
    state: initialState,
  });

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

  return buildBoardPayload({ eventId, teamId, userId, isLeader: true }).then((board) => ({
    ...board,
    activeMission: {
      missionId: canonicalMissionId,
      runId: String(run._id),
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
  isLeader,
  actor = {},
}) {
  if (!isLeader) {
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
  if (entry.activeMissionId !== missionId) {
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

  let result;
  if (isFieldTerminalMission(missionId)) {
    const gridValidation = await validateCompletionCode(answer, {
      teamId,
      missionRunId: run._id,
    });
    result = handler.submitStep(entry, run, { answer }, config, { gridValidation });
  } else {
    result = handler.submitStep(entry, run, { answer }, config);
  }

  if (!result.ok) {
    run.state = result.state;
    await run.save();
    const board = await buildBoardPayload({ eventId, teamId, userId, isLeader });
    return {
      ...board,
      submitResult: {
        ok: false,
        complete: false,
        message: result.playerView?.message,
        playerView: result.playerView,
        pointsAwarded: 0,
      },
    };
  }

  if (result.complete && isFieldTerminalMission(missionId)) {
    const claim = await claimCompletionCode(answer, { teamId, missionRunId: run._id });
    if (!claim.ok) {
      run.state = { ...result.state, attempts: Math.max(0, (result.state?.attempts || 1) - 1) };
      await run.save();
      const board = await buildBoardPayload({ eventId, teamId, userId, isLeader });
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

  run.state = result.state;
  await run.save();

  if (result.complete) {
    run.status = 'completed';
    run.pointsAwarded = result.points || 0;
    run.completedAt = new Date();
    await run.save();

    entry.finaleScore = (entry.finaleScore || 0) + (result.points || 0);
    entry.completedMissionIds = [...new Set([...(entry.completedMissionIds || []), missionId])];
    entry.activeMissionId = null;
    entry.activeMissionRunId = null;
    await entry.save();

    await writeAudit({
      eventId,
      ...actor,
      action: 'finale_mission_completed',
      targetType: 'team',
      targetId: teamId,
      after: { missionId, points: result.points, finaleScore: entry.finaleScore },
    });
  }

  const board = await buildBoardPayload({ eventId, teamId, userId, isLeader });
  return {
    ...board,
    submitResult: {
      ok: result.ok,
      complete: Boolean(result.complete),
      message: result.playerView?.message,
      playerView: result.playerView,
      pointsAwarded: result.points || 0,
    },
  };
}

async function abandonMission({ eventId, teamId, userId, actor = {} }) {
  const entry = await loadEntryForTeam(eventId, teamId);
  if (!entry.activeMissionRunId) {
    return buildBoardPayload({ eventId, teamId, userId, isLeader: true });
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

  return buildBoardPayload({ eventId, teamId, userId, isLeader: true });
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
  });
}

/**
 * Playtest cheat — force-complete Intel Hunt or Field Terminal (+points).
 * Does not require going through mission steps or grid levels.
 */
async function playtestCompleteMission({ eventId, teamId, missionId, actor = {} }) {
  const id = String(missionId || '');
  if (id !== 'intel_hunt' && !isFieldTerminalMission(id)) {
    throw finaleError('Playtest only supports Intel Hunt or Field Terminal.', 'BAD_MISSION', 400);
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
  });
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
  playtestResetFinaleTeam,
};
