/**
 * Offline hunt engine — same stages, scoring, and checkpoint rules as online,
 * without a network. Leader phone is source of truth; teammates sync via QR.
 */

import {
  scoringForChallenge,
  matchesAnyAccepted,
  computeChallengeAward,
  DEFAULT_SCORING_CONFIG,
} from './scoring';
import { isMemberProof, isTeamSync, parseQrJson, verifyPayload } from './offlineQr';

const STAGE_TRANSITIONS = {
  WAITING: ['CLUE_1_ACTIVE'],
  CLUE_1_ACTIVE: ['CLUE_1_COMPLETED'],
  CLUE_1_COMPLETED: ['CHECKPOINT_1_COMPLETED'],
  CHECKPOINT_1_COMPLETED: ['CLUE_2_ACTIVE'],
  CLUE_2_ACTIVE: ['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'],
  CLUE_2_COMPLETED: ['CHECKPOINT_2_COMPLETED'],
  CLUE_2_FAILED: ['CHECKPOINT_2_COMPLETED'],
  CLUE_2_TIMEOUT: ['CHECKPOINT_2_COMPLETED'],
  CHECKPOINT_2_COMPLETED: ['CLUE_3_ACTIVE'],
  CLUE_3_ACTIVE: ['CLUE_3_COMPLETED', 'CLUE_3_FAILED'],
  CLUE_3_COMPLETED: ['CHECKPOINT_3_COMPLETED'],
  CLUE_3_FAILED: ['CHECKPOINT_3_COMPLETED'],
  CHECKPOINT_3_COMPLETED: ['CLUE_4_ACTIVE'],
  CLUE_4_ACTIVE: ['CLUE_4_COMPLETED', 'CLUE_4_FAILED', 'CLUE_4_TIMEOUT'],
  CLUE_4_COMPLETED: ['CHECKPOINT_4_COMPLETED'],
  CLUE_4_FAILED: ['CHECKPOINT_4_COMPLETED'],
  CLUE_4_TIMEOUT: ['CHECKPOINT_4_COMPLETED'],
  CHECKPOINT_4_COMPLETED: ['CLUE_5_ACTIVE'],
  CLUE_5_ACTIVE: ['CLUE_5_COMPLETED', 'CLUE_5_FAILED'],
  CLUE_5_COMPLETED: ['CHECKPOINT_5_COMPLETED'],
  CLUE_5_FAILED: ['CHECKPOINT_5_COMPLETED'],
  CHECKPOINT_5_COMPLETED: ['CLUE_6_ACTIVE'],
  CLUE_6_ACTIVE: ['CLUE_6_COMPLETED', 'CLUE_6_FAILED'],
  CLUE_6_COMPLETED: ['FINISH_COMPLETED'],
  CLUE_6_FAILED: ['FINISH_COMPLETED'],
  FINISH_COMPLETED: ['SCORE_LOCKED'],
  SCORE_LOCKED: [],
};

const RESOLVED = {
  1: { completed: 'CLUE_1_COMPLETED', failed: 'CLUE_1_COMPLETED' },
  2: { completed: 'CLUE_2_COMPLETED', failed: 'CLUE_2_FAILED', timeout: 'CLUE_2_TIMEOUT' },
  3: { completed: 'CLUE_3_COMPLETED', failed: 'CLUE_3_FAILED' },
  4: { completed: 'CLUE_4_COMPLETED', failed: 'CLUE_4_FAILED', timeout: 'CLUE_4_TIMEOUT' },
  5: { completed: 'CLUE_5_COMPLETED', failed: 'CLUE_5_FAILED' },
  6: { completed: 'CLUE_6_COMPLETED', failed: 'CLUE_6_FAILED' },
};

const CHECKPOINT_UNLOCK = {
  1: ['CLUE_1_COMPLETED'],
  2: ['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'],
  3: ['CLUE_3_COMPLETED', 'CLUE_3_FAILED'],
  4: ['CLUE_4_COMPLETED', 'CLUE_4_FAILED', 'CLUE_4_TIMEOUT'],
  5: ['CLUE_5_COMPLETED', 'CLUE_5_FAILED'],
};

const CHECKPOINT_NEXT = {
  1: 'CHECKPOINT_1_COMPLETED',
  2: 'CHECKPOINT_2_COMPLETED',
  3: 'CHECKPOINT_3_COMPLETED',
  4: 'CHECKPOINT_4_COMPLETED',
  5: 'CHECKPOINT_5_COMPLETED',
};

const AUTO_AFTER_CHECKPOINT = {
  CHECKPOINT_1_COMPLETED: 'CLUE_2_ACTIVE',
  CHECKPOINT_2_COMPLETED: 'CLUE_3_ACTIVE',
  CHECKPOINT_3_COMPLETED: 'CLUE_4_ACTIVE',
  CHECKPOINT_4_COMPLETED: 'CLUE_5_ACTIVE',
  CHECKPOINT_5_COMPLETED: 'CLUE_6_ACTIVE',
  FINISH_COMPLETED: 'SCORE_LOCKED',
};

const ROUTE_BY_KEY = { 1: 'orange', 2: 'green', 3: 'blue', 4: 'purple', 5: 'red' };

function huntError(message, status = 400, code = 'OFFLINE') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/** Match backend normalizeTeamCode — CC1 / 1 → CC001. */
function normalizeOfflineTeamCode(raw) {
  let s = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return '';
  if (['LOGIN', 'PLAY', 'TEAM', 'ADMIN', 'LEADERBOARD'].includes(s)) return '';
  if (/^\d+$/.test(s)) return `CC${s.padStart(3, '0')}`;
  const match = s.match(/^CC(\d+)$/);
  if (match) return `CC${match[1].padStart(3, '0')}`;
  return s;
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function bump(state) {
  state.seq = (Number(state.seq) || 0) + 1;
  state.updatedAt = new Date().toISOString();
  return state;
}

function canTransition(from, to) {
  return (STAGE_TRANSITIONS[from] || []).includes(to);
}

function roster(bundle) {
  return Array.isArray(bundle?.team?.roster) ? bundle.team.roster : [];
}

export function teamSize(bundle) {
  const fromEvent = Number(bundle?.event?.teamSize);
  const fromRoster = roster(bundle).length;
  return Math.max(2, Math.min(12, fromRoster || fromEvent || 4));
}

function emptyClue() {
  return {
    state: 'LOCKED',
    attempts: 0,
    awardedPoints: 0,
    hintUsed: false,
    startedAt: null,
    expiresAt: null,
    failureReason: null,
    completedAt: null,
  };
}

export function createInitialTeamState(bundle) {
  const startingScore = Number(bundle?.event?.startingScore) > 0
    ? Number(bundle.event.startingScore)
    : (bundle?.event?.scoringConfig?.startingScore || 100);
  return {
    teamCode: bundle.team.teamCode,
    currentStage: 'WAITING',
    score: startingScore,
    seq: 0,
    huntStartedAt: null,
    clueProgress: {
      1: emptyClue(),
      2: emptyClue(),
      3: emptyClue(),
      4: emptyClue(),
      5: emptyClue(),
      6: emptyClue(),
    },
    checkpoints: {
      1: { scans: {}, confirmed: false },
      2: { scans: {}, confirmed: false },
      3: { scans: {}, confirmed: false },
      4: { scans: {}, confirmed: false },
      5: { scans: {}, confirmed: false },
    },
    finishedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Fill missing clue/checkpoint slots when loading an older offline save. */
export function hydrateTeamState(state) {
  if (!state || typeof state !== 'object') return createInitialTeamState({});
  const next = clone(state);
  next.clueProgress = next.clueProgress || {};
  next.checkpoints = next.checkpoints || {};
  for (const n of [1, 2, 3, 4, 5, 6]) {
    if (!next.clueProgress[n]) next.clueProgress[n] = emptyClue();
  }
  for (const n of [1, 2, 3, 4, 5]) {
    if (!next.checkpoints[n]) next.checkpoints[n] = { scans: {}, confirmed: false };
  }
  // Migrate pre–Clue-6 saves that jumped Clue 5 → finish.
  if (['CLUE_5_COMPLETED', 'CLUE_5_FAILED'].includes(next.currentStage)
    && !next.checkpoints[5]?.confirmed) {
    /* leave as-is — pendingCheckpointKey now routes them to red scan */
  }
  return next;
}

function clue1NeverPlayed(state) {
  const row = state?.clueProgress?.[1];
  if (!row) return true;
  if (Number(row.attempts) > 0 || row.completedAt) return false;
  return !['COMPLETED', 'FAILED', 'TIMED_OUT'].includes(row.state);
}

export function hydrateState(bundle, state) {
  if (!state || !state.clueProgress?.[1] || String(state.currentStage || '').includes('CLUE1_')) {
    return createInitialTeamState(bundle);
  }
  let next = hydrateTeamState(state);
  if (!next.huntStartedAt && clue1NeverPlayed(next)) {
    next = clone(next);
    next.currentStage = 'WAITING';
    next.clueProgress[1] = emptyClue();
    next.huntStartedAt = null;
  }
  return next;
}

export function isHuntWaiting(state) {
  return String(state?.currentStage || 'WAITING') === 'WAITING';
}

/**
 * Offline start — one secret code only.
 * Organizer says the word at the gather point; leaders type it; hunt starts.
 */
export function getHuntStartGate(bundle, now = new Date(), { goCode = '' } = {}) {
  void now;
  const expected = String(bundle?.event?.organizerStartCode || 'GO').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const got = String(goCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!expected) {
    return {
      open: true,
      reason: 'OPEN',
      openAt: null,
      remainingMs: 0,
      timeReached: true,
      needsGoCode: false,
      message: '',
    };
  }

  if (got === expected) {
    return {
      open: true,
      reason: 'OPEN',
      openAt: null,
      remainingMs: 0,
      timeReached: true,
      needsGoCode: true,
      message: '',
    };
  }

  return {
    open: false,
    reason: 'NEED_GO_CODE',
    openAt: null,
    remainingMs: 0,
    timeReached: true,
    needsGoCode: true,
    message: 'Wait at the gather point. When the organizer says the start code, type it here.',
  };
}

export function startHunt(bundle, session, state, now = new Date(), { goCode = '' } = {}) {
  assertLeader(session);
  let next = clone(state);
  if (next.currentStage === 'SCORE_LOCKED') {
    throw huntError('Score is locked', 409, 'SCORE_LOCKED');
  }
  if (next.currentStage !== 'WAITING') {
    next = ensureClueActive(bundle, next, now);
    return {
      state: next,
      meta: { alreadyStarted: true, message: 'Hunt already started — continue on this leader phone.' },
    };
  }
  const gate = getHuntStartGate(bundle, now, { goCode });
  if (!gate.open) {
    throw huntError(gate.message, 403, gate.reason);
  }
  if (!canTransition(next.currentStage, 'CLUE_1_ACTIVE')) {
    throw huntError('Cannot start the hunt from this stage', 409, 'WRONG_STAGE');
  }
  next.currentStage = 'CLUE_1_ACTIVE';
  next.huntStartedAt = now.toISOString();
  bump(next);
  next = ensureClueActive(bundle, next, now);
  return {
    state: next,
    meta: { message: 'Hunt started — solve Clue 1 on this leader phone.' },
  };
}

export function getClue(bundle, n) {
  const key = `clue${n}`;
  return bundle?.clues?.[key] || bundle?.challenges?.[key] || null;
}

/** Canonical accepted answers for offline grading (digits / letters / lockbox). */
function acceptedAnswersForClue(bundle, n, clue) {
  const raw = [clue?.answer, ...(clue?.acceptedAnswers || [])].filter(Boolean);
  if (n === 2) {
    const digits = [];
    for (const row of raw) {
      const d = String(row || '').replace(/\D/g, '');
      if (d.length >= 3) digits.push(d.slice(0, 3));
    }
    // Only use green plant if challenge has no digit answer yet (legacy packs).
    if (!digits.length) {
      const plant = String(bundle?.route?.green?.joinedWord || '').replace(/\D/g, '');
      if (plant.length >= 3) digits.push(plant.slice(0, 3));
      const frags = Array.isArray(bundle?.route?.green?.plantFragments)
        ? bundle.route.green.plantFragments.map((f) => String(f || '').replace(/\D/g, '')).join('')
        : '';
      if (frags.length >= 3) digits.push(frags.slice(0, 3));
    }
    return [...new Set(digits)];
  }
  if (n === 5) {
    const words = [];
    for (const row of raw) {
      const w = String(row || '').replace(/[^A-Za-z]/g, '').toUpperCase();
      if (w.length >= 3) words.push(w);
    }
    return [...new Set(words)];
  }
  if (n === 3) {
    const codes = [];
    for (const row of raw) {
      const s = String(row || '').trim();
      const d = s.replace(/\D/g, '');
      if (d.length >= 3) codes.push(d);
      else if (s.length >= 3) codes.push(s.toUpperCase());
    }
    return [...new Set(codes)];
  }
  return raw.map((v) => String(v || '').trim()).filter(Boolean);
}

export function checkpointForKey(bundle, key) {
  const color = ROUTE_BY_KEY[Number(key)];
  return bundle?.route?.[color] || (bundle?.checkpoints || []).find(
    (cp) => String(cp.progressionKey) === String(key),
  ) || null;
}

export function pendingCheckpointKey(stage) {
  if (stage === 'CLUE_1_COMPLETED') return 1;
  if (['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'].includes(stage)) return 2;
  if (['CLUE_3_COMPLETED', 'CLUE_3_FAILED'].includes(stage)) return 3;
  if (['CLUE_4_COMPLETED', 'CLUE_4_FAILED', 'CLUE_4_TIMEOUT'].includes(stage)) return 4;
  if (['CLUE_5_COMPLETED', 'CLUE_5_FAILED'].includes(stage)) return 5;
  return null;
}

function scoring(bundle, n) {
  return scoringForChallenge(bundle?.event, n);
}

function buildWindow(timerSeconds, now, delaySeconds = 0) {
  const delay = Math.max(0, Number(delaySeconds) || 0);
  const startedAt = delay > 0 ? new Date(now.getTime() + delay * 1000) : now;
  const seconds = Number(timerSeconds) || 0;
  const expiresAt = seconds > 0 ? new Date(startedAt.getTime() + seconds * 1000) : null;
  return { startedAt: startedAt.toISOString(), expiresAt: expiresAt?.toISOString() || null };
}

export function ensureClueActive(bundle, state, now = new Date()) {
  const next = clone(state);
  const match = String(next.currentStage || '').match(/^CLUE_(\d)_ACTIVE$/);
  if (!match) return next;
  const n = Number(match[1]);
  const row = next.clueProgress[n] || emptyClue();
  if (row.state === 'LOCKED' || !row.startedAt) {
    const cfg = scoring(bundle, n);
    // Physical clues + Zip: no hunt countdown on blue (3) / red (5) either.
    const timerSeconds = [2, 3, 4, 5, 6].includes(n)
      ? 0
      : Number(cfg.timerSeconds || 0);
    const delay = 0;
    const window = buildWindow(timerSeconds, now, delay);
    row.state = 'ACTIVE';
    row.startedAt = window.startedAt;
    row.expiresAt = window.expiresAt;
    next.clueProgress[n] = row;
    bump(next);
  } else if (n === 4 && row.expiresAt) {
    row.expiresAt = null;
    if (row.failureReason === 'TIMEOUT' || row.failureReason === 'REVEALED_ZERO_POINTS') {
      row.failureReason = null;
    }
    next.clueProgress[n] = row;
    bump(next);
  } else if ((n === 3 || n === 5) && row.expiresAt) {
    // Drop any legacy countdown left on blue/red after pack soft-update.
    row.expiresAt = null;
    if (row.failureReason === 'TIMEOUT' || row.failureReason === 'REVEALED_ZERO_POINTS') {
      row.failureReason = null;
    }
    next.clueProgress[n] = row;
    bump(next);
  }
  return next;
}

export function tickTimers(bundle, state, now = new Date()) {
  // No hunt countdown soft-reveal — blue (3) and red (5) are untimed.
  return ensureClueActive(bundle, state, now);
}

function assertLeader(session) {
  if (session?.role !== 'leader') {
    throw huntError('Only the team leader can do this', 403, 'LEADER_ONLY');
  }
}

export function submitAnswer(bundle, session, state, challengeNumber, answer, now = new Date()) {
  assertLeader(session);
  let next = tickTimers(bundle, state, now);
  const n = Number(challengeNumber);
  if (next.currentStage === 'SCORE_LOCKED') {
    throw huntError('Score is locked', 409, 'SCORE_LOCKED');
  }
  if (next.currentStage !== `CLUE_${n}_ACTIVE`) {
    throw huntError(`Team is not on challenge ${n}`, 409, 'WRONG_STAGE');
  }
  const clue = getClue(bundle, n);
  if (!clue) throw huntError('Challenge unavailable', 409);
  const cfg = scoring(bundle, n);
  const row = next.clueProgress[n] || emptyClue();
  if (['COMPLETED', 'FAILED', 'TIMED_OUT'].includes(row.state)) {
    throw huntError('Challenge already resolved', 409, 'ALREADY_RESOLVED');
  }
  if (n === 2 && row.startedAt && now.getTime() < new Date(row.startedAt).getTime()) {
    const secs = Math.ceil((new Date(row.startedAt).getTime() - now.getTime()) / 1000);
    throw huntError(`Read the instructions first — timer starts in ${secs}s`, 409, 'TIMER_NOT_STARTED');
  }

  const expired = Boolean(row.expiresAt && now.getTime() >= new Date(row.expiresAt).getTime());
  const allowLate = cfg.allowLateSubmit !== false || n === 2 || n === 4 || n === 5;
  const accepted = acceptedAnswersForClue(bundle, n, clue);
  const correct = matchesAnyAccepted(answer, accepted, n);
  const nextAttempts = (row.attempts || 0) + 1;
  const maxAttempts = clue.maxAttempts || cfg.maxAttempts || 3;

  if (!correct) {
    row.attempts = nextAttempts;
    const failed = nextAttempts >= maxAttempts;
    // Typed clues: 3 fails → show answer (0 pts), stay ACTIVE so they type it.
    const revealAndType = failed
      && [1, 2, 3, 5].includes(n)
      && cfg.revealOnMaxAttempts !== false;
    if (revealAndType) {
      row.failureReason = 'REVEALED_ZERO_POINTS';
      row.awardedPoints = 0;
      // Keep ACTIVE — must type revealed answer to continue.
    } else if (failed) {
      row.state = 'FAILED';
      row.failureReason = 'MAX_ATTEMPTS';
      row.awardedPoints = 0;
      row.completedAt = now.toISOString();
      const dest = RESOLVED[n]?.failed;
      if (dest && canTransition(next.currentStage, dest)) next.currentStage = dest;
    }
    next.clueProgress[n] = row;
    bump(next);
    const answerText = String(clue.answer || '').trim();
    return {
      state: next,
      meta: {
        correct: false,
        revealed: row.failureReason === 'REVEALED_ZERO_POINTS',
        revealedLocation: row.failureReason === 'REVEALED_ZERO_POINTS' && n === 1
          ? (answerText || clue.destinationInstruction || null)
          : undefined,
        revealedAnswer: row.failureReason === 'REVEALED_ZERO_POINTS'
          ? (answerText || null)
          : undefined,
        attemptsLeft: Math.max(0, maxAttempts - nextAttempts),
        awardedPoints: 0,
        message: revealAndType
          ? 'Out of attempts (0 pts). Answer shown — type it exactly to continue.'
          : failed
            ? 'Out of attempts — continue.'
            : `Incorrect. ${Math.max(0, maxAttempts - nextAttempts)} of ${maxAttempts} attempts left`,
      },
    };
  }

  const award = (expired && allowLate)
    ? { total: 0, late: true }
    : computeChallengeAward({
      challengeNumber: n,
      basePoints: cfg.basePoints ?? clue.basePoints ?? 0,
      speedBonusBands: cfg.speedBonusBands || clue.speedBonusBands || [],
      startedAt: row.startedAt,
      submittedAt: now,
      awardMode: cfg.awardMode,
      timerSeconds: cfg.timerSeconds,
      allowLateSubmit: allowLate,
    });

  row.attempts = nextAttempts;
  row.state = 'COMPLETED';
  row.awardedPoints = award.total;
  row.completedAt = now.toISOString();
  if (award.late || row.failureReason === 'REVEALED_ZERO_POINTS') {
    row.awardedPoints = 0;
    row.failureReason = row.failureReason === 'REVEALED_ZERO_POINTS'
      ? 'REVEALED_ZERO_POINTS'
      : 'LATE_ZERO_POINTS';
  } else {
    row.failureReason = undefined;
  }
  next.score = (Number(next.score) || 0) + (Number(row.awardedPoints) || 0);
  const dest = RESOLVED[n]?.completed;
  if (dest && canTransition(next.currentStage, dest)) next.currentStage = dest;
  next.clueProgress[n] = row;

  // Clue 6 finish code → lock score at Mindspark Lobby
  if (n === 6) {
    if (canTransition(next.currentStage, 'FINISH_COMPLETED')) {
      next.currentStage = 'FINISH_COMPLETED';
    }
    if (canTransition(next.currentStage, 'SCORE_LOCKED')) {
      next.currentStage = 'SCORE_LOCKED';
    }
    next.finishedAt = now.toISOString();
  }
  bump(next);

  const destHint = n === 1
    ? 'Go to that place — leader scans the orange FIRST SCAN QR once.'
    : n === 2
      ? 'Green stop — leader scans the green SECOND SCAN QR once.'
      : n === 3
        ? 'Blue stop — leader scans the blue THIRD SCAN QR once.'
        : n === 4
          ? 'Purple stop — leader scans the purple FOURTH SCAN QR once → Clue 5.'
          : n === 5
            ? 'Red FIFTH SCAN — scan once → Clue 6 at Mindspark Lobby.'
            : 'Score locked at Mindspark Lobby. Export results for the desk.';

  return {
    state: next,
    meta: {
      correct: true,
      late: Boolean(award.late || row.failureReason === 'REVEALED_ZERO_POINTS' || row.failureReason === 'LATE_ZERO_POINTS'),
      awardedPoints: Number(row.awardedPoints) || 0,
      destinationInstruction: clue.destinationInstruction || destHint,
      message: n === 6
        ? 'Finish code accepted — score locked at Mindspark Lobby.'
        : destHint,
      scoreLocked: next.currentStage === 'SCORE_LOCKED',
      finalScore: next.score,
    },
  };
}

export function requestHint(bundle, session, state, challengeNumber, now = new Date()) {
  assertLeader(session);
  const n = Number(challengeNumber);
  if (n === 1) throw huntError('Hints are not available for Clue 1', 400);
  let next = tickTimers(bundle, state, now);
  if (next.currentStage !== `CLUE_${n}_ACTIVE`) {
    throw huntError(`Team is not on challenge ${n}`, 409, 'WRONG_STAGE');
  }
  const clue = getClue(bundle, n);
  const row = next.clueProgress[n];
  if (row.hintUsed) {
    return { state: next, meta: { hint: clue?.hintText || '', alreadyUsed: true } };
  }
  if (n === 2 && row.startedAt && now.getTime() < new Date(row.startedAt).getTime()) {
    throw huntError('Hints unlock when the hunt timer starts', 409, 'TIMER_NOT_STARTED');
  }
  const cost = Number(clue?.hintCost ?? scoring(bundle, n).hintCost) || 15;
  row.hintUsed = true;
  next.score = Math.max(0, (Number(next.score) || 0) - cost);
  next.clueProgress[n] = row;
  bump(next);
  return { state: next, meta: { hint: clue?.hintText || '', hintCost: cost } };
}

function normalizePaste(raw) {
  let s = String(raw || '').trim().toUpperCase();
  s = s.replace(/^CH[-_]?/i, '').replace(/^CP\d+[-_]?/i, '');
  return s.replace(/[^A-Z0-9]/g, '');
}

export function parseStationQr(raw) {
  const parsed = parseQrJson(raw);
  if (parsed?.type === 'campus_hunt_station') {
    return {
      checkpointId: String(parsed.checkpointId || ''),
      checkpointKey: parsed.checkpointKey ? String(parsed.checkpointKey) : null,
      stationCode: parsed.stationCode ? String(parsed.stationCode).toUpperCase() : null,
      secret: String(parsed.secret || ''),
      pasteCode: parsed.pasteCode ? normalizePaste(parsed.pasteCode) : null,
    };
  }
  return { pasteCode: normalizePaste(raw) };
}

function allBundleCheckpoints(bundle) {
  const list = [];
  for (const color of ['orange', 'green', 'blue', 'purple', 'red']) {
    if (bundle?.route?.[color]) list.push(bundle.route[color]);
  }
  if (Array.isArray(bundle?.checkpoints)) list.push(...bundle.checkpoints);
  if (Array.isArray(bundle?.placePosters)) list.push(...bundle.placePosters);
  return list.filter(Boolean);
}

function matchExpectedCheckpoint(bundle, key, parsed) {
  const expected = checkpointForKey(bundle, key);
  if (!expected) throw huntError('This stop is not assigned for your team', 409, 'CHECKPOINT_NOT_ASSIGNED');
  const wantStation = String(expected.stationCode || '').toUpperCase();

  if (parsed.checkpointId && parsed.secret) {
    // Exact stage poster (legacy color QR) still works.
    if (String(expected.id) === parsed.checkpointId) {
      if (expected.qrSecret && expected.qrSecret !== parsed.secret) {
        throw huntError('Invalid or outdated station QR', 403, 'BAD_STATION_SECRET');
      }
      return expected;
    }

    // One place poster: any valid QR for this campus place unlocks the current stage.
    const scanned = allBundleCheckpoints(bundle).find(
      (cp) => String(cp.id) === parsed.checkpointId,
    );
    if (scanned) {
      if (scanned.qrSecret && scanned.qrSecret !== parsed.secret) {
        throw huntError('Invalid or outdated station QR', 403, 'BAD_STATION_SECRET');
      }
      const scannedStation = String(
        scanned.stationCode || parsed.stationCode || '',
      ).toUpperCase();
      if (wantStation && scannedStation && scannedStation === wantStation) {
        return expected;
      }
      if (wantStation && scannedStation && scannedStation !== wantStation) {
        throw huntError('Wrong place — go to the location on your phone', 403, 'WRONG_PLACE');
      }
    }

    if (parsed.stationCode && wantStation && parsed.stationCode === wantStation) {
      const place = (bundle.placePosters || []).find(
        (p) => String(p.stationCode || '').toUpperCase() === wantStation
          && (!p.qrSecret || p.qrSecret === parsed.secret),
      );
      if (place) return expected;
    }

    throw huntError('Wrong poster for this stop — use the place QR at your location', 403, 'WRONG_CHECKPOINT');
  }
  const paste = parsed.pasteCode;
  if (paste && expected.pasteCode && normalizePaste(expected.pasteCode) === paste) {
    return expected;
  }
  // Place-poster paste codes
  if (paste && wantStation) {
    const place = (bundle.placePosters || []).find(
      (p) => String(p.stationCode || '').toUpperCase() === wantStation
        && p.pasteCode
        && normalizePaste(p.pasteCode) === paste,
    );
    if (place) return expected;
    const samePlace = allBundleCheckpoints(bundle).find(
      (cp) => String(cp.stationCode || '').toUpperCase() === wantStation
        && cp.pasteCode
        && normalizePaste(cp.pasteCode) === paste,
    );
    if (samePlace) return expected;
  }
  if (paste && expected.qrPayload) {
    try {
      const inner = JSON.parse(expected.qrPayload);
      if (normalizePaste(inner.pasteCode || '') === paste) return expected;
    } catch { /* ignore */ }
  }
  throw huntError('Use the place poster QR (or CH- paste code) at this location', 403, 'BAD_STATION');
}

/**
 * Record a physical poster scan on this phone.
 * Leader scans are stored on team state. Member scans stay local until the
 * leader collects a proof QR.
 */
export function submitStopJoinWord(bundle, session, state, answer, now = new Date()) {
  assertLeader(session);
  const next = tickTimers(bundle, state, now);
  const key = pendingCheckpointKey(next.currentStage);
  // Plant join-word is only at the second stop (after Clue 2), not first scan.
  if (Number(key) !== 2) throw huntError('No stop join-word needed right now', 409, 'WRONG_STAGE');
  const expected = checkpointForKey(bundle, key);
  const want = String(expected?.joinedWord || '').trim();
  if (!want) {
    // No plant word configured — allow scan without join step.
    const cp = next.checkpoints[key] || { scans: {}, confirmed: false };
    cp.joinWordOk = true;
    next.checkpoints[key] = cp;
    bump(next);
    return {
      state: next,
      meta: { correct: true, message: 'Scan the poster when ready.', skipJoin: true },
    };
  }
  const got = String(answer || '').trim().replace(/\s+/g, '');
  const ok = got.toUpperCase() === want.replace(/\s+/g, '').toUpperCase();
  const cp = next.checkpoints[key] || { scans: {}, confirmed: false, joinAttempts: 0 };
  cp.joinAttempts = (cp.joinAttempts || 0) + 1;
  if (!ok) {
    next.checkpoints[key] = cp;
    bump(next);
    return {
      state: next,
      meta: {
        correct: false,
        message: `Not quite. Find all fragments and join them. Attempts: ${cp.joinAttempts}`,
      },
    };
  }
  cp.joinWordOk = true;
  cp.joinWordAt = now.toISOString();
  next.checkpoints[key] = cp;
  bump(next);
  return {
    state: next,
    meta: { correct: true, message: 'Word accepted — scan the color poster once.' },
  };
}

export function scanStation(bundle, session, state, raw, now = new Date()) {
  assertLeader(session);
  const next = tickTimers(bundle, state, now);
  const key = pendingCheckpointKey(next.currentStage);
  if (!key) {
    if (/CLUE_\d_ACTIVE/.test(String(next.currentStage || ''))) {
      throw huntError('Type your clue answer first — then scan the poster', 409, 'WRONG_STAGE');
    }
    throw huntError('No station scan needed right now — follow the instruction on your phone', 409, 'WRONG_STAGE');
  }
  const allowed = CHECKPOINT_UNLOCK[key] || [];
  if (!allowed.includes(next.currentStage)) {
    throw huntError('Wrong stage for this poster — finish the current clue first', 409, 'WRONG_STAGE');
  }
  const expected = checkpointForKey(bundle, key);
  const cpRow = next.checkpoints[key] || { scans: {}, confirmed: false };
  const parsed = parseStationQr(raw);
  matchExpectedCheckpoint(bundle, key, parsed);
  const memberKey = session.memberKey || 'leader';
  const cp = { ...cpRow };
  cp.scans = { ...cp.scans, [memberKey]: { at: now.toISOString(), name: session.name } };
  next.checkpoints[key] = cp;
  bump(next);

  // Leader-only: one scan clears the stop (no separate team-code step).
  const claimed = confirmStation(bundle, session, next, bundle.team.teamCode, now);
  return {
    state: claimed.state,
    localScanKey: String(key),
    meta: {
      message: 'Checkpoint passed',
      verifiedCount: 1,
      requiredCount: 1,
      awaitingTeamCodeConfirm: false,
      unlockedNext: true,
      checkpointId: expected?.id,
      checkpointKey: String(key),
    },
  };
}

export async function collectMemberProof(bundle, session, state, raw) {
  assertLeader(session);
  const payload = parseQrJson(raw);
  if (!isMemberProof(payload)) {
    throw huntError('That QR is not a teammate scan proof', 400, 'BAD_PROOF');
  }
  const ok = await verifyPayload(bundle.signingKey, payload);
  if (!ok) throw huntError('Proof QR is invalid or from another pack', 403, 'BAD_PROOF_SIG');
  if (payload.team !== bundle.team.teamCode) {
    throw huntError('That proof is for a different team', 403, 'WRONG_TEAM');
  }
  const key = pendingCheckpointKey(state.currentStage);
  if (!key || String(payload.key) !== String(key)) {
    throw huntError('That proof is for a different stop', 409, 'WRONG_CHECKPOINT');
  }
  const expected = checkpointForKey(bundle, key);
  if (expected?.id && payload.cp && String(payload.cp) !== String(expected.id)) {
    throw huntError('That proof is for a different poster', 403, 'WRONG_CHECKPOINT');
  }
  const next = clone(state);
  const cp = next.checkpoints[key] || { scans: {}, confirmed: false };
  cp.scans = {
    ...cp.scans,
    [payload.slot]: { at: new Date(payload.at || Date.now()).toISOString(), name: payload.name },
  };
  next.checkpoints[key] = cp;
  bump(next);
  const required = 1;
  const verifiedCount = Object.keys(cp.scans).length;
  return {
    state: next,
    meta: {
      message: `${payload.name || payload.slot} collected (${verifiedCount}/${required})`,
      verifiedCount,
      requiredCount: required,
      awaitingTeamCodeConfirm: false,
    },
  };
}

export function confirmStation(bundle, session, state, teamCode, now = new Date()) {
  assertLeader(session);
  const next = clone(state);
  const key = pendingCheckpointKey(next.currentStage);
  if (!key) throw huntError('No checkpoint to confirm', 409, 'WRONG_STAGE');
  const expectedCode = normalizeOfflineTeamCode(bundle.team.teamCode);
  const providedCode = normalizeOfflineTeamCode(teamCode);
  if (!providedCode || providedCode !== expectedCode) {
    throw huntError('Wrong team code', 403, 'BAD_TEAM_CODE');
  }
  const required = 1;
  const cp = next.checkpoints[key] || { scans: {}, confirmed: false };
  if (Object.keys(cp.scans || {}).length < required) {
    throw huntError('Scan the poster first', 409, 'SCANS_INCOMPLETE');
  }
  cp.confirmed = true;
  cp.confirmedAt = now.toISOString();
  next.checkpoints[key] = cp;
  const mid = CHECKPOINT_NEXT[key];
  if (mid && canTransition(next.currentStage, mid)) next.currentStage = mid;
  const auto = AUTO_AFTER_CHECKPOINT[next.currentStage];
  if (auto && canTransition(next.currentStage, auto)) next.currentStage = auto;
  bump(next);
  const activated = ensureClueActive(bundle, next, now);
  return {
    state: activated,
    meta: {
      unlockedNext: true,
      message: 'Checkpoint passed',
    },
  };
}

/**
 * One-phone heal: scan was recorded but confirm never finished (older saves / interrupted).
 * Auto-confirms with the pack team code — no second UI step.
 */
export function healOnePhoneStation(bundle, session, state, now = new Date()) {
  if (!bundle || !session || session.role !== 'leader' || !state) {
    return { state, healed: false };
  }
  const key = pendingCheckpointKey(state.currentStage);
  if (!key) return { state, healed: false };
  const cp = state.checkpoints?.[key];
  if (!cp || cp.confirmed) return { state, healed: false };
  if (Object.keys(cp.scans || {}).length < 1) return { state, healed: false };
  try {
    const claimed = confirmStation(bundle, session, state, bundle.team.teamCode, now);
    return { state: claimed.state, healed: true, meta: claimed.meta };
  } catch {
    return { state, healed: false };
  }
}

export function markReachedStart(bundle, session, state, finishCode = '', now = new Date()) {
  assertLeader(session);
  const next = clone(state);
  if (!['CLUE_6_ACTIVE', 'CLUE_6_COMPLETED', 'CLUE_6_FAILED', 'FINISH_COMPLETED'].includes(next.currentStage)) {
    throw huntError('Go to Mindspark Lobby after the red scan, then enter the finish code', 409, 'WRONG_STAGE');
  }
  const code = String(finishCode || '').trim();
  if (code) {
    const clue6 = getClue(bundle, 6);
    const accepted = [
      clue6?.answer,
      ...(clue6?.acceptedAnswers || []),
      bundle.event?.organizerFinishCode,
    ].filter(Boolean);
    if (!matchesAnyAccepted(code, accepted)) {
      throw huntError('Wrong finish code — ask the organizer at Mindspark Lobby', 400, 'BAD_FINISH_CODE');
    }
  } else if (next.currentStage === 'CLUE_6_ACTIVE') {
    throw huntError('Enter the organizer finish code', 400, 'NO_FINISH_CODE');
  }
  let finishAward = 0;
  if (next.currentStage === 'CLUE_6_ACTIVE' && canTransition(next.currentStage, 'CLUE_6_COMPLETED')) {
    next.currentStage = 'CLUE_6_COMPLETED';
    const row = next.clueProgress[6] || emptyClue();
    row.state = 'COMPLETED';
    row.awardedPoints = 50;
    finishAward = 50;
    row.completedAt = now.toISOString();
    next.clueProgress[6] = row;
    next.score = (Number(next.score) || 0) + 50;
  }
  if (next.currentStage !== 'FINISH_COMPLETED' && canTransition(next.currentStage, 'FINISH_COMPLETED')) {
    next.currentStage = 'FINISH_COMPLETED';
  }
  if (canTransition(next.currentStage, 'SCORE_LOCKED')) {
    next.currentStage = 'SCORE_LOCKED';
  }
  next.finishedAt = now.toISOString();
  bump(next);
  return {
    state: next,
    meta: {
      message: finishAward
        ? 'Finish code accepted. +50 points. Score locked.'
        : 'Score locked.',
      awardedPoints: finishAward,
      finalScore: next.score,
      scoreLocked: true,
    },
  };
}

export async function applyTeamSync(bundle, state, raw) {
  const payload = parseQrJson(raw);
  if (!isTeamSync(payload)) {
    throw huntError('That QR is not a team state sync', 400, 'BAD_SYNC');
  }
  const ok = await verifyPayload(bundle.signingKey, payload);
  if (!ok) throw huntError('Team QR is invalid or from another pack', 403, 'BAD_SYNC_SIG');
  if (payload.team !== bundle.team.teamCode) {
    throw huntError('That QR is for a different team', 403, 'WRONG_TEAM');
  }
  const incomingSeq = Number(payload.seq) || 0;
  const localSeq = Number(state?.seq) || 0;
  if (incomingSeq < localSeq) {
    return { state, meta: { message: 'Your phone is already ahead — ignore this QR', stale: true } };
  }
  const next = clone(state);
  next.currentStage = payload.stage;
  next.score = payload.score;
  next.seq = incomingSeq;
  next.clueProgress = payload.clues || next.clueProgress;
  next.checkpoints = payload.cps || next.checkpoints;
  next.finishedAt = payload.finishedAt || next.finishedAt;
  next.updatedAt = new Date().toISOString();
  return { state: next, meta: { message: 'Synced from leader' } };
}

export { DEFAULT_SCORING_CONFIG };
