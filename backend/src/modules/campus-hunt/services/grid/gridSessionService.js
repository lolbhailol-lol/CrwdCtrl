const crypto = require('crypto');
const CampusHuntGridSession = require('../../models/CampusHuntGridSession');
const CampusHuntTeam = require('../../models/CampusHuntTeam');
const { generateAllLevels, validatePath, publicPuzzleView, cellKey } = require('../../grid/puzzleGenerator');
const {
  TOTAL_LEVELS,
  LEVEL_TEMPLATES,
  GRID_HINT_COST,
  GRID_CLEAR_COST,
  MAX_GRID_POINTS,
} = require('../../grid/levelTemplates');

function gridError(message, code, status = 409) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function randomAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}

function randomCompletionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += chars[crypto.randomInt(0, chars.length)];
  }
  return `GRID-${suffix}`;
}

/** Round 1 Field Terminal — long window; Zip Grid has no hunt timer. */
const ROUND1_GRID_DURATION_MINUTES = 24 * 60;

function sessionTimedOut(session) {
  if (!session) return true;
  if (session.status === 'expired') return true;
  if (session.status === 'completed') return false;
  return Boolean(session.expiresAt && new Date(session.expiresAt).getTime() < Date.now());
}

function anyLevelCleared(session) {
  return (session.levelProgress || []).some((lp) => lp?.completed || lp?.failed || lp?.timedOut);
}

function levelWasPlayed(lp) {
  if (!lp) return false;
  return Boolean(lp.completed) || Number(lp.moves) > 0 || Number(lp.hintsUsed) > 0;
}

/**
 * Pack creation used to start the round-1 clock immediately, so opening Zip
 * later looked "timed out" and skipped ahead. If nobody has played and the
 * board is corrupt (off round 1 with zero outcomes), go back to round 1.
 * Real timeouts (0 pts, timedOut/failed) must not be rewound — they unlock
 * the next round or finish the game.
 */
function healUntouchedRound1Zip(session) {
  if (!session || session.missionRunId || session.entryId) return false;
  if (session.status === 'completed') return false;
  const progress = session.levelProgress || [];
  if (progress.some((lp) => levelWasPlayed(lp))) return false;
  // A real timeout / fail / clear already counts — leave it for the next round.
  if (progress.some((lp) => lp?.timedOut || lp?.failed || lp?.completed)) return false;

  const index = Number(session.currentLevelIndex) || 0;
  const puzzle = session.puzzles?.[0];
  const first = progress[0];
  const limit = Number(puzzle?.timeSeconds) || 300;
  const elapsedSec = first?.startedAt
    ? (Date.now() - new Date(first.startedAt).getTime()) / 1000
    : 0;
  // Only rewind a dead clock if it looks abandoned (well past the round limit),
  // not when the live timer just hit 0.
  const clockDeadStale = Boolean(
    first?.startedAt
    && puzzle
    && elapsedSec > limit + 90,
  );
  const offRoundOne = index !== 0;
  if (!clockDeadStale && !offRoundOne && session.status === 'active') return false;

  const now = new Date();
  const count = Math.max(session.puzzles?.length || 0, TOTAL_LEVELS);
  session.status = 'active';
  session.currentLevelIndex = 0;
  session.scoreEarned = 0;
  session.hintsUsed = 0;
  session.undosUsed = 0;
  session.clearsUsed = 0;
  session.score = 0;
  session.set('levelProgress', Array.from({ length: count }, (_, i) => ({
    levelIndex: i,
    completed: false,
    failed: false,
    timedOut: false,
    moves: 0,
    pointsAwarded: 0,
    hintsUsed: 0,
    startedAt: i === 0 ? now : undefined,
  })));
  session.markModified('levelProgress');
  return true;
}

function zipMatchesCurrentDifficulty(session) {
  if (!hasFullZipPack(session)) return false;
  return LEVEL_TEMPLATES.every((template, i) => {
    const puzzle = session.puzzles[i];
    return Number(puzzle?.rows) === template.rows
      && Number(puzzle?.cols) === template.cols
      && Number(puzzle?.timeSeconds) >= Math.floor(Number(template.timeSeconds) * 0.8);
  });
}

function hasFullZipPack(session) {
  if (!session || !Array.isArray(session.puzzles) || session.puzzles.length !== TOTAL_LEVELS) {
    return false;
  }
  for (let i = 0; i < TOTAL_LEVELS; i += 1) {
    const p = session.puzzles[i];
    if (!p || !p.rows || !p.cols || !Array.isArray(p.numbers) || !p.numbers.length) {
      return false;
    }
  }
  return true;
}

/**
 * Always write a fresh 4-round Zip pack. Uses set() so Mongoose Mixed arrays
 * cannot keep a stale shorter DocumentArray after Start over.
 */
function applyFreshZipPuzzles(session, now = new Date()) {
  const puzzles = generateAllLevels();
  session.set('puzzles', puzzles);
  session.set('levelProgress', puzzles.map((_, i) => ({
    levelIndex: i,
    completed: false,
    failed: false,
    timedOut: false,
    moves: 0,
    pointsAwarded: 0,
    hintsUsed: 0,
    startedAt: undefined,
  })));
  session.currentLevelIndex = 0;
  session.scoreEarned = 0;
  session.hintsUsed = 0;
  session.undosUsed = 0;
  session.clearsUsed = 0;
  session.score = 0;
  session.sessionToken = crypto.randomBytes(16).toString('hex');
  session.status = 'active';
  session.markModified('puzzles');
  session.markModified('levelProgress');
  return puzzles;
}

/**
 * Keep the same accessCode (printed on phone/pack) and reopen play time.
 * forceReset: Start over — wipe completed Zip Grid too, keep device key.
 */
async function reviveRound1GridSession(session, {
  durationMinutes = ROUND1_GRID_DURATION_MINUTES,
  preferredCompletionCode = '',
  forceReset = false,
} = {}) {
  if (!session) throw gridError('Session not found', 'SESSION_NOT_FOUND', 404);
  if (session.status === 'completed' && !forceReset && hasFullZipPack(session)) {
    return session;
  }

  const preferred = String(preferredCompletionCode || '').trim().toUpperCase();
  const shortPack = !hasFullZipPack(session);
  const resetProgress = forceReset
    || shortPack
    || !anyLevelCleared(session)
    || sessionTimedOut(session)
    || session.status === 'completed'
    || session.status === 'expired';
  const now = new Date();

  session.status = 'active';
  session.expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  session.completionCodeUsed = false;
  session.completionCodeUsedAt = undefined;

  if (resetProgress) {
    applyFreshZipPuzzles(session, now);
  } else {
    // Mid-session revive: stamp a fresh startedAt on the current open level so
    // an old clock does not instantly fail and flash prior level results.
    ensureLevelStarted(session, session.currentLevelIndex || 0);
    const lp = session.levelProgress?.[session.currentLevelIndex || 0];
    if (lp && !lp.completed && !lp.failed) {
      lp.startedAt = now;
      session.markModified('levelProgress');
    }
  }

  if (preferred.startsWith('GRID-')) {
    session.completionCode = preferred;
  } else if (!session.completionCode || forceReset || shortPack) {
    // Keep planted GRID code when present; only mint if missing.
    if (!session.completionCode) session.completionCode = randomCompletionCode();
  }

  await session.save();
  return session;
}

function getLevelStartedAt(session, levelIndex) {
  const progress = session.levelProgress?.[levelIndex];
  if (progress?.startedAt) return new Date(progress.startedAt);
  // Never fall back to session.createdAt — that instantly times out later levels
  // and resurfaces old failed/completed entries mid-play.
  return new Date();
}

function levelTimeRemainingSeconds(session, puzzle, levelIndex = session.currentLevelIndex) {
  const limit = Number(puzzle?.timeSeconds) || 120;
  const startedAt = getLevelStartedAt(session, levelIndex);
  const elapsed = (Date.now() - startedAt.getTime()) / 1000;
  return Math.max(0, Math.floor(limit - elapsed));
}

function isLevelTimedOut(session, puzzle) {
  return levelTimeRemainingSeconds(session, puzzle) <= 0;
}

function recomputeScore(session) {
  const earned = Number(session.scoreEarned) || 0;
  const hints = Number(session.hintsUsed) || 0;
  const undos = Number(session.undosUsed) || 0;
  const clears = Number(session.clearsUsed) || 0;
  session.score = Math.max(
    0,
    earned - (hints + undos) * GRID_HINT_COST - clears * GRID_CLEAR_COST,
  );
  return session.score;
}

function levelBreakdown(session) {
  return LEVEL_TEMPLATES.map((template, i) => {
    const lp = session.levelProgress?.[i] || {};
    return {
      level: i + 1,
      label: template.label || `Round ${i + 1}`,
      difficulty: template.difficulty || template.label || `R${i + 1}`,
      maxPoints: Number(template.points) || 0,
      pointsAwarded: Number(lp.pointsAwarded) || 0,
      completed: Boolean(lp.completed),
      failed: Boolean(lp.failed || lp.timedOut),
      timedOut: Boolean(lp.timedOut),
      hintsUsed: Number(lp.hintsUsed) || 0,
    };
  });
}

function ensureLevelStarted(session, levelIndex) {
  if (!session.levelProgress[levelIndex]) {
    session.levelProgress[levelIndex] = {
      levelIndex,
      completed: false,
      failed: false,
      timedOut: false,
      moves: 0,
      pointsAwarded: 0,
      hintsUsed: 0,
    };
  }
  if (!session.levelProgress[levelIndex].startedAt
    && !session.levelProgress[levelIndex].completed
    && !session.levelProgress[levelIndex].failed) {
    session.levelProgress[levelIndex].startedAt = new Date();
    session.markModified('levelProgress');
  }
}

function finishSession(session) {
  session.status = 'completed';
  if (!session.completionCode) {
    session.completionCode = randomCompletionCode();
  }
  recomputeScore(session);
}

function advanceAfterLevel(session, fromIndex) {
  const nextIndex = fromIndex + 1;
  // Always play the current Zip length (4). Never end early on a short legacy pack.
  if (nextIndex >= TOTAL_LEVELS) {
    finishSession(session);
    return { allDone: true };
  }
  if (!hasFullZipPack(session) || !session.puzzles?.[nextIndex]) {
    // Repair mid-run: rebuild full 4-round pack and continue at nextIndex.
    const now = new Date();
    const puzzles = generateAllLevels();
    const prior = Array.isArray(session.levelProgress) ? [...session.levelProgress] : [];
    session.set('puzzles', puzzles);
    session.set('levelProgress', puzzles.map((_, i) => {
      if (i < nextIndex && prior[i]) {
        return {
          levelIndex: i,
          completed: Boolean(prior[i].completed),
          failed: Boolean(prior[i].failed || prior[i].timedOut),
          timedOut: Boolean(prior[i].timedOut),
          moves: Number(prior[i].moves) || 0,
          pointsAwarded: Number(prior[i].pointsAwarded) || 0,
          hintsUsed: Number(prior[i].hintsUsed) || 0,
          startedAt: prior[i].startedAt,
          completedAt: prior[i].completedAt,
        };
      }
      return {
        levelIndex: i,
        completed: false,
        failed: false,
        timedOut: false,
        moves: 0,
        pointsAwarded: 0,
        hintsUsed: 0,
        startedAt: i === nextIndex ? now : undefined,
      };
    }));
    session.markModified('puzzles');
    session.markModified('levelProgress');
  }
  session.currentLevelIndex = nextIndex;
  session.levelProgress[nextIndex] = {
    levelIndex: nextIndex,
    completed: false,
    failed: false,
    timedOut: false,
    moves: 0,
    pointsAwarded: 0,
    hintsUsed: 0,
    startedAt: new Date(),
  };
  session.markModified('levelProgress');
  return { allDone: false };
}

/**
 * If current level timer expired, award 0 and advance (fail-and-continue).
 * Returns true if a timeout advance happened.
 */
function applyTimeoutIfNeeded(session) {
  if (session.status !== 'active') return false;
  const levelIndex = session.currentLevelIndex;
  const puzzle = session.puzzles[levelIndex];
  const progress = session.levelProgress[levelIndex];
  if (!puzzle || !progress || progress.completed || progress.failed) return false;
  if (!isLevelTimedOut(session, puzzle)) return false;

  session.levelProgress[levelIndex] = {
    ...progress.toObject?.() || progress,
    levelIndex,
    completed: false,
    failed: true,
    timedOut: true,
    pointsAwarded: 0,
    moves: progress.moves || 0,
    hintsUsed: progress.hintsUsed || 0,
    completedAt: new Date(),
    startedAt: progress.startedAt,
  };
  session.markModified('levelProgress');
  advanceAfterLevel(session, levelIndex);
  recomputeScore(session);
  return true;
}

async function createGridSession({
  eventId,
  teamId,
  entryId,
  missionRunId,
  durationMinutes = 45,
  preferredCompletionCode = '',
}) {
  const team = await CampusHuntTeam.findById(teamId).select('teamCode teamName');
  if (!team) throw gridError('Team not found', 'TEAM_NOT_FOUND', 404);

  const puzzles = generateAllLevels();
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  const now = new Date();

  let accessCode = randomAccessCode();
  let attempts = 0;
  while (attempts < 10) {
    // eslint-disable-next-line no-await-in-loop
    const clash = await CampusHuntGridSession.findOne({ accessCode, status: 'active' });
    if (!clash) break;
    accessCode = randomAccessCode();
    attempts += 1;
  }

  const preferred = String(preferredCompletionCode || '').trim().toUpperCase();
  const sessionToken = crypto.randomBytes(16).toString('hex');
  const session = await CampusHuntGridSession.create({
    eventId,
    teamId,
    entryId,
    missionRunId,
    sessionToken,
    accessCode,
    teamCode: team.teamCode,
    teamLabel: team.teamName || team.teamCode,
    puzzles,
    levelProgress: puzzles.map((_, i) => ({
      levelIndex: i,
      completed: false,
      failed: false,
      timedOut: false,
      moves: 0,
      pointsAwarded: 0,
      hintsUsed: 0,
      startedAt: undefined,
    })),
    currentLevelIndex: 0,
    scoreEarned: 0,
    hintsUsed: 0,
    score: 0,
    status: 'active',
    expiresAt,
    // Round 1 / offline: finish Zip Grid with the team's planted GRID code.
    ...(preferred.startsWith('GRID-') ? { completionCode: preferred } : {}),
  });

  // Guarantee Mixed array length after create (defensive against driver quirks).
  if (!hasFullZipPack(session)) {
    applyFreshZipPuzzles(session, now);
    if (preferred.startsWith('GRID-')) session.completionCode = preferred;
    await session.save();
  }

  return session;
}

function assertSessionActive(session) {
  if (!session) throw gridError('Session not found', 'SESSION_NOT_FOUND', 404);
  // Completed Zip Grid must still show GRID-XXXX after wall-clock expiry.
  if (session.status === 'completed') {
    return { completed: true };
  }
  if (session.status === 'expired' || sessionTimedOut(session)) {
    throw gridError('Session expired', 'SESSION_EXPIRED', 410);
  }
  return { completed: false };
}

function sessionPublicView(session) {
  const active = assertSessionActive(session);
  const levelIndex = session.currentLevelIndex;
  const puzzle = session.puzzles[levelIndex];
  if (!active.completed) {
    ensureLevelStarted(session, levelIndex);
  }

  recomputeScore(session);

  return {
    sessionToken: session.sessionToken,
    teamCode: session.teamCode,
    teamLabel: session.teamLabel,
    currentLevel: levelIndex + 1,
    totalLevels: TOTAL_LEVELS,
    levelProgress: session.levelProgress,
    levelBreakdown: levelBreakdown(session),
    score: session.score,
    scoreEarned: session.scoreEarned || 0,
    hintsUsed: session.hintsUsed || 0,
    undosUsed: session.undosUsed || 0,
    clearsUsed: session.clearsUsed || 0,
    hintCost: GRID_HINT_COST,
    undoCost: GRID_HINT_COST,
    clearCost: GRID_CLEAR_COST,
    maxScore: MAX_GRID_POINTS,
    status: session.status,
    completed: active.completed,
    completionCode: active.completed ? session.completionCode : null,
    puzzle: puzzle && !active.completed ? publicPuzzleView(puzzle) : (puzzle ? publicPuzzleView(puzzle) : null),
    levelStartedAt: getLevelStartedAt(session, levelIndex).toISOString(),
    levelTimeSeconds: puzzle?.timeSeconds || null,
    levelTimeRemaining: puzzle && !active.completed
      ? levelTimeRemainingSeconds(session, puzzle, levelIndex)
      : null,
    levelPoints: puzzle?.points ?? LEVEL_TEMPLATES[levelIndex]?.points ?? 0,
    expiresAt: session.expiresAt,
  };
}

async function loadActiveSession(sessionToken) {
  let session = await CampusHuntGridSession.findOne({ sessionToken });
  assertSessionActive(session);
  // Stale laptop token after Start over may still hit an active short pack — upgrade in place.
  if (
    session.status === 'active'
    && isRound1GridSession(session)
    && !hasFullZipPack(session)
  ) {
    session = await reviveRound1GridSession(session, { forceReset: true });
  }
  if (session.status === 'active' || session.status === 'expired') {
    // Timeout first so a live clock hitting 0 unlocks the next round (or
    // finishes on the last round). Heal only repairs corrupt untouched packs.
    ensureLevelStarted(session, session.currentLevelIndex);
    const advanced = applyTimeoutIfNeeded(session);
    if (session.status === 'completed') {
      await session.save();
      return session;
    }
    const healed = healUntouchedRound1Zip(session);
    if (healed) {
      session.status = 'active';
      ensureLevelStarted(session, session.currentLevelIndex);
    }
    if (advanced || healed) {
      await session.save();
    }
  }
  return session;
}

async function joinByAccessCode(accessCode) {
  const normalized = String(accessCode || '').trim().toUpperCase();
  if (!normalized) throw gridError('Enter your team access code', 'NO_CODE', 400);

  let session = await CampusHuntGridSession.findOne({
    accessCode: normalized,
    status: { $in: ['active', 'completed', 'expired'] },
  }).sort({ createdAt: -1 });

  if (!session) {
    throw gridError('Unknown access code — check the device key on the leader phone', 'SESSION_NOT_FOUND', 404);
  }

  // Round 1: packs mint keys early — auto-revive so fest-day join still works.
  // Also upgrade legacy 2/3-round completed sessions so Start over / re-join always gets 4.
  if (isRound1GridSession(session)) {
    const shortPack = !hasFullZipPack(session);
    if (
      shortPack
      || (
        session.status !== 'completed'
        && (session.status === 'expired' || sessionTimedOut(session))
      )
    ) {
      session = await reviveRound1GridSession(session, {
        forceReset: shortPack,
      });
    }
  }

  assertSessionActive(session);
  if (session.status === 'active') {
    // Same order as loadActiveSession: timeout unlock first, then heal.
    ensureLevelStarted(session, session.currentLevelIndex);
    const advanced = applyTimeoutIfNeeded(session);
    if (session.status === 'completed') {
      await session.save();
      return sessionPublicView(session);
    }
    const healed = healUntouchedRound1Zip(session);
    if (healed) {
      session.status = 'active';
      ensureLevelStarted(session, session.currentLevelIndex);
    }
    if (advanced || healed) {
      await session.save();
    } else {
      if (isRound1GridSession(session)) {
        const remainingMs = session.expiresAt
          ? new Date(session.expiresAt).getTime() - Date.now()
          : 0;
        if (remainingMs < 60 * 60 * 1000) {
          session.expiresAt = new Date(Date.now() + ROUND1_GRID_DURATION_MINUTES * 60 * 1000);
        }
      }
      await session.save();
    }
  }
  return sessionPublicView(session);
}

async function getSessionByToken(sessionToken) {
  const session = await loadActiveSession(sessionToken);
  ensureLevelStarted(session, session.currentLevelIndex);
  await session.save();
  return sessionPublicView(session);
}

async function submitLevelPath(sessionToken, path) {
  const session = await loadActiveSession(sessionToken);
  if (session.status === 'completed') {
    return {
      ok: true,
      complete: true,
      allLevelsComplete: true,
      completionCode: session.completionCode,
      score: session.score,
      view: sessionPublicView(session),
    };
  }

  const levelIndex = session.currentLevelIndex;
  const puzzle = session.puzzles[levelIndex];
  if (!puzzle) throw gridError('Invalid level', 'INVALID_LEVEL');

  ensureLevelStarted(session, levelIndex);

  if (isLevelTimedOut(session, puzzle)) {
    applyTimeoutIfNeeded(session);
    await session.save();
    return {
      ok: false,
      timedOut: true,
      advanced: true,
      message: 'Time expired — 0 points for this level. Next level unlocked.',
      score: session.score,
      view: sessionPublicView(session),
    };
  }

  const result = validatePath(puzzle, path);
  if (!result.ok) {
    return { ok: false, message: result.message, view: sessionPublicView(session) };
  }

  const points = Number(puzzle.points) || Number(LEVEL_TEMPLATES[levelIndex]?.points) || 0;
  const prior = session.levelProgress[levelIndex] || {};
  session.levelProgress[levelIndex] = {
    levelIndex,
    completed: true,
    failed: false,
    timedOut: false,
    moves: result.moves,
    pointsAwarded: points,
    hintsUsed: prior.hintsUsed || 0,
    completedAt: new Date(),
    startedAt: prior.startedAt || new Date(),
  };
  session.scoreEarned = (Number(session.scoreEarned) || 0) + points;
  session.markModified('levelProgress');
  recomputeScore(session);

  const { allDone } = advanceAfterLevel(session, levelIndex);
  await session.save();

  if (allDone) {
    return {
      ok: true,
      complete: true,
      levelComplete: true,
      allLevelsComplete: true,
      completionCode: session.completionCode,
      pointsAwarded: points,
      score: session.score,
      moves: result.moves,
      view: sessionPublicView(session),
    };
  }

  return {
    ok: true,
    complete: true,
    levelComplete: true,
    allLevelsComplete: false,
    pointsAwarded: points,
    score: session.score,
    moves: result.moves,
    view: sessionPublicView(session),
  };
}

/** Explicit timeout advance (client when clock hits 0). */
async function failTimedOutLevel(sessionToken) {
  const session = await loadActiveSession(sessionToken);
  if (session.status === 'completed') {
    recomputeScore(session);
    return {
      ok: true,
      allLevelsComplete: true,
      timedOut: true,
      advanced: true,
      completionCode: session.completionCode,
      score: session.score,
      levelBreakdown: levelBreakdown(session),
      message: 'Time up — Zip finished. Give the GRID code to your leader.',
      view: sessionPublicView(session),
    };
  }

  const fromIndex = session.currentLevelIndex;
  const advanced = applyTimeoutIfNeeded(session);
  await session.save();

  if (session.status === 'completed') {
    return {
      ok: true,
      allLevelsComplete: true,
      timedOut: true,
      advanced: true,
      completionCode: session.completionCode,
      score: session.score,
      levelBreakdown: levelBreakdown(session),
      message: 'Time up on the last round — Zip finished. Give the GRID code to your leader.',
      view: sessionPublicView(session),
    };
  }

  const moved = advanced || session.currentLevelIndex !== fromIndex;
  return {
    ok: true,
    advanced: moved,
    timedOut: moved,
    allLevelsComplete: false,
    completionCode: null,
    score: session.score,
    levelBreakdown: levelBreakdown(session),
    message: moved
      ? `Time up — Round ${session.currentLevelIndex + 1} unlocked.`
      : 'Timer still running.',
    view: sessionPublicView(session),
  };
}

/**
 * Hint: reveal next solution cell after current path length.
 * Costs GRID_HINT_COST points from final score.
 */
async function useHint(sessionToken, path = []) {
  const session = await loadActiveSession(sessionToken);
  if (session.status === 'completed') {
    throw gridError('Session already complete', 'ALREADY_COMPLETE');
  }

  const levelIndex = session.currentLevelIndex;
  const puzzle = session.puzzles[levelIndex];
  if (!puzzle?.solutionPath?.length) {
    throw gridError('No hint available', 'NO_HINT');
  }

  if (isLevelTimedOut(session, puzzle)) {
    applyTimeoutIfNeeded(session);
    await session.save();
    throw gridError('Time expired for this level', 'LEVEL_TIMEOUT', 400);
  }

  const pathLen = Array.isArray(path) ? path.length : 0;
  const nextIndex = Math.min(pathLen, puzzle.solutionPath.length - 1);
  const nextCell = puzzle.solutionPath[nextIndex];

  const progress = session.levelProgress[levelIndex] || { levelIndex, hintsUsed: 0 };
  progress.hintsUsed = (Number(progress.hintsUsed) || 0) + 1;
  session.levelProgress[levelIndex] = {
    ...progress.toObject?.() || progress,
    hintsUsed: progress.hintsUsed,
  };
  session.hintsUsed = (Number(session.hintsUsed) || 0) + 1;
  session.markModified('levelProgress');
  recomputeScore(session);
  await session.save();

  return {
    ok: true,
    hintCost: GRID_HINT_COST,
    hintsUsed: session.hintsUsed,
    score: session.score,
    nextCell,
    message: `Hint used (−${GRID_HINT_COST} pts). Next cell highlighted.`,
    view: sessionPublicView(session),
  };
}

/**
 * Undo: each removed step costs GRID_HINT_COST.
 * Clear: wipe the path for a flat GRID_CLEAR_COST (body.clear = true).
 */
async function useUndo(sessionToken, steps = 1, { clear = false } = {}) {
  const session = await loadActiveSession(sessionToken);
  if (session.status === 'completed') {
    throw gridError('Session already complete', 'ALREADY_COMPLETE');
  }

  const levelIndex = session.currentLevelIndex;
  const puzzle = session.puzzles[levelIndex];
  if (isLevelTimedOut(session, puzzle)) {
    applyTimeoutIfNeeded(session);
    await session.save();
    throw gridError('Time expired for this level', 'LEVEL_TIMEOUT', 400);
  }

  if (clear) {
    session.clearsUsed = (Number(session.clearsUsed) || 0) + 1;
    recomputeScore(session);
    await session.save();
    return {
      ok: true,
      clear: true,
      clearCost: GRID_CLEAR_COST,
      clearsUsed: session.clearsUsed,
      undosUsed: session.undosUsed || 0,
      score: session.score,
      message: `Clear (−${GRID_CLEAR_COST} pts).`,
      view: sessionPublicView(session),
    };
  }

  const count = Math.max(1, Math.min(40, Number(steps) || 1));
  session.undosUsed = (Number(session.undosUsed) || 0) + count;
  recomputeScore(session);
  await session.save();

  return {
    ok: true,
    undoCost: GRID_HINT_COST,
    steps: count,
    undosUsed: session.undosUsed,
    clearsUsed: session.clearsUsed || 0,
    score: session.score,
    message: count === 1
      ? `Undo (−${GRID_HINT_COST} pts).`
      : `Undid ${count} steps (−${count * GRID_HINT_COST} pts).`,
    view: sessionPublicView(session),
  };
}

/** Read-only check — does not mark the code as used. */
async function validateCompletionCode(completionCode, { teamId, missionRunId } = {}) {
  const normalized = String(completionCode || '').trim().toUpperCase();
  const session = await CampusHuntGridSession.findOne({
    completionCode: normalized,
    status: 'completed',
    completionCodeUsed: false,
  });

  if (!session) {
    return { ok: false, message: 'Invalid or already used completion code.' };
  }

  if (teamId && String(session.teamId) !== String(teamId)) {
    return { ok: false, message: 'This code belongs to another team.' };
  }
  if (missionRunId && String(session.missionRunId) !== String(missionRunId)) {
    return { ok: false, message: 'Code does not match your current mission run.' };
  }

  recomputeScore(session);
  return { ok: true, session, score: session.score };
}

/** Atomically claim a completion code after mission points are awarded. */
async function claimCompletionCode(completionCode, { teamId, missionRunId } = {}) {
  const normalized = String(completionCode || '').trim().toUpperCase();
  const query = {
    completionCode: normalized,
    status: 'completed',
    completionCodeUsed: false,
  };
  if (teamId) query.teamId = teamId;
  if (missionRunId) query.missionRunId = missionRunId;

  const session = await CampusHuntGridSession.findOneAndUpdate(
    query,
    { $set: { completionCodeUsed: true, completionCodeUsedAt: new Date() } },
    { new: true },
  );

  if (!session) {
    return { ok: false, message: 'Invalid or already used completion code.' };
  }

  recomputeScore(session);
  return { ok: true, session, score: session.score };
}

async function expireGridSessionForRun(missionRunId) {
  if (!missionRunId) return;
  await CampusHuntGridSession.updateMany(
    { missionRunId, status: { $in: ['active', 'completed'] } },
    { $set: { status: 'expired' } },
  );
}

async function listGridSessionsForEvent(eventId) {
  const sessions = await CampusHuntGridSession.find({ eventId })
    .sort({ teamCode: 1 })
    .select('teamCode teamLabel accessCode status currentLevelIndex levelProgress score scoreEarned hintsUsed completionCode completionCodeUsed expiresAt')
    .lean();

  return sessions.map((s) => ({
    teamCode: s.teamCode,
    teamLabel: s.teamLabel,
    accessCode: s.accessCode,
    status: s.status,
    currentLevel: s.currentLevelIndex + 1,
    levelsCompleted: (s.levelProgress || []).filter((l) => l.completed).length,
    totalLevels: TOTAL_LEVELS,
    score: s.score ?? 0,
    scoreEarned: s.scoreEarned ?? 0,
    hintsUsed: s.hintsUsed ?? 0,
    completionCode: s.status === 'completed' ? s.completionCode : null,
    completionCodeUsed: Boolean(s.completionCodeUsed),
    expiresAt: s.expiresAt,
  }));
}

async function getSessionForRun(missionRunId) {
  return CampusHuntGridSession.findOne({ missionRunId, status: { $in: ['active', 'completed'] } });
}

/**
 * Round 1 Clue 4 Field Terminal — Zip Grid session without a Finale mission run.
 * Reuses the team's latest open round-1 session (no missionRunId / entryId).
 * Auto-revives expired sessions so the same device key on the pack still works.
 */
async function ensureRound1FieldTerminalGrid(team, {
  durationMinutes = ROUND1_GRID_DURATION_MINUTES,
  preferredCompletionCode = '',
  forceReset = false,
} = {}) {
  if (!team?._id || !team?.eventId) {
    throw gridError('Team required for Field Terminal grid', 'TEAM_REQUIRED', 400);
  }

  const preferred = String(preferredCompletionCode || '').trim().toUpperCase();

  const existing = await CampusHuntGridSession.findOne({
    teamId: team._id,
    eventId: team.eventId,
    status: { $in: ['active', 'completed', 'expired'] },
    missionRunId: null,
    entryId: null,
  }).sort({ createdAt: -1 });

  if (existing) {
    if (forceReset) {
      return reviveRound1GridSession(existing, {
        durationMinutes,
        preferredCompletionCode: preferred,
        forceReset: true,
      });
    }

    if (existing.status === 'completed') {
      if (preferred.startsWith('GRID-') && !existing.completionCode) {
        existing.completionCode = preferred;
        await existing.save();
      }
      return existing;
    }

    if (existing.status === 'expired' || sessionTimedOut(existing)) {
      return reviveRound1GridSession(existing, {
        durationMinutes,
        preferredCompletionCode: preferred,
      });
    }

    if (preferred.startsWith('GRID-') && existing.completionCode !== preferred) {
      existing.completionCode = preferred;
    }
    // Upgrade legacy packs, and replace unstarted old boards with the current harder Zip.
    const staleBoard = !hasFullZipPack(existing)
      || (!anyLevelCleared(existing) && !zipMatchesCurrentDifficulty(existing));
    if (staleBoard) {
      return reviveRound1GridSession(existing, {
        durationMinutes,
        preferredCompletionCode: preferred,
        forceReset: true,
      });
    }
    const remainingMs = existing.expiresAt
      ? new Date(existing.expiresAt).getTime() - Date.now()
      : 0;
    if (remainingMs < 2 * 60 * 60 * 1000) {
      existing.expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    }
    await existing.save();
    return existing;
  }

  return createGridSession({
    eventId: team.eventId,
    teamId: team._id,
    durationMinutes,
    preferredCompletionCode: preferred,
  });
}

/** True when session is Round 1 Field Terminal (not Finale). */
function isRound1GridSession(session) {
  if (!session) return false;
  return !session.missionRunId && !session.entryId;
}

module.exports = {
  createGridSession,
  joinByAccessCode,
  getSessionByToken,
  submitLevelPath,
  failTimedOutLevel,
  useHint,
  useUndo,
  validateCompletionCode,
  claimCompletionCode,
  expireGridSessionForRun,
  listGridSessionsForEvent,
  getSessionForRun,
  ensureRound1FieldTerminalGrid,
  isRound1GridSession,
  sessionPublicView,
  randomAccessCode,
  levelTimeRemainingSeconds,
  isLevelTimedOut,
  applyTimeoutIfNeeded,
  GRID_HINT_COST,
  GRID_CLEAR_COST,
  MAX_GRID_POINTS,
  cellKey,
};
