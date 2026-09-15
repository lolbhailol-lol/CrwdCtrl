const crypto = require('crypto');
const { matchesAnyAccepted } = require('../../utils/answerNormalize');
const {
  FINALE_DEFAULTS,
  FINALE_MISSION_BOARD,
  DEFAULT_BLACKOUT_CONFIG,
  BLACKOUT_ROLES,
} = require('../../constants');

const MISSION_ID = 'operation_blackout';

function missionPoints(config, meta) {
  const fromMeta = Number(meta?.points);
  if (fromMeta > 0) return fromMeta;
  const row = (config?.missions || []).find((m) => m.id === MISSION_ID);
  if (Number(row?.points) > 0) return Number(row.points);
  const board = FINALE_MISSION_BOARD.find((m) => m.id === MISSION_ID);
  return Number(board?.points) || 200;
}

function defaultBlackoutConfig(config) {
  const b = config?.blackout || {};
  const mergeTask = (key, fallback) => ({
    ...fallback,
    ...(b[key] || {}),
    acceptedAnswers: Array.isArray(b[key]?.acceptedAnswers) && b[key].acceptedAnswers.length
      ? b[key].acceptedAnswers
      : fallback.acceptedAnswers,
  });

  return {
    durationMinutes: Number(b.durationMinutes) || FINALE_DEFAULTS.blackoutDurationMinutes || 15,
    maxPenaltyTotal: Number(b.maxPenaltyTotal) || DEFAULT_BLACKOUT_CONFIG.maxPenaltyTotal,
    scout: mergeTask('scout', DEFAULT_BLACKOUT_CONFIG.scout),
    cracker: mergeTask('cracker', DEFAULT_BLACKOUT_CONFIG.cracker),
    navigator: mergeTask('navigator', DEFAULT_BLACKOUT_CONFIG.navigator),
    controller: {
      ...mergeTask('controller', DEFAULT_BLACKOUT_CONFIG.controller),
      useDerivedActivation: b.controller?.useDerivedActivation !== false,
    },
    routePool: Array.isArray(b.routePool) && b.routePool.length
      ? b.routePool
      : DEFAULT_BLACKOUT_CONFIG.routePool,
  };
}

/** Deterministic seat→role mapping for a team (stable across the mission session). */
function assignRolesForTeam(teamId) {
  const seed = crypto.createHash('sha256').update(String(teamId || 'team')).digest();
  const roles = [...BLACKOUT_ROLES];
  for (let i = roles.length - 1; i > 0; i -= 1) {
    const j = seed[i % seed.length] % (i + 1);
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  const roleBySeat = {};
  const seatByRole = {};
  roles.forEach((role, seat) => {
    roleBySeat[seat] = role;
    seatByRole[role] = seat;
  });
  return { roleBySeat, seatByRole, roleOrder: roles };
}

function generateAccessToken(teamId, runSalt = '') {
  const digest = crypto
    .createHash('sha256')
    .update(`${teamId}:${runSalt}:blackout-token`)
    .digest('hex');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = alphabet[parseInt(digest.slice(0, 2), 16) % alphabet.length];
  const b = alphabet[parseInt(digest.slice(2, 4), 16) % alphabet.length];
  return `${a}${b}`;
}

function pickRoute(routePool, teamId, runSalt = '') {
  const pool = routePool?.length ? routePool : DEFAULT_BLACKOUT_CONFIG.routePool;
  const digest = crypto
    .createHash('sha256')
    .update(`${teamId}:${runSalt}:blackout-route`)
    .digest('hex');
  const idx = parseInt(digest.slice(0, 8), 16) % pool.length;
  return pool[idx];
}

function normalizeRouteInput(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[→>]/g, ' ')
    .replace(/[,|/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function routesMatch(submitted, expected) {
  return normalizeRouteInput(submitted) === normalizeRouteInput(expected);
}

function tokensMatch(submitted, expected) {
  return String(submitted || '').trim().toUpperCase() === String(expected || '').trim().toUpperCase();
}

function buildDerivedActivation(state) {
  const token = String(state.accessToken || '').trim().toUpperCase();
  const colors = normalizeRouteInput(state.route)
    .split(' ')
    .filter((w) => w.length > 0);
  const initials = colors.map((c) => c[0]).join('');
  const freqDigits = String(state.frequency || '').replace(/[^0-9]/g, '');
  return `${token}-${initials}-${freqDigits}`;
}

function activationMatches(submitted, state, cfg) {
  const trimmed = String(submitted || '').trim();
  if (Array.isArray(cfg.controller.acceptedAnswers) && cfg.controller.acceptedAnswers.length) {
    if (matchesAnyAccepted(trimmed, cfg.controller.acceptedAnswers)) return true;
  }
  if (cfg.controller.useDerivedActivation !== false) {
    const expected = buildDerivedActivation(state);
    return tokensMatch(trimmed.replace(/\s+/g, ''), expected.replace(/\s+/g, ''));
  }
  return false;
}

function cappedPenalty(state, cfg, rawPenalty) {
  const incurred = Number(state.penaltiesIncurred || 0);
  const cap = Number(cfg.maxPenaltyTotal) || 100;
  const room = Math.max(0, cap - incurred);
  return Math.min(Math.max(0, Number(rawPenalty) || 0), room);
}

function roleForSeat(state, seat) {
  if (seat == null || Number(seat) < 0) return null;
  return state?.roleBySeat?.[String(seat)] || state?.roleBySeat?.[seat] || null;
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
    title: meta?.title || 'OPERATION: BLACKOUT',
    emoji: meta?.emoji || '⚡',
    points: missionPoints(config, meta),
    status,
    enabled: meta?.enabled !== false,
    tagline: 'HIGH RISK / HIGH REWARD',
    playersRequired: 4,
  };
}

function publicProgress(state) {
  return {
    scoutDone: Boolean(state.accessToken),
    crackerUnlocked: Boolean(state.crackerUnlocked),
    crackerDone: Boolean(state.route),
    navigatorUnlocked: Boolean(state.navigatorUnlocked),
    navigatorDone: Boolean(state.frequency),
    controllerReady: Boolean(state.accessToken && state.route && state.frequency),
  };
}

function buildPlayerView(run, config, { seat = -1, isLeader = false } = {}) {
  const cfg = defaultBlackoutConfig(config);
  const state = run?.state || {};
  const points = missionPoints(config);
  const step = state.step || 'scout';
  const role = roleForSeat(state, seat);
  const progress = publicProgress(state);
  const base = {
    missionId: MISSION_ID,
    title: 'OPERATION: BLACKOUT',
    points,
    durationMinutes: cfg.durationMinutes,
    tagline: 'HIGH RISK / HIGH REWARD',
    playersRequired: 4,
    step,
    yourSeat: seat,
    yourRole: role,
    isLeader,
    progress,
    penaltiesIncurred: Number(state.penaltiesIncurred || 0),
    roleAssignment: state.roleBySeat || {},
  };

  if (seat < 0) {
    return {
      ...base,
      locked: true,
      rosterError: 'Your account is not mapped to a team seat. Ask an organizer.',
      canSubmit: false,
    };
  }

  // Everyone sees high-level progress; only active role can submit the current step
  if (step === 'done') {
    return {
      ...base,
      message: state.completeMessage || 'BLACKOUT complete.',
      canSubmit: false,
    };
  }

  if (step === 'scout') {
    const isActive = role === 'scout';
    return {
      ...base,
      taskLabel: 'OPERATION 1 — SCOUT',
      instruction: isActive ? cfg.scout.clue : 'Wait for the Scout. Stay together as a team.',
      locationHint: isActive ? cfg.scout.locationHint : null,
      canSubmit: isActive,
      locked: !isActive,
      hint: isActive
        ? 'Enter the secret from the physical BLACKOUT Scout Station marker.'
        : `Your role: ${(role || 'unknown').toUpperCase()}. Scout is active.`,
      attemptsLeft: Math.max(0, cfg.scout.maxAttempts - Number(state.attempts?.scout || 0)),
      penaltyNote: `Wrong answer: −${cfg.scout.penalty} pts`,
    };
  }

  if (step === 'cracker') {
    const isActive = role === 'cracker';
    if (!state.crackerUnlocked) {
      return {
        ...base,
        taskLabel: 'OPERATION 2 — CRACKER',
        instruction: isActive
          ? 'SCOUT TOKEN REQUIRED — enter the access token from Scout.'
          : 'Cracker is waiting for the Scout token. Stay together.',
        subStep: 'token',
        canSubmit: isActive,
        locked: !isActive,
        hint: isActive ? 'Ask Scout for ACCESS TOKEN.' : `Your role: ${(role || '').toUpperCase()}.`,
        attemptsLeft: Math.max(0, cfg.cracker.maxAttempts - Number(state.attempts?.crackerToken || 0)),
        penaltyNote: `Wrong token: −${cfg.cracker.penalty} pts`,
        // Scout may still see their token to share verbally
        accessToken: role === 'scout' ? state.accessToken : null,
      };
    }
    return {
      ...base,
      taskLabel: 'OPERATION 2 — CRACKER',
      instruction: isActive ? cfg.cracker.puzzlePrompt : 'Cracker is solving the cipher. Stay together.',
      subStep: 'puzzle',
      canSubmit: isActive,
      locked: !isActive,
      accessToken: role === 'scout' || role === 'cracker' ? state.accessToken : null,
      attemptsLeft: Math.max(0, cfg.cracker.maxAttempts - Number(state.attempts?.cracker || 0)),
      penaltyNote: `Wrong answer: −${cfg.cracker.penalty} pts`,
    };
  }

  if (step === 'navigator') {
    const isActive = role === 'navigator';
    if (!state.navigatorUnlocked) {
      return {
        ...base,
        taskLabel: 'OPERATION 3 — NAVIGATOR',
        instruction: isActive
          ? 'ROUTE REQUIRED — enter the route unlocked by Cracker.'
          : 'Navigator needs the Cracker route. All 4 stay together — do not split up.',
        subStep: 'route',
        canSubmit: isActive,
        locked: !isActive,
        route: role === 'cracker' ? state.route : null,
        attemptsLeft: Math.max(0, cfg.navigator.maxAttempts - Number(state.attempts?.navigatorRoute || 0)),
        penaltyNote: `Wrong route: −${cfg.navigator.penalty} pts`,
      };
    }
    return {
      ...base,
      taskLabel: 'OPERATION 3 — NAVIGATOR',
      instruction: isActive
        ? cfg.navigator.challengePrompt
        : 'Follow the route together. Navigator enters the frequency at the end.',
      subStep: 'frequency',
      canSubmit: isActive,
      locked: !isActive,
      route: role === 'navigator' || role === 'cracker' ? state.route : null,
      attemptsLeft: Math.max(0, cfg.navigator.maxAttempts - Number(state.attempts?.navigator || 0)),
      penaltyNote: `Wrong answer: −${cfg.navigator.penalty} pts`,
    };
  }

  if (step === 'controller') {
    const isActive = role === 'controller';
    return {
      ...base,
      taskLabel: 'OPERATION 4 — CONTROLLER',
      instruction: isActive
        ? cfg.controller.challengePrompt
        : 'Controller is assembling the activation code. Share your outputs verbally if needed.',
      canSubmit: isActive,
      locked: !isActive,
      // Controller (and leaders for ops awareness) see assembled intel — not accepted answers
      intel: isActive || isLeader
        ? {
          accessToken: state.accessToken || null,
          route: state.route || null,
          frequency: state.frequency || null,
        }
        : null,
      accessToken: isActive ? state.accessToken : (role === 'scout' ? state.accessToken : null),
      route: isActive ? state.route : (role === 'cracker' ? state.route : null),
      frequency: isActive ? state.frequency : (role === 'navigator' ? state.frequency : null),
      attemptsLeft: Math.max(0, cfg.controller.maxAttempts - Number(state.attempts?.controller || 0)),
      penaltyNote: `Wrong answer: −${cfg.controller.penalty} pts`,
    };
  }

  return { ...base, canSubmit: false, locked: true };
}

function startRun(entry, config, { teamId } = {}) {
  const cfg = defaultBlackoutConfig(config);
  const roles = assignRolesForTeam(teamId || entry.teamId);
  const salt = crypto.randomBytes(4).toString('hex');

  return {
    state: {
      step: 'scout',
      salt,
      roleBySeat: roles.roleBySeat,
      seatByRole: roles.seatByRole,
      roleOrder: roles.roleOrder,
      accessToken: null,
      crackerUnlocked: false,
      route: null,
      navigatorUnlocked: false,
      frequency: null,
      attempts: {
        scout: 0,
        crackerToken: 0,
        cracker: 0,
        navigatorRoute: 0,
        navigator: 0,
        controller: 0,
      },
      penaltiesIncurred: 0,
      pendingRoute: pickRoute(cfg.routePool, teamId || entry.teamId, salt),
      pendingToken: generateAccessToken(teamId || entry.teamId, salt),
    },
    playerView: {
      missionId: MISSION_ID,
      step: 'scout',
      title: 'OPERATION: BLACKOUT',
      points: missionPoints(config),
      tagline: 'HIGH RISK / HIGH REWARD',
    },
  };
}

function failAttempt(state, cfg, {
  attemptKey,
  maxAttempts,
  penaltyAmount,
  playerView,
}) {
  state.attempts = { ...(state.attempts || {}) };
  state.attempts[attemptKey] = Number(state.attempts[attemptKey] || 0) + 1;
  const penalty = cappedPenalty(state, cfg, penaltyAmount);
  state.penaltiesIncurred = Number(state.penaltiesIncurred || 0) + penalty;
  const maxed = state.attempts[attemptKey] >= maxAttempts;
  return {
    ok: false,
    complete: false,
    penalty,
    state,
    playerView: {
      ...playerView,
      locked: maxed || playerView.locked,
      message: maxed
        ? 'Out of attempts for this step. Ask an organizer for help.'
        : `Incorrect. −${penalty} pts.`,
      attemptsLeft: Math.max(0, maxAttempts - state.attempts[attemptKey]),
      penaltiesIncurred: state.penaltiesIncurred,
    },
  };
}

function submitStep(entry, run, { answer }, config, { seat = -1, isLeader = false } = {}) {
  const cfg = defaultBlackoutConfig(config);
  const state = {
    ...(run.state || {}),
    attempts: { ...(run.state?.attempts || {}) },
  };
  const step = state.step || 'scout';
  const role = roleForSeat(state, seat);
  const trimmed = String(answer || '').trim();
  const points = missionPoints(config);

  const viewCtx = { seat, isLeader };

  if (seat < 0) {
    return {
      ok: false,
      state,
      playerView: buildPlayerView({ state }, config, viewCtx),
    };
  }

  if (step === 'scout') {
    if (role !== 'scout') {
      return {
        ok: false,
        state,
        playerView: {
          ...buildPlayerView({ state }, config, viewCtx),
          message: 'Only the Scout can submit this step.',
        },
      };
    }
    if (Number(state.attempts.scout || 0) >= cfg.scout.maxAttempts) {
      return failAttempt(state, cfg, {
        attemptKey: 'scout',
        maxAttempts: cfg.scout.maxAttempts,
        penaltyAmount: 0,
        playerView: buildPlayerView({ state }, config, viewCtx),
      });
    }
    const ok = matchesAnyAccepted(trimmed, cfg.scout.acceptedAnswers);
    if (!ok) {
      return failAttempt(state, cfg, {
        attemptKey: 'scout',
        maxAttempts: cfg.scout.maxAttempts,
        penaltyAmount: cfg.scout.penalty,
        playerView: buildPlayerView({ state }, config, viewCtx),
      });
    }
    state.accessToken = state.pendingToken || generateAccessToken(entry.teamId, state.salt);
    state.step = 'cracker';
    state.crackerUnlocked = false;
    return {
      ok: true,
      complete: false,
      penalty: 0,
      state,
      playerView: {
        ...buildPlayerView({ state }, config, viewCtx),
        message: 'SCOUT COMPLETE',
        accessToken: state.accessToken,
        shareInstruction: 'Give this ACCESS TOKEN to the Cracker.',
      },
    };
  }

  if (step === 'cracker') {
    if (role !== 'cracker') {
      return {
        ok: false,
        state,
        playerView: {
          ...buildPlayerView({ state }, config, viewCtx),
          message: 'Only the Cracker can submit this step.',
        },
      };
    }

    if (!state.crackerUnlocked) {
      if (Number(state.attempts.crackerToken || 0) >= cfg.cracker.maxAttempts) {
        return failAttempt(state, cfg, {
          attemptKey: 'crackerToken',
          maxAttempts: cfg.cracker.maxAttempts,
          penaltyAmount: 0,
          playerView: buildPlayerView({ state }, config, viewCtx),
        });
      }
      if (!tokensMatch(trimmed, state.accessToken)) {
        return failAttempt(state, cfg, {
          attemptKey: 'crackerToken',
          maxAttempts: cfg.cracker.maxAttempts,
          penaltyAmount: cfg.cracker.penalty,
          playerView: buildPlayerView({ state }, config, viewCtx),
        });
      }
      state.crackerUnlocked = true;
      return {
        ok: true,
        complete: false,
        penalty: 0,
        state,
        playerView: {
          ...buildPlayerView({ state }, config, viewCtx),
          message: 'Token accepted. Cracker challenge unlocked.',
        },
      };
    }

    if (Number(state.attempts.cracker || 0) >= cfg.cracker.maxAttempts) {
      return failAttempt(state, cfg, {
        attemptKey: 'cracker',
        maxAttempts: cfg.cracker.maxAttempts,
        penaltyAmount: 0,
        playerView: buildPlayerView({ state }, config, viewCtx),
      });
    }
    const ok = matchesAnyAccepted(trimmed, cfg.cracker.acceptedAnswers);
    if (!ok) {
      return failAttempt(state, cfg, {
        attemptKey: 'cracker',
        maxAttempts: cfg.cracker.maxAttempts,
        penaltyAmount: cfg.cracker.penalty,
        playerView: buildPlayerView({ state }, config, viewCtx),
      });
    }
    state.route = state.pendingRoute || pickRoute(cfg.routePool, entry.teamId, state.salt);
    state.step = 'navigator';
    state.navigatorUnlocked = false;
    return {
      ok: true,
      complete: false,
      penalty: 0,
      state,
      playerView: {
        ...buildPlayerView({ state }, config, viewCtx),
        message: 'CRACKER COMPLETE — ROUTE UNLOCKED',
        route: state.route,
        shareInstruction: 'Give this ROUTE to the Navigator.',
      },
    };
  }

  if (step === 'navigator') {
    if (role !== 'navigator') {
      return {
        ok: false,
        state,
        playerView: {
          ...buildPlayerView({ state }, config, viewCtx),
          message: 'Only the Navigator can submit this step.',
        },
      };
    }

    if (!state.navigatorUnlocked) {
      if (Number(state.attempts.navigatorRoute || 0) >= cfg.navigator.maxAttempts) {
        return failAttempt(state, cfg, {
          attemptKey: 'navigatorRoute',
          maxAttempts: cfg.navigator.maxAttempts,
          penaltyAmount: 0,
          playerView: buildPlayerView({ state }, config, viewCtx),
        });
      }
      if (!routesMatch(trimmed, state.route)) {
        return failAttempt(state, cfg, {
          attemptKey: 'navigatorRoute',
          maxAttempts: cfg.navigator.maxAttempts,
          penaltyAmount: cfg.navigator.penalty,
          playerView: buildPlayerView({ state }, config, viewCtx),
        });
      }
      state.navigatorUnlocked = true;
      return {
        ok: true,
        complete: false,
        penalty: 0,
        state,
        playerView: {
          ...buildPlayerView({ state }, config, viewCtx),
          message: 'NAVIGATION UNLOCKED — travel the route together.',
          route: state.route,
        },
      };
    }

    if (Number(state.attempts.navigator || 0) >= cfg.navigator.maxAttempts) {
      return failAttempt(state, cfg, {
        attemptKey: 'navigator',
        maxAttempts: cfg.navigator.maxAttempts,
        penaltyAmount: 0,
        playerView: buildPlayerView({ state }, config, viewCtx),
      });
    }
    const ok = matchesAnyAccepted(trimmed, cfg.navigator.acceptedAnswers);
    if (!ok) {
      return failAttempt(state, cfg, {
        attemptKey: 'navigator',
        maxAttempts: cfg.navigator.maxAttempts,
        penaltyAmount: cfg.navigator.penalty,
        playerView: buildPlayerView({ state }, config, viewCtx),
      });
    }
    // Store the submitted normalized frequency as the team output
    state.frequency = trimmed.toUpperCase();
    state.step = 'controller';
    return {
      ok: true,
      complete: false,
      penalty: 0,
      state,
      playerView: {
        ...buildPlayerView({ state }, config, viewCtx),
        message: 'NAVIGATOR COMPLETE — FREQUENCY locked in.',
        frequency: state.frequency,
        shareInstruction: 'Give TOKEN + ROUTE + FREQUENCY to the Controller.',
      },
    };
  }

  if (step === 'controller') {
    if (role !== 'controller') {
      return {
        ok: false,
        state,
        playerView: {
          ...buildPlayerView({ state }, config, viewCtx),
          message: 'Only the Controller can submit the activation code.',
        },
      };
    }
    if (!state.accessToken || !state.route || !state.frequency) {
      return {
        ok: false,
        state,
        playerView: {
          ...buildPlayerView({ state }, config, viewCtx),
          message: 'Missing prior outputs. Complete Scout → Cracker → Navigator first.',
        },
      };
    }
    if (Number(state.attempts.controller || 0) >= cfg.controller.maxAttempts) {
      return failAttempt(state, cfg, {
        attemptKey: 'controller',
        maxAttempts: cfg.controller.maxAttempts,
        penaltyAmount: 0,
        playerView: buildPlayerView({ state }, config, viewCtx),
      });
    }
    const ok = activationMatches(trimmed, state, cfg);
    if (!ok) {
      return failAttempt(state, cfg, {
        attemptKey: 'controller',
        maxAttempts: cfg.controller.maxAttempts,
        penaltyAmount: cfg.controller.penalty,
        playerView: buildPlayerView({ state }, config, viewCtx),
      });
    }
    state.step = 'done';
    state.completeMessage = `BLACKOUT COMPLETE — +${points} points.`;
    return {
      ok: true,
      complete: true,
      points,
      penalty: 0,
      state,
      playerView: {
        missionId: MISSION_ID,
        step: 'done',
        points,
        message: state.completeMessage,
      },
    };
  }

  return {
    ok: false,
    state,
    playerView: { missionId: MISSION_ID, message: 'Mission setup error.' },
  };
}

function rebuildPlayerView(run, config, ctx = {}) {
  return buildPlayerView(run, config, ctx);
}

function abortRun(run) {
  return { state: run.state || {} };
}

/**
 * Admin playtest — force the next (or named) Blackout task without solving it.
 * task: 'next' | 'scout' | 'cracker' | 'navigator' | 'controller'
 */
function playtestForceAdvance(runState, config, { task = 'next', teamId } = {}) {
  const cfg = defaultBlackoutConfig(config);
  const state = {
    ...(runState || {}),
    attempts: { ...(runState?.attempts || {}) },
  };
  if (!state.roleBySeat) {
    const roles = assignRolesForTeam(teamId);
    state.roleBySeat = roles.roleBySeat;
    state.seatByRole = roles.seatByRole;
    state.roleOrder = roles.roleOrder;
  }
  if (!state.pendingToken) {
    state.pendingToken = generateAccessToken(teamId, state.salt || 'playtest');
  }
  if (!state.pendingRoute) {
    state.pendingRoute = pickRoute(cfg.routePool, teamId, state.salt || 'playtest');
  }

  const step = state.step || 'scout';
  let target = String(task || 'next').toLowerCase();
  if (target === 'next') {
    if (step === 'scout') target = 'scout';
    else if (step === 'cracker') target = 'cracker';
    else if (step === 'navigator') target = 'navigator';
    else if (step === 'controller') target = 'controller';
    else target = 'controller';
  }

  const points = missionPoints(config);

  if (target === 'scout') {
    state.accessToken = state.pendingToken;
    state.step = 'cracker';
    state.crackerUnlocked = false;
    return {
      ok: true,
      complete: false,
      points: 0,
      state,
      message: `Scout forced · ACCESS TOKEN ${state.accessToken}`,
      step: state.step,
    };
  }

  if (target === 'cracker') {
    if (!state.accessToken) {
      state.accessToken = state.pendingToken;
    }
    state.crackerUnlocked = true;
    state.route = state.pendingRoute;
    state.step = 'navigator';
    state.navigatorUnlocked = false;
    return {
      ok: true,
      complete: false,
      points: 0,
      state,
      message: `Cracker forced · ROUTE ${state.route}`,
      step: state.step,
    };
  }

  if (target === 'navigator') {
    if (!state.route) state.route = state.pendingRoute;
    if (!state.accessToken) state.accessToken = state.pendingToken;
    state.navigatorUnlocked = true;
    const freq = (cfg.navigator.acceptedAnswers && cfg.navigator.acceptedAnswers[0]) || '88.1';
    state.frequency = String(freq).toUpperCase();
    state.step = 'controller';
    return {
      ok: true,
      complete: false,
      points: 0,
      state,
      message: `Navigator forced · FREQUENCY ${state.frequency}`,
      step: state.step,
    };
  }

  if (target === 'controller') {
    if (!state.accessToken) state.accessToken = state.pendingToken;
    if (!state.route) state.route = state.pendingRoute;
    if (!state.frequency) {
      state.frequency = String(
        (cfg.navigator.acceptedAnswers && cfg.navigator.acceptedAnswers[0]) || '88.1',
      ).toUpperCase();
    }
    state.step = 'done';
    state.completeMessage = `BLACKOUT COMPLETE — +${points} points.`;
    return {
      ok: true,
      complete: true,
      points,
      state,
      message: state.completeMessage,
      step: 'done',
    };
  }

  const err = new Error(`Unknown Blackout playtest task: ${target}`);
  err.status = 400;
  err.code = 'BAD_PLAYTEST_TASK';
  throw err;
}

module.exports = {
  id: MISSION_ID,
  getBoardCard,
  startRun,
  submitStep,
  rebuildPlayerView,
  abortRun,
  defaultBlackoutConfig,
  assignRolesForTeam,
  missionPoints,
  generateAccessToken,
  pickRoute,
  routesMatch,
  tokensMatch,
  buildDerivedActivation,
  activationMatches,
  playtestForceAdvance,
};
