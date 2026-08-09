const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntTeamProgress = require('../models/CampusHuntTeamProgress');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const { matchesAnyAccepted, normalizeAnswer } = require('../utils/answerNormalize');
const {
  requiredStageForChallenge,
  resolvedStageForChallenge,
  canTransition,
  isChallengeTerminalProgress,
} = require('./stateMachine');
const {
  computeChallengeAward,
  applyHintDeduction,
  applyAward,
} = require('./scoringService');
const {
  buildChallengeWindow,
  isExpired,
  isRoundClosed,
} = require('./timerService');
const { writeAudit } = require('./auditService');
const { DEFAULT_SCORING_CONFIG, CLUE_HOW_TO } = require('../constants');

async function getChallengeForTeam(team, challengeNumber, { includeSecrets = false } = {}) {
  const filter = Number(challengeNumber) === 1
    ? {
      _id: team.clue1ChallengeId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 1,
      active: true,
    }
    : {
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber,
      variantKey: 'DEFAULT',
      active: true,
    };
  const q = CampusHuntChallenge.findOne(filter);
  if (includeSecrets) {
    q.select('+answer +acceptedAnswers +hintText');
  }
  return q;
}

async function getOrCreateProgress(team, challenge) {
  let progress = await CampusHuntTeamProgress.findOne({
    teamId: team._id,
    challengeId: challenge._id,
  });
  if (progress) return progress;

  try {
    progress = await CampusHuntTeamProgress.create({
      eventId: team.eventId,
      teamId: team._id,
      challengeId: challenge._id,
      challengeNumber: challenge.challengeNumber,
      state: 'LOCKED',
    });
  } catch (err) {
    if (err?.code === 11000) {
      return CampusHuntTeamProgress.findOne({
        teamId: team._id,
        challengeId: challenge._id,
      });
    }
    throw err;
  }
  return progress;
}

function scoringForChallenge(event, challengeNumber) {
  const cfg = event?.scoringConfig || DEFAULT_SCORING_CONFIG;
  if (challengeNumber === 1) return cfg.clue1 || DEFAULT_SCORING_CONFIG.clue1;
  if (challengeNumber === 2) return cfg.clue2 || DEFAULT_SCORING_CONFIG.clue2;
  if (challengeNumber === 3) return cfg.clue3 || DEFAULT_SCORING_CONFIG.clue3;
  if (challengeNumber === 4) return cfg.clue4 || DEFAULT_SCORING_CONFIG.clue4;
  return { basePoints: 0, maxAttempts: 3, timerSeconds: 0, speedBonusBands: [] };
}

/**
 * Activate a challenge when team enters CLUE_N_ACTIVE (idempotent).
 */
async function ensureChallengeActive(team, challengeNumber, now = new Date()) {
  const challenge = await getChallengeForTeam(team, challengeNumber);
  if (!challenge) {
    const err = new Error(`Challenge ${challengeNumber} not configured for this route`);
    err.status = 404;
    throw err;
  }

  const event = await CampusHuntEvent.findById(team.eventId);
  const scoring = scoringForChallenge(event, challengeNumber);
  const timerSeconds = challenge.timerSeconds || scoring.timerSeconds || 0;

  let progress = await getOrCreateProgress(team, challenge);

  if (progress.state === 'LOCKED' || !progress.startedAt) {
    const window = buildChallengeWindow(timerSeconds, now);
    const updated = await CampusHuntTeamProgress.findOneAndUpdate(
      {
        _id: progress._id,
        $or: [{ state: 'LOCKED' }, { startedAt: null }],
      },
      {
        $set: {
          state: 'ACTIVE',
          startedAt: window.startedAt,
          expiresAt: window.expiresAt,
        },
      },
      { new: true },
    );
    progress = updated || (await CampusHuntTeamProgress.findById(progress._id));
  }

  return { challenge, progress, event, scoring };
}

const RESOLVED_PROGRESS = new Set(['COMPLETED', 'FAILED', 'TIMED_OUT', 'VOIDED']);

function canExposeChallengeContent(challengeNumber, progressState, teamStage) {
  if (RESOLVED_PROGRESS.has(String(progressState || ''))) return true;
  return String(teamStage) === `CLUE_${challengeNumber}_ACTIVE`;
}

function publicChallengeView(challenge, progress, {
  isLeader,
  memberIndex = 0,
  includeHint = false,
  hintText = null,
  now = new Date(),
  scoring = null,
  revealedLocation = null,
  teamStage = null,
} = {}) {
  const n = challenge.challengeNumber;
  const state = progress?.state || 'LOCKED';
  const expose = canExposeChallengeContent(n, state, teamStage);

  // Locked future clues: metadata only (anti-leak for 40-team events)
  if (!expose) {
    return {
      challengeNumber: n,
      type: challenge.type,
      prompt: null,
      howTo: null,
      state,
      attempts: progress?.attempts || 0,
      maxAttempts: challenge.maxAttempts || scoring?.maxAttempts || 3,
      attemptsLeft: null,
      awardedPoints: null,
      locked: true,
    };
  }

  let prompt = challenge.prompt || '';

  if (n === 1 && !isLeader) {
    prompt = null; // members never receive the leader-only Clue 1 text
  }
  if (n === 4 && Array.isArray(challenge.memberPrompts) && challenge.memberPrompts.length) {
    prompt = challenge.memberPrompts[memberIndex] || '';
  }

  const timeExpired = Boolean(
    progress?.expiresAt && isExpired(progress.expiresAt, now) && progress.state === 'ACTIVE',
  );

  const maxAttempts = challenge.maxAttempts || scoring?.maxAttempts || 3;
  const attempts = progress?.attempts || 0;
  const nextAttempt = attempts + 1;
  const attemptBands = scoring?.attemptBands || [];
  const nextAttemptPoints = n === 1 && progress?.state === 'ACTIVE'
    ? (attemptBands.find((b) => Number(b.attempt) === nextAttempt)?.points ?? 0)
    : null;

  const revealed = Boolean(
    revealedLocation
    || progress?.failureReason === 'REVEALED_ZERO_POINTS',
  );

  const showDestination = progress?.state === 'COMPLETED'
    || progress?.failureReason === 'REVEALED_ZERO_POINTS'
    || revealed;

  return {
    challengeNumber: n,
    type: challenge.type,
    prompt,
    howTo: CLUE_HOW_TO[n] || null,
    destinationInstruction: showDestination
      ? (challenge.destinationInstruction
        || (n === 1
          ? 'Go to the location. Every team member must scan the station QR.'
          : ''))
      : undefined,
    // Never echo canonical answer string into client messages path — only location label for reveal
    revealedLocation: revealed && n === 1
      ? (revealedLocation || challenge.destinationInstruction || null)
      : undefined,
    state,
    attempts,
    maxAttempts,
    attemptsLeft: Math.max(0, maxAttempts - attempts),
    nextAttemptPoints,
    attemptBands: n === 1 && state === 'ACTIVE' ? attemptBands : undefined,
    hintUsed: Boolean(progress?.hintUsed),
    hintText: includeHint && progress?.hintUsed ? (hintText || null) : undefined,
    startedAt: progress?.startedAt || null,
    expiresAt: progress?.expiresAt || null,
    awardedPoints: progress?.awardedPoints ?? null,
    failureReason: progress?.failureReason || null,
    timeExpired,
    allowLateSubmit: n === 2,
    scoringBands: n === 2 && state === 'ACTIVE' ? (scoring?.speedBonusBands || null) : undefined,
    locked: false,
  };
}

function memberIndexForUser(team, userId) {
  if (team.isLeader(userId)) return 0;
  const idx = (team.memberUserIds || []).findIndex((id) => String(id) === String(userId));
  return idx >= 0 ? idx + 1 : -1;
}

async function submitAnswer({
  team,
  userId,
  isLeader,
  challengeNumber,
  answer,
  requestId,
  now = new Date(),
}) {
  if (Number(challengeNumber) === 1 && team.currentStage === 'WAITING') {
    const { releaseTeamIfDue } = require('./teamReleaseService');
    const released = await releaseTeamIfDue({ team, now });
    team = released.team;
  }
  if (Number(challengeNumber) === 1 && !isLeader) {
    const err = new Error('Only the team leader can submit Clue 1');
    err.status = 403;
    err.code = 'LEADER_ONLY';
    throw err;
  }
  if (!isLeader && Number(challengeNumber) !== 1) {
    // Spec: members participate in viewing; leader submits team answers
    const err = new Error('Only the team leader can submit challenge answers');
    err.status = 403;
    err.code = 'LEADER_ONLY';
    throw err;
  }

  if (team.currentStage === 'SCORE_LOCKED') {
    const err = new Error('Score is locked');
    err.status = 409;
    throw err;
  }

  const requiredStage = requiredStageForChallenge(challengeNumber);
  if (team.currentStage !== requiredStage) {
    const err = new Error(`Team is not on challenge ${challengeNumber}`);
    err.status = 409;
    err.code = 'WRONG_STAGE';
    throw err;
  }

  const round = team.roundId ? await CampusHuntRound.findById(team.roundId) : null;
  if (round && isRoundClosed(round, now)) {
    const err = new Error('Round is closed');
    err.status = 409;
    err.code = 'ROUND_CLOSED';
    throw err;
  }

  const challenge = await getChallengeForTeam(team, challengeNumber, { includeSecrets: true });
  if (!challenge || challenge.voided) {
    const err = new Error('Challenge unavailable');
    err.status = 409;
    throw err;
  }

  let { progress, event, scoring } = await ensureChallengeActive(team, challengeNumber, now);
  progress = await CampusHuntTeamProgress.findById(progress._id);

  // Idempotent replay
  if (requestId && progress.lastRequestId === requestId && isChallengeTerminalProgress(progress.state)) {
    return {
      correct: progress.state === 'COMPLETED',
      state: progress.state,
      attemptsLeft: Math.max(0, challenge.maxAttempts - progress.attempts),
      awardedPoints: progress.awardedPoints ?? 0,
      destinationInstruction: progress.state === 'COMPLETED' ? challenge.destinationInstruction : undefined,
      teamStage: team.currentStage,
      currentScore: team.currentScore,
      alreadyProcessed: true,
    };
  }

  if (isChallengeTerminalProgress(progress.state)) {
    const err = new Error('Challenge already resolved');
    err.status = 409;
    err.code = 'ALREADY_RESOLVED';
    throw err;
  }

  const expired = isExpired(progress.expiresAt, now);
  const allowLate =
    Number(challengeNumber) === 2
    && (scoring.allowLateSubmit !== false);

  // Clue 2+: after timer, still accept answer for 0 points (late). Other clues timeout-lock.
  if (expired && !allowLate) {
    return finalizeTimeout({ team, challenge, progress, now });
  }

  const accepted = [
    challenge.answer,
    ...(challenge.acceptedAnswers || []),
  ].filter(Boolean);

  const correct = matchesAnyAccepted(answer, accepted);
  const nextAttempts = (progress.attempts || 0) + 1;
  const maxAttempts = challenge.maxAttempts || scoring.maxAttempts || 3;

  if (!correct) {
    const failed = nextAttempts >= maxAttempts;
    // Clue 1: after 3 fails → reveal location, 0 pts, still advance to scan
    const clue1Reveal = failed
      && Number(challengeNumber) === 1
      && scoring.revealOnMaxAttempts !== false;

    const update = {
      attempts: nextAttempts,
      submittedAt: now,
      lastRequestId: requestId || progress.lastRequestId,
    };
    if (clue1Reveal) {
      update.state = 'COMPLETED';
      update.failureReason = 'REVEALED_ZERO_POINTS';
      update.awardedPoints = 0;
      update.completedAt = now;
    } else if (failed) {
      update.state = 'FAILED';
      update.failureReason = 'MAX_ATTEMPTS';
      update.awardedPoints = 0;
      update.completedAt = now;
    }

    const updatedProgress = await CampusHuntTeamProgress.findOneAndUpdate(
      { _id: progress._id, state: 'ACTIVE', attempts: progress.attempts },
      { $set: update },
      { new: true },
    );

    let updatedTeam = team;
    const failInc = { $inc: { 'stats.failedAttempts': 1 } };
    if (failed || clue1Reveal) {
      const nextStage = clue1Reveal
        ? resolvedStageForChallenge(challengeNumber, 'completed')
        : resolvedStageForChallenge(challengeNumber, 'failed');
      if (nextStage && canTransition(team.currentStage, nextStage)) {
        updatedTeam = await CampusHuntTeam.findOneAndUpdate(
          { _id: team._id, currentStage: team.currentStage },
          {
            $set: { currentStage: nextStage },
            ...failInc,
          },
          { new: true },
        ) || team;
      } else {
        updatedTeam = await CampusHuntTeam.findOneAndUpdate(
          { _id: team._id },
          failInc,
          { new: true },
        ) || team;
      }
    } else {
      updatedTeam = await CampusHuntTeam.findOneAndUpdate(
        { _id: team._id },
        failInc,
        { new: true },
      ) || team;
    }

    const attemptsLeft = Math.max(0, maxAttempts - nextAttempts);
    const nextPts = scoring.attemptBands?.find((b) => Number(b.attempt) === nextAttempts + 1)?.points;

    return {
      correct: false,
      state: updatedProgress?.state || (failed ? 'FAILED' : 'ACTIVE'),
      attemptsLeft,
      awardedPoints: 0,
      revealed: Boolean(clue1Reveal),
      revealedLocation: clue1Reveal ? (challenge.destinationInstruction || null) : undefined,
      destinationInstruction: clue1Reveal
        ? (challenge.destinationInstruction || '')
        : undefined,
      nextAttemptPoints: !failed && nextPts != null ? nextPts : undefined,
      message: clue1Reveal
        ? 'Out of attempts. Location unlocked (0 points). Go scan the station QR with all 4 members.'
        : attemptsLeft > 0
          ? `Incorrect. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left`
            + (nextPts != null ? ` (next correct = ${nextPts} pts)` : '')
          : 'Incorrect. No attempts left.',
      teamStage: updatedTeam.currentStage,
      currentScore: updatedTeam.currentScore,
    };
  }

  // Correct answer (Clue 1 attempt bands / Clue 2 late = 0 pts)
  const award = computeChallengeAward({
    challengeNumber,
    basePoints: challenge.basePoints ?? scoring.basePoints ?? 0,
    speedBonusBands: challenge.speedBonusBands?.length
      ? challenge.speedBonusBands
      : scoring.speedBonusBands,
    attemptBands: scoring.attemptBands || [],
    attemptNumber: nextAttempts,
    startedAt: progress.startedAt,
    submittedAt: now,
    awardMode: scoring.awardMode,
    timerSeconds: challenge.timerSeconds || scoring.timerSeconds,
  });

  const completedProgress = await CampusHuntTeamProgress.findOneAndUpdate(
    { _id: progress._id, state: 'ACTIVE' },
    {
      $set: {
        state: 'COMPLETED',
        attempts: nextAttempts,
        submittedAt: now,
        completedAt: now,
        awardedPoints: award.total,
        failureReason: award.late ? 'LATE_ZERO_POINTS' : undefined,
        lastRequestId: requestId || undefined,
      },
    },
    { new: true },
  );

  if (!completedProgress) {
    // Race — re-read
    const existing = await CampusHuntTeamProgress.findById(progress._id);
    return {
      correct: existing?.state === 'COMPLETED',
      state: existing?.state,
      attemptsLeft: Math.max(0, maxAttempts - (existing?.attempts || 0)),
      awardedPoints: existing?.awardedPoints ?? 0,
      destinationInstruction:
        existing?.state === 'COMPLETED' ? challenge.destinationInstruction : undefined,
      teamStage: team.currentStage,
      currentScore: team.currentScore,
      alreadyProcessed: true,
    };
  }

  const nextStage = resolvedStageForChallenge(challengeNumber, 'completed');
  const newScore = applyAward(team.currentScore, award.total);
  const updatedTeam = await CampusHuntTeam.findOneAndUpdate(
    { _id: team._id, currentStage: requiredStage },
    {
      $set: {
        currentStage: nextStage,
        currentScore: newScore,
      },
    },
    { new: true },
  );

  await writeAudit({
    eventId: team.eventId,
    actorType: 'player',
    actorId: userId,
    action: `challenge_${challengeNumber}_completed`,
    targetType: 'team',
    targetId: team._id,
    after: { awardedPoints: award.total, stage: nextStage, score: newScore },
  });

  return {
    correct: true,
    state: 'COMPLETED',
    attemptsLeft: Math.max(0, maxAttempts - nextAttempts),
    awardedPoints: award.total,
    speedBonus: award.speedBonus,
    late: Boolean(award.late),
    destinationInstruction: challenge.destinationInstruction || '',
    teamStage: updatedTeam?.currentStage || nextStage,
    currentScore: updatedTeam?.currentScore ?? newScore,
    message: award.late
      ? 'Correct — but time expired. 0 points awarded. Continue to the next checkpoint.'
      : undefined,
  };
}

async function finalizeTimeout({ team, challenge, progress, now }) {
  const updatedProgress = await CampusHuntTeamProgress.findOneAndUpdate(
    { _id: progress._id, state: 'ACTIVE' },
    {
      $set: {
        state: 'TIMED_OUT',
        failureReason: 'TIMEOUT',
        awardedPoints: 0,
        completedAt: now,
        submittedAt: now,
      },
    },
    { new: true },
  );

  const nextStage = resolvedStageForChallenge(challenge.challengeNumber, 'timeout')
    || resolvedStageForChallenge(challenge.challengeNumber, 'failed');

  let updatedTeam = team;
  if (nextStage && canTransition(team.currentStage, nextStage)) {
    updatedTeam = await CampusHuntTeam.findOneAndUpdate(
      { _id: team._id, currentStage: team.currentStage },
      { $set: { currentStage: nextStage } },
      { new: true },
    ) || team;
  }

  return {
    correct: false,
    state: updatedProgress?.state || 'TIMED_OUT',
    attemptsLeft: 0,
    awardedPoints: 0,
    timedOut: true,
    teamStage: updatedTeam.currentStage,
    currentScore: updatedTeam.currentScore,
  };
}

async function requestHint({
  team,
  userId,
  isLeader,
  challengeNumber,
  requestId,
  now = new Date(),
}) {
  if (!isLeader) {
    const err = new Error('Only the team leader can request hints');
    err.status = 403;
    err.code = 'LEADER_ONLY';
    throw err;
  }

  const requiredStage = requiredStageForChallenge(challengeNumber);
  if (team.currentStage !== requiredStage) {
    const err = new Error(`Team is not on challenge ${challengeNumber}`);
    err.status = 409;
    throw err;
  }

  if (Number(challengeNumber) === 1) {
    const err = new Error('Hints are not available for Clue 1');
    err.status = 400;
    throw err;
  }

  const challenge = await getChallengeForTeam(team, challengeNumber, { includeSecrets: true });
  if (!challenge) {
    const err = new Error('Challenge not found');
    err.status = 404;
    throw err;
  }

  const { progress, event } = await ensureChallengeActive(team, challengeNumber, now);
  const hintCost = challenge.hintCost ?? event?.scoringConfig?.hintCost ?? 15;

  // Idempotent: already used
  if (progress.hintUsed) {
    return {
      hint: challenge.hintText || '',
      score: team.currentScore,
      hintCost: 0,
      alreadyProcessed: true,
    };
  }

  if (requestId && progress.hintRequestId === requestId && progress.hintUsed) {
    return {
      hint: challenge.hintText || '',
      score: team.currentScore,
      hintCost: 0,
      alreadyProcessed: true,
    };
  }

  if (isExpired(progress.expiresAt, now)) {
    const err = new Error('Challenge has timed out');
    err.status = 409;
    err.code = 'TIMEOUT';
    throw err;
  }

  const updatedProgress = await CampusHuntTeamProgress.findOneAndUpdate(
    { _id: progress._id, hintUsed: false, state: 'ACTIVE' },
    {
      $set: {
        hintUsed: true,
        hintUsedAt: now,
        hintRequestId: requestId || undefined,
      },
    },
    { new: true },
  );

  if (!updatedProgress) {
    const existing = await CampusHuntTeamProgress.findById(progress._id);
    return {
      hint: challenge.hintText || '',
      score: team.currentScore,
      hintCost: 0,
      alreadyProcessed: true,
      hintUsed: existing?.hintUsed,
    };
  }

  const newScore = applyHintDeduction(team.currentScore, hintCost);
  const updatedTeam = await CampusHuntTeam.findOneAndUpdate(
    { _id: team._id },
    {
      $set: { currentScore: newScore },
      $inc: { 'stats.hintsUsed': 1 },
    },
    { new: true },
  );

  await writeAudit({
    eventId: team.eventId,
    actorType: 'player',
    actorId: userId,
    action: `hint_challenge_${challengeNumber}`,
    targetType: 'team',
    targetId: team._id,
    after: { hintCost, score: newScore },
  });

  return {
    hint: challenge.hintText || '',
    score: updatedTeam?.currentScore ?? newScore,
    hintCost,
    alreadyProcessed: false,
  };
}

/**
 * Player rewind is disabled for live events (score/timer farm loophole).
 * Admin tooling should use dedicated compensation endpoints instead.
 */
async function rewindPreviousStep() {
  const err = new Error('Rewind is disabled during Campus Hunt');
  err.status = 403;
  err.code = 'REWIND_DISABLED';
  throw err;
}

/** @deprecated Internal helper retained for tests — not exposed to players. */
async function rewindPreviousStepUnsafe({ team, userId, isLeader }) {
  if (!isLeader) {
    const err = new Error('Only the Team Leader can go back');
    err.status = 403;
    err.code = 'LEADER_REQUIRED';
    throw err;
  }
  if (team.currentStage === 'SCORE_LOCKED') {
    const err = new Error('Score is locked — cannot go back');
    err.status = 409;
    err.code = 'SCORE_LOCKED';
    throw err;
  }

  const CampusHuntTeamProgress = require('../models/CampusHuntTeamProgress');
  const CampusHuntCheckpointVerification = require('../models/CampusHuntCheckpointVerification');
  const { writeAudit } = require('./auditService');

  const from = team.currentStage;
  let to = null;
  let challengeNumberToReset = null;
  let checkpointKeyToClear = null;

  if (from === 'CLUE_1_COMPLETED') {
    to = 'CLUE_1_ACTIVE';
    challengeNumberToReset = 1;
    checkpointKeyToClear = '1';
  } else if (from === 'CLUE_2_ACTIVE') {
    to = 'CLUE_1_COMPLETED';
    challengeNumberToReset = 2;
  } else if (['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'].includes(from)) {
    to = 'CLUE_2_ACTIVE';
    challengeNumberToReset = 2;
    checkpointKeyToClear = '2';
  } else if (from === 'CLUE_3_ACTIVE') {
    to = 'CLUE_2_COMPLETED';
    challengeNumberToReset = 3;
  } else if (['CLUE_3_COMPLETED', 'CLUE_3_FAILED'].includes(from)) {
    to = 'CLUE_3_ACTIVE';
    challengeNumberToReset = 3;
    checkpointKeyToClear = '3';
  } else if (from === 'CLUE_4_ACTIVE') {
    to = 'CLUE_3_COMPLETED';
    challengeNumberToReset = 4;
  } else if (['CLUE_4_COMPLETED', 'CLUE_4_FAILED'].includes(from)) {
    to = 'CLUE_4_ACTIVE';
    challengeNumberToReset = 4;
    checkpointKeyToClear = 'FINISH';
  } else {
    const err = new Error('Nothing to go back to from this stage');
    err.status = 409;
    err.code = 'CANNOT_REWIND';
    throw err;
  }

  team.currentStage = to;
  await team.save();

  if (challengeNumberToReset) {
    await CampusHuntTeamProgress.deleteOne({
      teamId: team._id,
      challengeNumber: challengeNumberToReset,
    });
  }

  if (checkpointKeyToClear) {
    const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
    const cp = await CampusHuntCheckpoint.findOne({
      eventId: team.eventId,
      routeId: team.routeId,
      checkpointKey: checkpointKeyToClear,
    });
    if (cp) {
      await CampusHuntCheckpointVerification.deleteOne({
        teamId: team._id,
        checkpointId: cp._id,
      });
    }
  }

  await writeAudit({
    eventId: team.eventId,
    actorType: 'player',
    actorId: userId,
    action: 'team.rewind_step',
    targetType: 'team',
    targetId: team._id,
    before: { currentStage: from },
    after: { currentStage: to },
  });

  return { from, to };
}

async function buildPlayerProgress(team, userId, isLeader) {
  const now = new Date();
  if (team.currentStage === 'WAITING' && team.scheduledStartAt) {
    try {
      const { releaseTeamIfDue } = require('./teamReleaseService');
      const result = await releaseTeamIfDue({ team, now });
      team = result.team;
    } catch (error) {
      if (!['START_NOT_DUE', 'RELEASES_PAUSED', 'ROUND_NOT_LIVE', 'SCHEDULE_NOT_LOCKED'].includes(error.code)) {
        throw error;
      }
      team = await CampusHuntTeam.findById(team._id);
    }
  }
  const [clue1, routeChallenges] = await Promise.all([
    team.clue1ChallengeId
      ? CampusHuntChallenge.findOne({
        _id: team.clue1ChallengeId,
        eventId: team.eventId,
        active: true,
      })
      : null,
    CampusHuntChallenge.find({
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: { $gte: 2 },
      variantKey: 'DEFAULT',
      active: true,
    }).sort({ challengeNumber: 1 }),
  ]);
  const challenges = [clue1, ...routeChallenges].filter(Boolean);

  const progressDocs = await CampusHuntTeamProgress.find({ teamId: team._id });
  const byNumber = new Map(progressDocs.map((p) => [p.challengeNumber, p]));
  const idx = memberIndexForUser(team, userId);

  // Auto-activate if team is on an active clue stage
  const activeMatch = String(team.currentStage).match(/^CLUE_(\d)_ACTIVE$/);
  if (activeMatch) {
    const n = Number(activeMatch[1]);
    try {
      await ensureChallengeActive(team, n, now);
    } catch {
      // ignore missing challenge config during progress fetch
    }
  }

  const refreshed = await CampusHuntTeamProgress.find({ teamId: team._id });
  const byNumber2 = new Map(refreshed.map((p) => [p.challengeNumber, p]));

  // Auto-timeout non–Clue-2 challenges. Clue 2 stays ACTIVE for late 0-pt submit.
  for (const ch of challenges) {
    const p = byNumber2.get(ch.challengeNumber);
    if (
      ch.challengeNumber !== 2
      && p?.state === 'ACTIVE'
      && p.expiresAt
      && isExpired(p.expiresAt, now)
      && team.currentStage === requiredStageForChallenge(ch.challengeNumber)
    ) {
      await finalizeTimeout({ team, challenge: ch, progress: p, now });
    }
  }

  const teamFresh = await CampusHuntTeam.findById(team._id);
  const progressFresh = await CampusHuntTeamProgress.find({ teamId: team._id });
  const mapFresh = new Map(progressFresh.map((p) => [p.challengeNumber, p]));
  const event = await CampusHuntEvent.findById(team.eventId).select('scoringConfig');

  const views = [];
  for (const ch of challenges) {
    const p = mapFresh.get(ch.challengeNumber);
    const scoring = scoringForChallenge(event, ch.challengeNumber);
    let hintText = null;
    if (p?.hintUsed) {
      const secret = await CampusHuntChallenge.findById(ch._id).select('+hintText');
      hintText = secret?.hintText || '';
    }
    const revealedLocation = p?.failureReason === 'REVEALED_ZERO_POINTS'
      ? ch.destinationInstruction
      : null;
    const expose = canExposeChallengeContent(
      ch.challengeNumber,
      p?.state,
      teamFresh.currentStage,
    );
    const view = publicChallengeView(ch, p, {
      isLeader,
      memberIndex: idx,
      includeHint: Boolean(p?.hintUsed) && expose,
      hintText,
      now,
      scoring,
      revealedLocation,
      teamStage: teamFresh.currentStage,
    });
    if (
      ch.challengeNumber === 1
      && p?.state !== 'COMPLETED'
      && teamFresh.currentStage === 'CLUE_1_ACTIVE'
    ) {
      view.destinationInstruction = undefined;
      view.revealedLocation = undefined;
    }
    if (ch.challengeNumber === 1 && view.locked !== true) {
      view.maxAttempts = scoring.maxAttempts || 3;
      view.attemptsLeft = Math.max(0, view.maxAttempts - (p?.attempts || 0));
    }
    views.push(view);
  }

  const { getPendingCheckpointStatus } = require('./checkpointService');
  const checkpointStatus = await getPendingCheckpointStatus(teamFresh, userId);
  const [startingPoint, round] = await Promise.all([
    teamFresh.startingPointId
      ? CampusHuntStartingPoint.findById(teamFresh.startingPointId)
        .select('code name description releasesPaused')
        .lean()
      : null,
    teamFresh.roundId
      ? CampusHuntRound.findById(teamFresh.roundId).select('releasesPaused').lean()
      : null,
  ]);

  return {
    team: teamFresh,
    challenges: views,
    checkpointStatus,
    serverTime: now.toISOString(),
    start: {
      startingPoint: startingPoint
        ? {
          id: String(startingPoint._id),
          code: startingPoint.code,
          name: startingPoint.name,
          description: startingPoint.description,
        }
        : null,
      releasePaused: Boolean(round?.releasesPaused || startingPoint?.releasesPaused),
    },
  };
}

module.exports = {
  getChallengeForTeam,
  getOrCreateProgress,
  ensureChallengeActive,
  publicChallengeView,
  memberIndexForUser,
  submitAnswer,
  requestHint,
  rewindPreviousStep,
  rewindPreviousStepUnsafe,
  canExposeChallengeContent,
  buildPlayerProgress,
  finalizeTimeout,
  scoringForChallenge,
  normalizeAnswer,
};
