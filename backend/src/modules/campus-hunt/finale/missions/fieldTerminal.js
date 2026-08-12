const { MAX_GRID_POINTS } = require('../../grid/levelTemplates');

/** Canonical mission id */
const MISSION_ID = 'field_terminal';
/** Legacy id kept for in-progress / completed runs already stored in Mongo */
const LEGACY_MISSION_ID = 'borrowed_device';

function isFieldTerminalMission(id) {
  return id === MISSION_ID || id === LEGACY_MISSION_ID;
}

function missionCompleted(entry) {
  const done = entry.completedMissionIds || [];
  return done.includes(MISSION_ID) || done.includes(LEGACY_MISSION_ID);
}

function missionActive(entry) {
  return isFieldTerminalMission(entry.activeMissionId);
}

function pointsFromConfig(config) {
  const missions = config.missions || [];
  const row = missions.find((m) => isFieldTerminalMission(m.id));
  return Number(row?.points) || 0;
}

/** Admin mission max when set; otherwise grid natural max (100). Used as a CAP, not a floor. */
function missionMaxPoints(config, meta) {
  const fromMeta = Number(meta?.points);
  if (fromMeta > 0) return fromMeta;
  const fromConfig = pointsFromConfig(config);
  if (fromConfig > 0) return fromConfig;
  return MAX_GRID_POINTS;
}

function defaultDeviceConfig(config) {
  // Prefer new key; fall back to legacy borrowedDevice docs
  const device = config?.fieldTerminal || config?.borrowedDevice || {};
  return {
    locationName: device.locationName || 'Field terminal',
    // Keep player copy cryptic — the clue image carries the discovery beat.
    instruction: device.instruction
      || 'Study the clue. When you know what you need — use it. '
        + 'Open the terminal link, enter your device key, clear all 3 levels, then bring the GRID code back here.',
    maxAttempts: Number(device.maxAttempts) || 3,
    gameUrl: '/campus-hunt/grid',
    clueImageUrl: device.clueImageUrl || '/campus-hunt/field-terminal-clue.jpg',
  };
}

function gridGameView(device, state, { message, locked = false, attemptsLeft = null } = {}) {
  return {
    missionId: MISSION_ID,
    step: 'grid_game',
    locationName: device.locationName,
    instruction: device.instruction,
    gameUrl: device.gameUrl,
    clueImageUrl: device.clueImageUrl,
    accessCode: state.accessCode,
    locked,
    message,
    attemptsLeft,
    scoringNote: 'L1 = 25 · L2 = 50 · L3 = 50 · Hint = −20 · Missed timer = 0 for that level',
  };
}

function getBoardCard(entry, config, meta) {
  const completed = missionCompleted(entry);
  const active = missionActive(entry);
  let status = 'available';
  if (meta?.comingSoon || meta?.enabled === false) status = 'coming_soon';
  else if (completed) status = 'completed';
  else if (active) status = 'active';
  else if (entry.status === 'locked' || entry.status === 'stopped') status = 'locked';
  return {
    id: MISSION_ID,
    title: meta?.title || 'FIELD TERMINAL',
    emoji: meta?.emoji || '💻',
    points: missionMaxPoints(config, meta),
    status,
    enabled: meta?.enabled !== false,
  };
}

function startRun(entry, config) {
  const device = defaultDeviceConfig(config);
  return {
    state: {
      step: 'grid_game',
      attempts: 0,
      gridSessionId: null,
      accessCode: null,
    },
    playerView: {
      missionId: MISSION_ID,
      step: 'grid_game',
      locationName: device.locationName,
      instruction: device.instruction,
      gameUrl: device.gameUrl,
      clueImageUrl: device.clueImageUrl,
      showCluePopup: true,
      leaderOnly: true,
      hint: 'Only the Team Leader can submit the return code.',
      scoringNote: 'L1 = 25 · L2 = 50 · L3 = 50 · Hint = −20',
    },
  };
}

function submitStep(entry, run, { answer }, config, { gridValidation } = {}) {
  const device = defaultDeviceConfig(config);
  const state = { ...(run.state || {}), attempts: Number(run.state?.attempts || 0) };
  // Cap earned grid score at admin-configured mission max (not a floor of MAX_GRID_POINTS)
  const maxPoints = missionMaxPoints(config);

  if (state.attempts >= device.maxAttempts) {
    return {
      ok: false,
      state,
      playerView: gridGameView(device, state, {
        locked: true,
        message: 'Too many wrong attempts. Ask an organizer for help.',
        attemptsLeft: 0,
      }),
    };
  }

  state.attempts += 1;

  if (!gridValidation?.ok) {
    const maxed = state.attempts >= device.maxAttempts;
    return {
      ok: false,
      state,
      playerView: gridGameView(device, state, {
        locked: maxed,
        message: maxed
          ? 'Too many wrong attempts. Ask an organizer for help.'
          : (gridValidation?.message || 'Invalid completion code. Finish the grid game first.'),
        attemptsLeft: Math.max(0, device.maxAttempts - state.attempts),
      }),
    };
  }

  const earned = Math.max(0, Number(
    gridValidation.score
    ?? gridValidation.session?.score
    ?? 0,
  ));
  const points = Math.min(maxPoints, earned);

  return {
    ok: true,
    complete: true,
    points,
    state: { ...state, step: 'done', gridScore: points },
    playerView: {
      missionId: MISSION_ID,
      step: 'done',
      message: points > 0
        ? `Grid complete! +${points} points (from levels solved − hints).`
        : 'Grid finished with 0 points — still counts as mission complete.',
    },
  };
}

function abortRun(run) {
  return { state: run.state || {} };
}

function enrichPlayerView(playerView, runState) {
  if (!playerView || !isFieldTerminalMission(playerView.missionId)) return playerView;
  return {
    ...playerView,
    missionId: MISSION_ID,
    accessCode: runState?.accessCode || null,
    gameUrl: playerView.gameUrl || '/campus-hunt/grid',
    clueImageUrl: playerView.clueImageUrl || '/campus-hunt/field-terminal-clue.jpg',
    scoringNote: playerView.scoringNote || 'L1 = 25 · L2 = 50 · L3 = 50 · Hint = −20',
  };
}

module.exports = {
  id: MISSION_ID,
  legacyId: LEGACY_MISSION_ID,
  isFieldTerminalMission,
  getBoardCard,
  startRun,
  submitStep,
  abortRun,
  enrichPlayerView,
};
