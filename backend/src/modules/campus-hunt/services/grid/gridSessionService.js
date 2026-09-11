const crypto = require('crypto');
const CampusHuntGridSession = require('../../models/CampusHuntGridSession');
const CampusHuntTeam = require('../../models/CampusHuntTeam');
const { generateAllLevels, validatePath, publicPuzzleView, cellKey } = require('../../grid/puzzleGenerator');
const {
  TOTAL_LEVELS,
  LEVEL_TEMPLATES,
  GRID_HINT_COST,
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

function getLevelStartedAt(session, levelIndex) {
  const progress = session.levelProgress?.[levelIndex];
  if (progress?.startedAt) return new Date(progress.startedAt);
  if (session.createdAt) return new Date(session.createdAt);
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
  session.score = Math.max(0, earned - hints * GRID_HINT_COST);
  return session.score;
}

function levelBreakdown(session) {
  return (session.levelProgress || []).map((lp, i) => {
    const template = LEVEL_TEMPLATES[i] || {};
    return {
      level: i + 1,
      label: template.label || `Level ${i + 1}`,
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
  if (fromIndex + 1 >= TOTAL_LEVELS) {
    finishSession(session);
    return { allDone: true };
  }
  session.currentLevelIndex = fromIndex + 1;
  session.levelProgress[fromIndex + 1] = {
    levelIndex: fromIndex + 1,
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
      startedAt: i === 0 ? now : undefined,
    })),
    currentLevelIndex: 0,
    scoreEarned: 0,
    hintsUsed: 0,
    score: 0,
    status: 'active',
    expiresAt,
  });

  return session;
}

function assertSessionActive(session) {
  if (!session) throw gridError('Session not found', 'SESSION_NOT_FOUND', 404);
  if (session.status === 'expired' || session.expiresAt < new Date()) {
    throw gridError('Session expired', 'SESSION_EXPIRED', 410);
  }
  if (session.status === 'completed') {
    return { completed: true };
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
    hintCost: GRID_HINT_COST,
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
  const session = await CampusHuntGridSession.findOne({ sessionToken });
  assertSessionActive(session);
  if (session.status === 'active' && applyTimeoutIfNeeded(session)) {
    await session.save();
  }
  return session;
}

async function joinByAccessCode(accessCode) {
  const normalized = String(accessCode || '').trim().toUpperCase();
  if (!normalized) throw gridError('Enter your team access code', 'NO_CODE', 400);

  const session = await CampusHuntGridSession.findOne({
    accessCode: normalized,
    status: { $in: ['active', 'completed'] },
  });

  assertSessionActive(session);
  if (session.status === 'active' && applyTimeoutIfNeeded(session)) {
    await session.save();
  } else {
    ensureLevelStarted(session, session.currentLevelIndex);
    await session.save();
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
    return {
      ok: true,
      allLevelsComplete: true,
      completionCode: session.completionCode,
      score: session.score,
      view: sessionPublicView(session),
    };
  }

  const advanced = applyTimeoutIfNeeded(session);
  await session.save();
  return {
    ok: true,
    advanced,
    timedOut: advanced,
    allLevelsComplete: session.status === 'completed',
    completionCode: session.completionCode,
    score: session.score,
    message: advanced
      ? 'Time expired — 0 points for this level.'
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

module.exports = {
  createGridSession,
  joinByAccessCode,
  getSessionByToken,
  submitLevelPath,
  failTimedOutLevel,
  useHint,
  validateCompletionCode,
  claimCompletionCode,
  expireGridSessionForRun,
  listGridSessionsForEvent,
  getSessionForRun,
  sessionPublicView,
  randomAccessCode,
  levelTimeRemainingSeconds,
  isLevelTimedOut,
  applyTimeoutIfNeeded,
  GRID_HINT_COST,
  MAX_GRID_POINTS,
  cellKey,
};
