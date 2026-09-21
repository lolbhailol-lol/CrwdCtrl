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
  nowDate,
} = require('./timerService');
const { writeAudit } = require('./auditService');
const { DEFAULT_SCORING_CONFIG, CLUE_HOW_TO } = require('../constants');
const { publishTeamProgress } = require('./teamProgressBus');
const {
  ensureRound1FieldTerminalGrid,
  isRound1GridSession,
  validateCompletionCode,
  claimCompletionCode,
} = require('./grid/gridSessionService');

function notifyTeam(teamOrId) {
  const id = teamOrId?._id || teamOrId?.id || teamOrId;
  if (id) publishTeamProgress(id);
}

async function getChallengeForTeam(team, challengeNumber, { includeSecrets = false } = {}) {
  const n = Number(challengeNumber);
  let filter;
  if (n === 1) {
    filter = {
      _id: team.clue1ChallengeId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 1,
      active: true,
    };
  } else if (n === 2 && team.clue2ChallengeId) {
    filter = {
      _id: team.clue2ChallengeId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 2,
      active: true,
    };
  } else if (n === 3 && team.clue3ChallengeId) {
    filter = {
      _id: team.clue3ChallengeId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 3,
      active: true,
    };
  } else if (n === 4 && team.clue4ChallengeId) {
    filter = {
      _id: team.clue4ChallengeId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 4,
      active: true,
    };
  } else if (n === 5 && team.clue5ChallengeId) {
    filter = {
      _id: team.clue5ChallengeId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 5,
      active: true,
    };
  } else if (n === 6 && team.clue6ChallengeId) {
    filter = {
      _id: team.clue6ChallengeId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 6,
      active: true,
    };
  } else {
    filter = {
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: n,
      variantKey: 'DEFAULT',
    };
  }
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
  const defaults = DEFAULT_SCORING_CONFIG[`clue${challengeNumber}`] || {
    basePoints: 0,
    maxAttempts: 3,
    timerSeconds: 0,
    speedBonusBands: [],
  };
  const cfg = event?.scoringConfig || DEFAULT_SCORING_CONFIG;
  const raw = cfg[`clue${challengeNumber}`];
  const custom = raw?.toObject?.() || raw || {};
  const merged = { ...defaults, ...custom };

  // Clue 2 / 3 / 4 / 5: physical or Zip — no hunt countdown.
  if ([2, 3, 4, 5].includes(Number(challengeNumber))) {
    merged.timerSeconds = 0;
    merged.timerStartDelaySeconds = 0;
    merged.awardMode = 'flat_base';
    merged.speedBonusBands = [];
    if (Number(challengeNumber) === 2 || Number(challengeNumber) === 4) {
      merged.basePoints = Number(merged.basePoints) > 0 ? Number(merged.basePoints) : 50;
    }
    if (Number(challengeNumber) === 3) {
      merged.basePoints = Number(merged.basePoints) > 0 ? Number(merged.basePoints) : 65;
    }
    if (Number(challengeNumber) === 4 || Number(challengeNumber) === 5) {
      merged.allowLateSubmit = true;
    }
    if (Number(challengeNumber) === 5) {
      merged.basePoints = Number(merged.basePoints) > 0 ? Number(merged.basePoints) : 45;
    }
  }

  merged.hintCost = Number(merged.hintCost ?? cfg.hintCost ?? defaults.hintCost) || 20;
  return merged;
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
  // Clue 2/3/4/5: no hunt countdown. Clue 6 finish code: none.
  const timerSeconds = [2, 3, 4, 5, 6].includes(Number(challengeNumber))
    ? 0
    : Number(challenge.timerSeconds || scoring.timerSeconds || 0);
  const delaySeconds = 0;

  let progress = await getOrCreateProgress(team, challenge);

  if (progress.state === 'LOCKED' || !progress.startedAt) {
    const window = buildChallengeWindow(timerSeconds, now, { delaySeconds });
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
  } else if (Number(challengeNumber) === 4 && progress.expiresAt) {
    // Drop legacy Field Terminal hunt timers from older configs.
    progress = await CampusHuntTeamProgress.findOneAndUpdate(
      { _id: progress._id, state: 'ACTIVE' },
      { $set: { expiresAt: null }, $unset: { failureReason: 1 } },
      { new: true },
    ) || progress;
  }

  // Round 1 Field Terminal — Zip Grid session (long window; no hunt timer)
  if (Number(challengeNumber) === 4 && progress?.state === 'ACTIVE') {
    try {
      await ensureRound1FieldTerminalGrid(team);
    } catch (_) {
      /* grid is best-effort — answer path still works with static GRID codes */
    }
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
  revealedAnswer = null,
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
  // Round 1 Clue 3 = physical lockbox only (never digital / piece lists).
  if (n === 3) {
    prompt = 'Find the physical lockbox nearby.\nType the code written on it.';
  }
  if (n === 2) {
    prompt = challenge.prompt
      && !/letter|join.?word|plant/i.test(String(challenge.prompt))
      ? challenge.prompt
      : 'At the green stop: find the numbered digit slips nearby.\nJoin them in order into one number. Leader types it.';
  }
  if (n === 5) {
    prompt = challenge.prompt
      || 'At the red stop: find the letter slips nearby (letters only — not digits).\nJoin them in order into one word. Leader submits.';
  }

  const maxAttempts = challenge.maxAttempts || scoring?.maxAttempts || 3;
  const attempts = progress?.attempts || 0;
  const nextAttempt = attempts + 1;
  const attemptBands = scoring?.attemptBands || [];
  const nextAttemptPoints = n === 1 && progress?.state === 'ACTIVE'
    ? (attemptBands.find((b) => Number(b.attempt) === nextAttempt)?.points ?? 0)
    : null;

  const revealed = Boolean(
    revealedLocation
    || progress?.failureReason === 'REVEALED_ZERO_POINTS'
    || (
      progress?.failureReason === 'TIMEOUT'
      && [2, 5].includes(Number(n))
    ),
  );

  // Soft-reveal (ACTIVE + REVEALED) shows the answer to type — destination only after COMPLETED
  const showDestination = progress?.state === 'COMPLETED'
    || (Number(n) === 1 && revealed);

  const startedAt = progress?.startedAt || null;
  const expiresAt = progress?.expiresAt || null;
  const nowMs = nowDate(now).getTime();
  const timerArmed = !startedAt || nowMs >= new Date(startedAt).getTime();
  const instructionPhase = false;

  const timeExpired = Boolean(
    expiresAt
    && timerArmed
    && isExpired(expiresAt, now)
    && progress.state === 'ACTIVE'
    && n !== 4,
  );

  return {
    challengeNumber: n,
    type: challenge.type,
    prompt,
    memberCode: undefined,
    memberFragments: undefined,
    collaborative: false,
    howTo: CLUE_HOW_TO[n] || null,
    destinationInstruction: showDestination
      ? (challenge.destinationInstruction
        || (n === 1
          ? 'Go to the location. Leader scans the shared orange QR once.'
          : n === 5
            ? 'Go to your 5th campus stop. Leader scans the red FIFTH SCAN QR once.'
            : n === 6
              ? 'Go to Mindspark Lobby and enter the organizer finish code.'
              : ''))
      : undefined,
    // Answer strings only after timer/attempt reveal (0 pts) — never on active timed clues
    revealedLocation: revealed && n === 1
      ? (revealedLocation || null)
      : undefined,
    revealedAnswer: revealed && n !== 1
      ? (revealedAnswer || null)
      : undefined,
    state,
    attempts,
    maxAttempts,
    attemptsLeft: Math.max(0, maxAttempts - attempts),
    nextAttemptPoints,
    attemptBands: n === 1 && state === 'ACTIVE' ? attemptBands : undefined,
    hintUsed: Boolean(progress?.hintUsed),
    // Hints are leader-only (anti-leak for players on shared phones / wrong role)
    hintText: includeHint && isLeader && progress?.hintUsed ? (hintText || null) : undefined,
    hintCost: Number(challenge.hintCost ?? scoring?.hintCost) || 20,
    startedAt,
    expiresAt: [2, 3, 4, 5].includes(n) ? null : expiresAt,
    timerStartsAt: null,
    instructionPhase,
    timerArmed: [2, 3, 4, 5].includes(n) ? true : timerArmed,
    timerSeconds: undefined,
    instructionDelaySeconds: undefined,
    awardedPoints: progress?.awardedPoints ?? null,
    failureReason: progress?.failureReason || null,
    timeExpired: [2, 3, 4, 5].includes(n) ? false : timeExpired,
    allowLateSubmit: Boolean(
      scoring?.allowLateSubmit
      || n === 4
      || n === 5,
    ),
    scoringBands: undefined,
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

  // Clue 6 = Mindspark Lobby finish code → complete + lock (even if Clue 6 row is missing)
  if (Number(challengeNumber) === 6) {
    const { submitOrganizerFinishCode, acceptedFinishCodes } = require('./finishService');
    const finishAccepted = await acceptedFinishCodes(team);
    if (matchesAnyAccepted(answer, finishAccepted)) {
      const finish = await submitOrganizerFinishCode({
        team,
        userId,
        isLeader,
        finishCode: answer,
        now,
      });
      return {
        correct: true,
        state: 'COMPLETED',
        attemptsLeft: 0,
        awardedPoints: 0,
        destinationInstruction:
          'Score locked at Mindspark Lobby — check the leaderboard when it goes live.',
        teamStage: finish.team?.currentStage,
        currentScore: finish.team?.currentScore,
        finalScore: finish.finalScore ?? finish.team?.finalScore,
        scoreLocked: true,
        message: finish.message
          || 'Finish code accepted — score locked at Mindspark Lobby',
      };
    }
  }

  const round = team.roundId ? await CampusHuntRound.findById(team.roundId) : null;
  if (round && isRoundClosed(round, now)) {
    const reason = round.status === 'locked' || round.status === 'finalized'
      ? `Round is ${round.status}`
      : (round.endsAt
        ? `Round ended at ${new Date(round.endsAt).toISOString()} — ask admin to extend duration / Start again`
        : 'Round is closed');
    const err = new Error(reason);
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
  const allowLate = Boolean(scoring.allowLateSubmit)
    || Number(challengeNumber) === 4
    || Number(challengeNumber) === 5;

  // Timed clues with allowLateSubmit: after timer, still accept for 0 points.
  if (expired && !allowLate) {
    return finalizeTimeout({ team, challenge, progress, now });
  }

  const accepted = [
    challenge.answer,
    ...(challenge.acceptedAnswers || []),
  ].filter(Boolean);

  // Clue 6: also accept the live event organizer finish code (+ destination name)
  if (Number(challengeNumber) === 6) {
    try {
      const {
        resolveOrganizerFinishCode,
        resolveDestinationName,
      } = require('./stationCatalogService');
      const ev = event || await CampusHuntEvent.findById(team.eventId)
        .select('organizerFinishCode destinationName');
      accepted.push(
        resolveOrganizerFinishCode(ev),
        resolveDestinationName(ev),
        'mindspark lobby',
        'finale assembly',
      );
    } catch (_) {
      /* keep challenge answers only */
    }
  }

  let correct = matchesAnyAccepted(answer, accepted);
  let gridSessionClaim = null;
  // Clue 4: accept Zip Grid completion code from this team's Round 1 session
  if (Number(challengeNumber) === 4 && !correct) {
    const validated = await validateCompletionCode(answer, { teamId: team._id });
    if (validated.ok && isRound1GridSession(validated.session)) {
      correct = true;
      gridSessionClaim = validated;
    }
  }
  const nextAttempts = (progress.attempts || 0) + 1;
  const maxAttempts = challenge.maxAttempts || scoring.maxAttempts || 3;

  if (!correct) {
    const failed = nextAttempts >= maxAttempts;
    // Typed clues: after 3 fails → show answer (0 pts), stay ACTIVE so they type it to continue.
    const revealAndType = failed
      && [1, 2, 3, 5].includes(Number(challengeNumber))
      && scoring.revealOnMaxAttempts !== false;

    const update = {
      attempts: nextAttempts,
      submittedAt: now,
      lastRequestId: requestId || progress.lastRequestId,
    };
    if (revealAndType) {
      update.failureReason = 'REVEALED_ZERO_POINTS';
      update.awardedPoints = 0;
      // Stay ACTIVE — player must type the revealed answer for 0 pts to unlock next.
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

    // Lost optimistic lock — do not advance stage or burn fail stats twice.
    if (!updatedProgress) {
      const existing = await CampusHuntTeamProgress.findById(progress._id);
      const freshTeam = await CampusHuntTeam.findById(team._id);
      return {
        correct: false,
        state: existing?.state || 'ACTIVE',
        attemptsLeft: Math.max(0, maxAttempts - (existing?.attempts || 0)),
        awardedPoints: existing?.awardedPoints ?? 0,
        revealed: existing?.failureReason === 'REVEALED_ZERO_POINTS',
        revealedAnswer: existing?.failureReason === 'REVEALED_ZERO_POINTS'
          ? (challenge.answer || null)
          : undefined,
        revealedLocation: existing?.failureReason === 'REVEALED_ZERO_POINTS'
          && Number(challengeNumber) === 1
          ? (challenge.answer || challenge.destinationInstruction || null)
          : undefined,
        message: 'Answer already processed — refresh if your stage looks wrong.',
        teamStage: freshTeam?.currentStage || team.currentStage,
        currentScore: freshTeam?.currentScore ?? team.currentScore,
        alreadyProcessed: true,
      };
    }

    let updatedTeam = team;
    const failInc = { $inc: { 'stats.failedAttempts': 1 } };
    if (failed && !revealAndType) {
      const nextStage = resolvedStageForChallenge(challengeNumber, 'failed');
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
    const revealedText = String(challenge.answer || '').trim();

    notifyTeam(updatedTeam);
    return {
      correct: false,
      state: updatedProgress.state || 'ACTIVE',
      attemptsLeft,
      awardedPoints: 0,
      revealed: Boolean(revealAndType),
      revealedAnswer: revealAndType ? (revealedText || null) : undefined,
      revealedLocation: revealAndType && Number(challengeNumber) === 1
        ? (revealedText || challenge.destinationInstruction || null)
        : undefined,
      nextAttemptPoints: !failed && nextPts != null ? nextPts : undefined,
      message: revealAndType
        ? `Out of attempts (0 pts). Answer shown — type it exactly to continue.`
        : attemptsLeft > 0
          ? `Incorrect. ${attemptsLeft} of ${maxAttempts} attempt${attemptsLeft === 1 ? '' : 's'} left`
            + (nextPts != null ? ` (next correct = ${nextPts} pts)` : '')
          : 'Incorrect. No attempts left.',
      teamStage: updatedTeam.currentStage,
      currentScore: updatedTeam.currentScore,
    };
  }

  // Prefer event scoring for flat_base (stored challenge.basePoints: 0 must not zero Clue 1).
  const awardBase = (
    scoring.awardMode === 'flat_base'
    || Number(challengeNumber) === 1
    || Number(challengeNumber) === 3
    || Number(challengeNumber) === 5
  )
    ? (Number(scoring.basePoints) || Number(challenge.basePoints) || 0)
    : (Number(challenge.basePoints) || Number(scoring.basePoints) || 0);

  // Correct answer (flat 50 / time bands / base+speed; late = 0 pts but still advances)
  const award = computeChallengeAward({
    challengeNumber,
    basePoints: awardBase,
    speedBonusBands: challenge.speedBonusBands?.length
      ? challenge.speedBonusBands
      : scoring.speedBonusBands,
    attemptBands: scoring.attemptBands || [],
    attemptNumber: nextAttempts,
    startedAt: progress.startedAt,
    submittedAt: now,
    awardMode: scoring.awardMode,
    timerSeconds: challenge.timerSeconds || scoring.timerSeconds,
    allowLateSubmit: Boolean(scoring.allowLateSubmit)
      || Number(challengeNumber) === 2
      || Number(challengeNumber) === 4
      || Number(challengeNumber) === 5,
  });

  const lateOrRevealed = Boolean(
    award.late
    || progress.failureReason === 'REVEALED_ZERO_POINTS',
  );

  const completedProgress = await CampusHuntTeamProgress.findOneAndUpdate(
    { _id: progress._id, state: 'ACTIVE' },
    {
      $set: {
        state: 'COMPLETED',
        attempts: nextAttempts,
        submittedAt: now,
        completedAt: now,
        awardedPoints: lateOrRevealed ? 0 : award.total,
        failureReason: lateOrRevealed
          ? (progress.failureReason === 'REVEALED_ZERO_POINTS'
            ? 'REVEALED_ZERO_POINTS'
            : 'LATE_ZERO_POINTS')
          : undefined,
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
  const awardPts = lateOrRevealed ? 0 : award.total;
  const newScore = applyAward(team.currentScore, awardPts);
  let updatedTeam = await CampusHuntTeam.findOneAndUpdate(
    { _id: team._id, currentStage: requiredStage },
    {
      $set: {
        currentStage: nextStage,
        currentScore: newScore,
      },
    },
    { new: true },
  );

  // Progress already COMPLETED — repair team stage if another writer raced us.
  if (!updatedTeam) {
    const fresh = await CampusHuntTeam.findById(team._id);
    if (fresh && fresh.currentStage === requiredStage && nextStage) {
      updatedTeam = await CampusHuntTeam.findOneAndUpdate(
        { _id: team._id, currentStage: requiredStage },
        {
          $set: {
            currentStage: nextStage,
            currentScore: applyAward(fresh.currentScore, awardPts),
          },
        },
        { new: true },
      );
    }
    if (!updatedTeam) {
      const again = await CampusHuntTeam.findById(team._id);
      // Soft-lock risk: progress complete but stage not advanced — roll progress back to ACTIVE only if still on required stage.
      if (again && again.currentStage === requiredStage) {
        await CampusHuntTeamProgress.findOneAndUpdate(
          { _id: progress._id, state: 'COMPLETED' },
          {
            $set: {
              state: 'ACTIVE',
              completedAt: null,
              awardedPoints: 0,
              failureReason: undefined,
            },
          },
        );
        const err = new Error('Could not lock team stage — please submit again');
        err.status = 409;
        err.code = 'STAGE_WRITE_CONFLICT';
        throw err;
      }
      return {
        correct: true,
        state: 'COMPLETED',
        attemptsLeft: Math.max(0, maxAttempts - nextAttempts),
        awardedPoints: completedProgress.awardedPoints ?? award.total,
        speedBonus: award.speedBonus,
        late: Boolean(award.late),
        destinationInstruction: challenge.destinationInstruction || '',
        teamStage: again?.currentStage,
        currentScore: again?.currentScore,
        alreadyProcessed: true,
      };
    }
  }

  await writeAudit({
    eventId: team.eventId,
    actorType: 'player',
    actorId: userId,
    action: `challenge_${challengeNumber}_completed`,
    targetType: 'team',
    targetId: team._id,
    after: {
      awardedPoints: awardPts,
      stage: updatedTeam.currentStage,
      score: updatedTeam.currentScore,
      viaGrid: Boolean(gridSessionClaim),
    },
  });

  if (gridSessionClaim) {
    try {
      await claimCompletionCode(answer, { teamId: team._id });
    } catch (_) {
      /* claim is best-effort once progress is already completed */
    }
  }

  const nextInstruction = Number(challengeNumber) === 2
    ? (
      challenge.destinationInstruction
      || 'Go to your next stop. Leader scans the green SECOND SCAN QR once.'
    )
    : Number(challengeNumber) === 3
      ? (
        challenge.destinationInstruction
        || 'Lockbox open — find the blue THIRD SCAN QR. Leader scans once.'
      )
    : Number(challengeNumber) === 4
      ? (
        challenge.destinationInstruction
        || 'Terminal cleared — scan the purple FOURTH SCAN QR. Leader scans once.'
      )
    : Number(challengeNumber) === 5
      ? (
        challenge.destinationInstruction
        || 'Go to your 5th stop — scan the red FIFTH SCAN QR once, then Mindspark Lobby.'
      )
    : Number(challengeNumber) === 6
      ? (
        challenge.destinationInstruction
        || 'Score locked at Mindspark Lobby — check the leaderboard when it goes live.'
      )
      : (challenge.destinationInstruction || '');

  // Clue 6 finish code → also lock Round 1 score at Mindspark Lobby
  if (Number(challengeNumber) === 6 && updatedTeam) {
    try {
      const { markTeamReachedAtStart } = require('./finishService');
      const locked = await markTeamReachedAtStart({
        teamId: updatedTeam._id,
        actor: {
          actorType: 'player',
          actorId: userId,
          actorLabel: `team:${updatedTeam.teamCode || team.teamCode}`,
        },
        reason: 'Clue 6 finish code accepted',
        now,
      });
      if (locked?.team) updatedTeam = locked.team;
    } catch (_) {
      /* desk can still mark if auto-lock races */
    }
  }

  notifyTeam(updatedTeam);
  return {
    correct: true,
    state: 'COMPLETED',
    attemptsLeft: Math.max(0, maxAttempts - nextAttempts),
    awardedPoints: awardPts,
    speedBonus: lateOrRevealed ? 0 : award.speedBonus,
    late: Boolean(lateOrRevealed),
    destinationInstruction: nextInstruction,
    teamStage: updatedTeam.currentStage,
    currentScore: updatedTeam.currentScore,
    finalScore: updatedTeam.finalScore ?? updatedTeam.currentScore,
    scoreLocked: updatedTeam.currentStage === 'SCORE_LOCKED'
      || updatedTeam.currentStage === 'FINISH_COMPLETED',
    message: Number(challengeNumber) === 2
      ? (
        lateOrRevealed
          ? 'Correct (0 pts — time up). Go scan green SECOND SCAN once → Clue 3.'
          : 'Correct! Go to next place · shared green QR · scan once → Clue 3.'
      )
      : Number(challengeNumber) === 4
        ? (
          lateOrRevealed
            ? 'Correct (0 pts — time up). Scan purple FOURTH SCAN here once → Clue 5.'
            : 'Correct! Scan the purple FOURTH SCAN QR here once → Clue 5.'
        )
      : Number(challengeNumber) === 5
        ? (
          lateOrRevealed
            ? 'Correct (0 pts — time up). Go to your 5th stop — scan red FIFTH SCAN once → Clue 6.'
            : 'Correct! Go to your 5th campus stop — scan red FIFTH SCAN once → Mindspark Lobby.'
        )
      : Number(challengeNumber) === 6
        ? (
          'Finish code accepted — score locked at Mindspark Lobby. Check the leaderboard when live.'
        )
        : (lateOrRevealed
          ? 'Correct — but time expired. 0 points awarded. Continue to the next step.'
          : undefined),
  };
}

/**
 * Timed clues 2/4/5: when the timer ends, reveal the answer at 0 pts
 * but keep the clue ACTIVE so the leader can type it, then advance.
 */
async function finalizeTimerReveal({ team, challenge, progress, now }) {
  // Already soft-revealed (or completed) — idempotent
  if (
    progress.state === 'ACTIVE'
    && progress.failureReason === 'REVEALED_ZERO_POINTS'
  ) {
    return { progress, team, softRevealed: true };
  }
  if (['COMPLETED', 'FAILED', 'TIMED_OUT', 'VOIDED'].includes(progress.state)) {
    return null;
  }

  const updatedProgress = await CampusHuntTeamProgress.findOneAndUpdate(
    { _id: progress._id, state: 'ACTIVE' },
    {
      $set: {
        failureReason: 'REVEALED_ZERO_POINTS',
        awardedPoints: 0,
        submittedAt: now,
      },
    },
    { new: true },
  );

  if (!updatedProgress) {
    const existing = await CampusHuntTeamProgress.findById(progress._id);
    if (existing?.failureReason === 'REVEALED_ZERO_POINTS') {
      return { progress: existing, team, softRevealed: true };
    }
    return null;
  }

  notifyTeam(team);
  return { progress: updatedProgress, team, softRevealed: true };
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

  notifyTeam(updatedTeam);
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

/**
 * Clue 2 / 4 / 5: timer hit zero → reveal answer at 0 points.
 * Leader must still type the revealed answer to advance.
 */
async function revealTimedChallengeAfterExpiry({
  team,
  userId,
  isLeader,
  challengeNumber,
  now = new Date(),
}) {
  if (!isLeader) {
    const err = new Error('Only the team leader can resolve the timer');
    err.status = 403;
    err.code = 'LEADER_ONLY';
    throw err;
  }
  const n = Number(challengeNumber);
  if (![2, 5].includes(n)) {
    const err = new Error(
      n === 4
        ? 'Field Terminal has no hunt timer — play Zip Grid and submit GRID-XXXX'
        : 'This clue does not use a reveal-on-timeout timer',
    );
    err.status = 400;
    err.code = 'NOT_TIMED_REVEAL';
    throw err;
  }

  const requiredStage = requiredStageForChallenge(n);
  if (team.currentStage !== requiredStage) {
    // Already past this clue — return current progress (idempotent)
    return {
      alreadyResolved: true,
      awardedPoints: 0,
      revealed: true,
      teamStage: team.currentStage,
    };
  }

  const challenge = await getChallengeForTeam(team, n, { includeSecrets: true });
  if (!challenge) {
    const err = new Error('Challenge not found');
    err.status = 404;
    throw err;
  }

  const { progress } = await ensureChallengeActive(team, n, now);
  if (['COMPLETED', 'FAILED', 'TIMED_OUT', 'VOIDED'].includes(progress.state)) {
    return {
      alreadyResolved: true,
      awardedPoints: Number(progress.awardedPoints) || 0,
      revealed: progress.failureReason === 'REVEALED_ZERO_POINTS'
        || progress.failureReason === 'TIMEOUT',
      revealedAnswer: challenge.answer || null,
      failureReason: progress.failureReason || null,
      teamStage: team.currentStage,
    };
  }

  if (!progress.expiresAt || !isExpired(progress.expiresAt, now)) {
    const err = new Error('Timer is still running');
    err.status = 409;
    err.code = 'TIMER_STILL_RUNNING';
    throw err;
  }

  const result = await finalizeTimerReveal({ team, challenge, progress, now });
  const freshTeam = result?.team || await CampusHuntTeam.findById(team._id);
  let revealedAnswer = challenge.answer || null;
  if (n === 4) {
    try {
      const CampusHuntGridSession = require('../models/CampusHuntGridSession');
      const gridDone = await CampusHuntGridSession.findOne({
        teamId: team._id,
        eventId: team.eventId,
        status: 'completed',
        missionRunId: null,
        entryId: null,
      }).sort({ createdAt: -1 }).select('completionCode');
      if (gridDone?.completionCode) revealedAnswer = gridDone.completionCode;
    } catch (_) {
      /* keep static */
    }
  }
  return {
    alreadyResolved: !result,
    awardedPoints: 0,
    revealed: true,
    revealedAnswer,
    failureReason: 'REVEALED_ZERO_POINTS',
    timedOut: true,
    awaitSubmit: true,
    message: n === 4
      ? 'Time’s up — GRID code revealed (0 points). Type it to continue, then scan purple.'
      : 'Time’s up — answer revealed (0 points). Type it to continue, then scan red.',
    teamStage: freshTeam?.currentStage || team.currentStage,
    currentScore: freshTeam?.currentScore ?? team.currentScore,
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
  const hintCost = challenge.hintCost
    ?? event?.scoringConfig?.[`clue${challengeNumber}`]?.hintCost
    ?? event?.scoringConfig?.hintCost
    ?? 20;

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

  notifyTeam(updatedTeam || team);
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
  } else if (from === 'CHECKPOINT_2_COMPLETED' || from === 'CLUE_3_ACTIVE') {
    // After green → Clue 3; rewind clears green + Clue 3 attempt
    to = 'CLUE_2_COMPLETED';
    challengeNumberToReset = 3;
    checkpointKeyToClear = '2';
  } else if (['CLUE_3_COMPLETED', 'CLUE_3_FAILED'].includes(from)) {
    to = 'CLUE_3_ACTIVE';
    challengeNumberToReset = 3;
    checkpointKeyToClear = '3';
  } else if (from === 'CHECKPOINT_3_COMPLETED' || from === 'CLUE_4_ACTIVE') {
    to = 'CLUE_3_COMPLETED';
    challengeNumberToReset = 4;
    checkpointKeyToClear = '3';
  } else if (['CLUE_4_COMPLETED', 'CLUE_4_FAILED', 'CLUE_4_TIMEOUT'].includes(from)) {
    to = 'CLUE_4_ACTIVE';
    challengeNumberToReset = 4;
    checkpointKeyToClear = '4';
  } else if (from === 'CHECKPOINT_4_COMPLETED' || from === 'CLUE_5_ACTIVE') {
    to = 'CLUE_4_COMPLETED';
    challengeNumberToReset = 5;
    checkpointKeyToClear = '4';
  } else if (['CLUE_5_COMPLETED', 'CLUE_5_FAILED'].includes(from)) {
    to = 'CLUE_5_ACTIVE';
    challengeNumberToReset = 5;
    checkpointKeyToClear = '5';
  } else if (from === 'CHECKPOINT_5_COMPLETED' || from === 'CLUE_6_ACTIVE') {
    to = 'CLUE_5_COMPLETED';
    challengeNumberToReset = 6;
    checkpointKeyToClear = '5';
  } else if (['CLUE_6_COMPLETED', 'CLUE_6_FAILED'].includes(from)) {
    to = 'CLUE_6_ACTIVE';
    challengeNumberToReset = 6;
  } else if (from === 'FINISH_COMPLETED') {
    to = 'CLUE_6_COMPLETED';
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

  notifyTeam(team);
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
  const [clue1, clue2, clue3, clue4, routeChallenges] = await Promise.all([
    team.clue1ChallengeId
      ? CampusHuntChallenge.findOne({
        _id: team.clue1ChallengeId,
        eventId: team.eventId,
        active: true,
      })
      : null,
    team.clue2ChallengeId
      ? CampusHuntChallenge.findOne({
        _id: team.clue2ChallengeId,
        eventId: team.eventId,
        active: true,
      })
      : null,
    team.clue3ChallengeId
      ? CampusHuntChallenge.findOne({
        _id: team.clue3ChallengeId,
        eventId: team.eventId,
        active: true,
      })
      : null,
    team.clue4ChallengeId
      ? CampusHuntChallenge.findOne({
        _id: team.clue4ChallengeId,
        eventId: team.eventId,
        active: true,
      })
      : null,
    CampusHuntChallenge.find({
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: { $gte: 5 },
      variantKey: 'DEFAULT',
      active: true,
    }).sort({ challengeNumber: 1 }),
  ]);
  const challenges = [clue1, clue2, clue3, clue4, ...routeChallenges].filter(Boolean);

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
  const eventForTimeout = await CampusHuntEvent.findById(team.eventId).select('scoringConfig');

  // Auto-reveal timed clue 5; Clue 2/4 have no hunt timer.
  for (const ch of challenges) {
    const p = byNumber2.get(ch.challengeNumber);
    const scoringRow = scoringForChallenge(eventForTimeout, ch.challengeNumber);
    const n = ch.challengeNumber;
    if (n === 2 || n === 4) continue;
    if (
      n === 5
      && p?.state === 'ACTIVE'
      && p.expiresAt
      && isExpired(p.expiresAt, now)
      && team.currentStage === requiredStageForChallenge(n)
    ) {
      // eslint-disable-next-line no-await-in-loop
      await finalizeTimerReveal({ team, challenge: ch, progress: p, now });
      continue;
    }
    if (scoringRow.allowLateSubmit || n === 5) {
      continue;
    }
    if (
      p?.state === 'ACTIVE'
      && p.expiresAt
      && isExpired(p.expiresAt, now)
      && team.currentStage === requiredStageForChallenge(n)
    ) {
      // eslint-disable-next-line no-await-in-loop
      await finalizeTimeout({ team, challenge: ch, progress: p, now });
    }
  }

  let teamFresh = await CampusHuntTeam.findById(team._id);
  try {
    const { healLeaderOnlyStuckCheckpoint } = require('./checkpointService');
    teamFresh = await healLeaderOnlyStuckCheckpoint(teamFresh, userId) || teamFresh;
  } catch (_) {
    /* heal is best-effort — never block progress payload */
  }
  const progressFresh = await CampusHuntTeamProgress.find({ teamId: team._id });
  const mapFresh = new Map(progressFresh.map((p) => [p.challengeNumber, p]));
  const event = eventForTimeout
    || await CampusHuntEvent.findById(team.eventId).select('scoringConfig');

  const views = [];
  for (const ch of challenges) {
    const p = mapFresh.get(ch.challengeNumber);
    const scoring = scoringForChallenge(event, ch.challengeNumber);
    let hintText = null;
    if (p?.hintUsed) {
      const secret = await CampusHuntChallenge.findById(ch._id).select('+hintText');
      hintText = secret?.hintText || '';
    }
    let revealedLocation = null;
    let revealedAnswer = null;
    if (p?.failureReason === 'REVEALED_ZERO_POINTS' || p?.failureReason === 'TIMEOUT') {
      // eslint-disable-next-line no-await-in-loop
      const secret = await CampusHuntChallenge.findById(ch._id).select('+answer');
      if (Number(ch.challengeNumber) === 1) {
        // Same string as the typed answer — show as location + answer so they can type it.
        revealedLocation = secret?.answer || ch.destinationInstruction || null;
        revealedAnswer = secret?.answer || null;
      } else if ([2, 3, 4, 5].includes(Number(ch.challengeNumber))) {
        revealedAnswer = secret?.answer || null;
        if (Number(ch.challengeNumber) === 4) {
          try {
            const CampusHuntGridSession = require('../models/CampusHuntGridSession');
            // eslint-disable-next-line no-await-in-loop
            const gridDone = await CampusHuntGridSession.findOne({
              teamId: teamFresh._id,
              eventId: teamFresh.eventId,
              status: 'completed',
              missionRunId: null,
              entryId: null,
            }).sort({ createdAt: -1 }).select('completionCode');
            if (gridDone?.completionCode) {
              revealedAnswer = gridDone.completionCode;
            }
          } catch (_) {
            /* keep static answer */
          }
        }
      }
    }
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
      revealedAnswer,
      teamStage: teamFresh.currentStage,
    });
    if (
      Number(ch.challengeNumber) === 4
      && expose
      && p?.state === 'ACTIVE'
      && String(teamFresh.currentStage) === 'CLUE_4_ACTIVE'
    ) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const gridSession = await ensureRound1FieldTerminalGrid(teamFresh, {
          preferredCompletionCode: ch.answer,
        });
        view.gridAccessCode = gridSession.accessCode;
        view.gridGameUrl = '/campus-hunt/grid';
        view.gridStatus = gridSession.status;
        view.gridCompleted = gridSession.status === 'completed';
      } catch (_) {
        view.gridGameUrl = '/campus-hunt/grid';
        view.gridAccessCode = view.gridAccessCode || null;
      }
    }
    if (
      ch.challengeNumber === 1
      && p?.state !== 'COMPLETED'
      && teamFresh.currentStage === 'CLUE_1_ACTIVE'
      && p?.failureReason !== 'REVEALED_ZERO_POINTS'
    ) {
      // Hide destination until they solve or burn all attempts (then reveal to type).
      view.destinationInstruction = undefined;
      view.revealedLocation = undefined;
      view.revealedAnswer = undefined;
    }
    if (view.locked !== true && [1, 2, 3, 5].includes(Number(ch.challengeNumber))) {
      view.maxAttempts = scoring.maxAttempts || 3;
      view.attemptsLeft = Math.max(0, view.maxAttempts - (p?.attempts || 0));
    }
    views.push(view);
  }

  const { getPendingCheckpointStatus } = require('./checkpointService');
  const checkpointStatus = await getPendingCheckpointStatus(teamFresh, userId);
  const [startingPoint, round, eventMeta] = await Promise.all([
    teamFresh.startingPointId
      ? CampusHuntStartingPoint.findById(teamFresh.startingPointId)
        .select('code name description releasesPaused')
        .lean()
      : null,
    teamFresh.roundId
      ? CampusHuntRound.findById(teamFresh.roundId).select('releasesPaused').lean()
      : null,
    CampusHuntEvent.findById(teamFresh.eventId)
      .select('teamSize destinationName organizerFinishCode')
      .lean(),
  ]);

  const teamSize = Math.max(2, Math.min(12, Number(eventMeta?.teamSize) || 4));
  const {
    resolveDestinationName,
  } = require('./stationCatalogService');
  const finishDestination = resolveDestinationName(eventMeta);

  let leaderboardRank = null;
  let leaderboardSize = null;
  try {
    const { standingForTeam } = require('./leaderboardService');
    const standing = await standingForTeam(teamFresh.eventId, teamFresh._id);
    leaderboardRank = standing.rank;
    leaderboardSize = standing.size;
  } catch {
    /* rank is best-effort for the in-game score chip */
  }
  const teamOut = typeof teamFresh.toObject === 'function'
    ? teamFresh.toObject()
    : teamFresh;
  teamOut.leaderboardRank = leaderboardRank;
  teamOut.leaderboardSize = leaderboardSize;

  return {
    team: teamOut,
    teamSize,
    challenges: views,
    checkpointStatus,
    serverTime: now.toISOString(),
    finishDestination,
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
  finalizeTimerReveal,
  revealTimedChallengeAfterExpiry,
  scoringForChallenge,
  normalizeAnswer,
};
