const { matchesAnyAccepted } = require('../../utils/answerNormalize');
const {
  FINALE_DEFAULTS,
  DEFAULT_LOCKBOX_CONFIG,
  FINALE_MISSION_BOARD,
} = require('../../constants');

const MISSION_ID = 'lockbox';

function missionPoints(config, meta) {
  const fromMeta = Number(meta?.points);
  if (fromMeta > 0) return fromMeta;
  const row = (config?.missions || []).find((m) => m.id === MISSION_ID);
  if (Number(row?.points) > 0) return Number(row.points);
  const board = FINALE_MISSION_BOARD.find((m) => m.id === MISSION_ID);
  return Number(board?.points) || 75;
}

function defaultLockboxConfig(config) {
  const lb = config?.lockbox || {};
  return {
    clue: String(lb.clue || DEFAULT_LOCKBOX_CONFIG.clue),
    locationName: String(lb.locationName || DEFAULT_LOCKBOX_CONFIG.locationName || 'Library').trim()
      || DEFAULT_LOCKBOX_CONFIG.locationName
      || 'Library',
    locationHint: String(lb.locationHint || DEFAULT_LOCKBOX_CONFIG.locationHint || ''),
    keyPool: Array.isArray(lb.keyPool) && lb.keyPool.length
      ? lb.keyPool
      : DEFAULT_LOCKBOX_CONFIG.keyPool,
    codePool: Array.isArray(lb.codePool) && lb.codePool.length
      ? lb.codePool
      : DEFAULT_LOCKBOX_CONFIG.codePool,
    maxAttemptsKey: Number(lb.maxAttemptsKey) || FINALE_DEFAULTS.lockboxMaxAttemptsPerStep || 3,
    maxAttemptsCode: Number(lb.maxAttemptsCode) || FINALE_DEFAULTS.lockboxMaxAttemptsPerStep || 3,
    playerPieces: Array.isArray(lb.playerPieces) && lb.playerPieces.length
      ? lb.playerPieces
      : DEFAULT_LOCKBOX_CONFIG.playerPieces,
    acceptedCodes: Array.isArray(lb.acceptedCodes) && lb.acceptedCodes.length
      ? lb.acceptedCodes
      : DEFAULT_LOCKBOX_CONFIG.acceptedCodes,
    lockboxInstruction: String(
      lb.lockboxInstruction || DEFAULT_LOCKBOX_CONFIG.lockboxInstruction,
    ),
  };
}

/** Merge config with per-run assigned code snapshot (server-only). */
function runtimeLockbox(config, state = {}) {
  const base = defaultLockboxConfig(config);
  const code = state.assignedCode;
  if (code && Array.isArray(code.acceptedCodes) && code.acceptedCodes.length) {
    return {
      ...base,
      acceptedCodes: code.acceptedCodes,
      playerPieces: Array.isArray(code.playerPieces) && code.playerPieces.length
        ? code.playerPieces
        : base.playerPieces,
    };
  }
  return base;
}

function resolveAssignedKey(run, lockbox) {
  const assigned = run?.state?.assignedKey;
  if (assigned?.id && Array.isArray(assigned.acceptedAnswers)) {
    return assigned;
  }
  const id = run?.state?.assignedKeyId;
  if (!id) return null;
  return (lockbox.keyPool || []).find((k) => k.id === id) || null;
}

function pieceForSeat(lockbox, seat) {
  if (seat == null || Number(seat) < 0) return null;
  const pieces = lockbox.playerPieces || [];
  const bySeat = pieces.find((p) => Number(p.seat) === Number(seat));
  if (bySeat) return bySeat;
  return pieces[seat] || null;
}

function findKeyView(lockbox, state, {
  message,
  locked = false,
  attemptsLeft = null,
  points = null,
} = {}) {
  return {
    missionId: MISSION_ID,
    step: 'find_key',
    title: 'THE LOCKBOX',
    points,
    taskLabel: 'TASK 1 — FIND THE KEY',
    locationName: lockbox.locationName || null,
    clue: lockbox.clue,
    locationHint: lockbox.locationHint,
    leaderOnly: true,
    hint: 'Go to the location, find the physical key, then enter its ID. Only the Team Leader can verify.',
    message,
    locked,
    attemptsLeft,
  };
}

function lockboxCodeView(lockbox, state, {
  seat = 0,
  isLeader = false,
  message,
  locked = false,
  attemptsLeft = null,
  points = null,
} = {}) {
  const seatNum = Number(seat);
  const invalidSeat = Number.isNaN(seatNum) || seatNum < 0;
  const piece = invalidSeat ? null : pieceForSeat(lockbox, seatNum);
  return {
    missionId: MISSION_ID,
    step: 'lockbox_code',
    title: 'THE LOCKBOX',
    points,
    taskLabel: 'TASK 2 — DIGITAL LOCKBOX',
    instruction: lockbox.lockboxInstruction,
    yourSeat: invalidSeat ? -1 : seatNum,
    yourLabel: invalidSeat
      ? 'Not on roster'
      : (piece?.label || (isLeader ? 'Team Leader' : `Player ${seatNum + 1}`)),
    yourInfo: invalidSeat
      ? null
      : (piece?.info || null),
    rosterError: invalidSeat
      ? 'Your account is not mapped to a team seat. Ask an organizer to fix the roster.'
      : null,
    leaderOnly: true,
    canSubmit: Boolean(isLeader) && !invalidSeat,
    hint: isLeader
      ? 'Talk with your team, then submit the final code.'
      : 'Share your piece with the team. Only the Team Leader can submit the code.',
    message,
    locked,
    attemptsLeft,
  };
}

function getBoardCard(entry, config, meta) {
  const completed = (entry.completedMissionIds || []).includes(MISSION_ID);
  const active = entry.activeMissionId === MISSION_ID;
  let status = 'available';
  if (meta?.comingSoon || meta?.enabled === false) status = 'coming_soon';
  else if (completed) status = 'completed';
  else if (active) status = 'active';
  else if (entry.status === 'locked' || entry.status === 'stopped') status = 'locked';
  return {
    id: MISSION_ID,
    title: meta?.title || 'The Lockbox',
    emoji: meta?.emoji || '🔐',
    points: missionPoints(config, meta),
    status,
    enabled: meta?.enabled !== false,
  };
}

function startRun(entry, config, { assignedKey, assignedCode } = {}) {
  const lockbox = defaultLockboxConfig(config);
  const points = missionPoints(config);
  if (!assignedKey?.id) {
    const err = new Error('Physical key not assigned.');
    err.status = 409;
    err.code = 'LOCKBOX_KEY_NOT_ASSIGNED';
    throw err;
  }

  const codeSnap = assignedCode?.acceptedCodes?.length
    ? {
      id: assignedCode.id,
      acceptedCodes: assignedCode.acceptedCodes,
      playerPieces: assignedCode.playerPieces || [],
    }
    : null;

  return {
    state: {
      step: 'find_key',
      assignedKeyId: assignedKey.id,
      assignedKey: {
        id: assignedKey.id,
        label: assignedKey.label || '',
        acceptedAnswers: assignedKey.acceptedAnswers || [],
      },
      assignedCodeId: codeSnap?.id || null,
      assignedCode: codeSnap,
      attempts: { key: 0, code: 0 },
    },
    playerView: findKeyView(lockbox, { step: 'find_key' }, { points }),
  };
}

function submitStep(entry, run, { answer }, config, { isLeader = true, seat = 0 } = {}) {
  const state = {
    ...(run.state || {}),
    attempts: { key: 0, code: 0, ...(run.state?.attempts || {}) },
  };
  const lockbox = runtimeLockbox(config, state);
  const step = state.step || 'find_key';
  const trimmed = String(answer || '').trim();
  const points = missionPoints(config);

  if (step === 'find_key') {
    if (state.attempts.key >= lockbox.maxAttemptsKey) {
      return {
        ok: false,
        state,
        playerView: findKeyView(lockbox, state, {
          locked: true,
          message: 'Out of key attempts. Ask an organizer for help.',
          attemptsLeft: 0,
          points,
        }),
      };
    }
    state.attempts.key += 1;
    const key = resolveAssignedKey({ state }, lockbox);
    const ok = key && matchesAnyAccepted(trimmed, key.acceptedAnswers || []);
    if (!ok) {
      const maxed = state.attempts.key >= lockbox.maxAttemptsKey;
      return {
        ok: false,
        state,
        playerView: findKeyView(lockbox, state, {
          locked: maxed,
          message: maxed
            ? 'Out of key attempts. Ask an organizer for help.'
            : 'That key ID does not match. Check the physical key and try again.',
          attemptsLeft: Math.max(0, lockbox.maxAttemptsKey - state.attempts.key),
          points,
        }),
      };
    }

    state.step = 'lockbox_code';
    return {
      ok: true,
      complete: false,
      state,
      playerView: {
        ...lockboxCodeView(lockbox, state, { seat, isLeader, points }),
        message: 'Key verified. Open the Digital Lockbox — Task 2.',
      },
    };
  }

  if (step === 'lockbox_code') {
    if (state.attempts.code >= lockbox.maxAttemptsCode) {
      return {
        ok: false,
        state,
        playerView: lockboxCodeView(lockbox, state, {
          seat,
          isLeader,
          locked: true,
          message: 'Out of code attempts. Ask an organizer for help.',
          attemptsLeft: 0,
          points,
        }),
      };
    }
    state.attempts.code += 1;
    const ok = matchesAnyAccepted(trimmed, lockbox.acceptedCodes || []);
    if (!ok) {
      const maxed = state.attempts.code >= lockbox.maxAttemptsCode;
      return {
        ok: false,
        state,
        playerView: lockboxCodeView(lockbox, state, {
          seat,
          isLeader,
          locked: maxed,
          message: maxed
            ? 'Out of code attempts. Ask an organizer for help.'
            : 'Wrong code. Talk with your team and try again.',
          attemptsLeft: Math.max(0, lockbox.maxAttemptsCode - state.attempts.code),
          points,
        }),
      };
    }

    state.step = 'done';
    return {
      ok: true,
      complete: true,
      points,
      state,
      playerView: {
        missionId: MISSION_ID,
        step: 'done',
        points,
        message: `Lockbox opened! +${points} points.`,
      },
    };
  }

  return {
    ok: false,
    state,
    playerView: { missionId: MISSION_ID, message: 'Mission setup error.' },
  };
}

function rebuildPlayerView(run, config, { seat = 0, isLeader = false } = {}) {
  const state = run?.state || {};
  const lockbox = runtimeLockbox(config, state);
  const points = missionPoints(config);
  const step = state.step || 'find_key';
  if (step === 'lockbox_code') {
    return lockboxCodeView(lockbox, state, { seat, isLeader, points });
  }
  if (step === 'done') {
    return {
      missionId: MISSION_ID,
      step: 'done',
      points,
      message: 'Lockbox complete.',
    };
  }
  return findKeyView(lockbox, state, { points });
}

function abortRun(run) {
  return { state: run.state || {} };
}

module.exports = {
  id: MISSION_ID,
  getBoardCard,
  startRun,
  submitStep,
  rebuildPlayerView,
  abortRun,
  defaultLockboxConfig,
  runtimeLockbox,
  missionPoints,
};
