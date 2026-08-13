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
  } else {
    filter = {
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: n,
      variantKey: 'DEFAULT',
      active: true,
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

  // Clue 2 / Clue 4 (prop hunt): keep Round 1 shape, but honor event scoringConfig overrides.
  if (Number(challengeNumber) === 2 || Number(challengeNumber) === 4) {
    const timer = Number(merged.timerSeconds);
    merged.timerSeconds = Number.isFinite(timer) && timer > 0
      ? timer
      : (Number(defaults.timerSeconds) || 180);

    const delay = Number(merged.timerStartDelaySeconds);
    const defaultDelay = Number(challengeNumber) === 4 ? 15 : 20;
    merged.timerStartDelaySeconds = Number.isFinite(delay) && delay >= 0
      ? delay
      : (Number(defaults.timerStartDelaySeconds) || defaultDelay);

    merged.awardMode = merged.awardMode || defaults.awardMode || 'time_bands_total';
    merged.allowLateSubmit = merged.allowLateSubmit !== false;
    merged.speedBonusBands = (
      Array.isArray(merged.speedBonusBands) && merged.speedBonusBands.length
        ? merged.speedBonusBands
        : (defaults.speedBonusBands || [])
    );
  }
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
  // Prefer event scoring config so Clue 2/4 timer/delay updates apply without re-saving each route clue.
  const timerSeconds = Number(challengeNumber) === 2 || Number(challengeNumber) === 4
    ? Number(scoring.timerSeconds || challenge.timerSeconds || 180)
    : Number(challengeNumber) === 5
      ? Number(scoring.timerSeconds || challenge.timerSeconds || 300)
      : Number(challenge.timerSeconds || scoring.timerSeconds || 0);
  const delaySeconds = Number(challengeNumber) === 2
    ? Number(scoring.timerStartDelaySeconds ?? 20)
    : Number(challengeNumber) === 4
      ? Number(scoring.timerStartDelaySeconds ?? 15)
      : 0;

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
  let memberCode = undefined;
  let collaborative = false;
  if (n === 5 && Array.isArray(challenge.memberPrompts) && challenge.memberPrompts.length) {
    collaborative = true;
    memberCode = challenge.memberPrompts[memberIndex] || '';
    // Keep shared instruction as prompt; each person also gets their code fragment.
    prompt = challenge.prompt || 'Combine all teammate codes in order into one word.';
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
    || progress?.failureReason === 'REVEALED_ZERO_POINTS',
  );

  const showDestination = progress?.state === 'COMPLETED'
    || progress?.failureReason === 'REVEALED_ZERO_POINTS'
    || revealed;

  const startedAt = progress?.startedAt || null;
  const expiresAt = progress?.expiresAt || null;
  const nowMs = nowDate(now).getTime();
  const timerArmed = !startedAt || nowMs >= new Date(startedAt).getTime();
  const instructionPhase = (n === 2 || n === 4)
    && progress?.state === 'ACTIVE'
    && Boolean(startedAt)
    && !timerArmed;

  const timeExpired = Boolean(
    expiresAt
    && timerArmed
    && isExpired(expiresAt, now)
    && progress.state === 'ACTIVE',
  );

  return {
    challengeNumber: n,
    type: challenge.type,
    prompt,
    memberCode,
    collaborative,
    howTo: CLUE_HOW_TO[n] || null,
    destinationInstruction: showDestination
      ? (challenge.destinationInstruction
        || (n === 1
          ? 'Go to the location. Every team member must scan the station QR.'
          : n === 4
            ? 'Report to your start location. Ask the organizer to mark your team reached.'
            : ''))
      : undefined,
    // Never echo canonical answer string into client messages path — only location label for reveal
    revealedLocation: revealed && n === 1
      ? (revealedLocation || null)
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
    startedAt,
    expiresAt,
    timerStartsAt: startedAt,
    instructionPhase,
    timerArmed,
    timerSeconds: (n === 2 || n === 4) ? (scoring?.timerSeconds || (n === 2 ? 180 : 300)) : undefined,
    instructionDelaySeconds: n === 2 ? (scoring?.timerStartDelaySeconds ?? 20) : undefined,
    awardedPoints: progress?.awardedPoints ?? null,
    failureReason: progress?.failureReason || null,
    timeExpired,
    allowLateSubmit: Boolean(
      scoring?.allowLateSubmit
      || n === 2
      || n === 4,
    ),
    scoringBands: (n === 2 || n === 4) && state === 'ACTIVE'
      ? (scoring?.speedBonusBands || null)
      : undefined,
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

  // Clue 2: block answers during the instruction read delay
  if (
    Number(challengeNumber) === 2
    && progress.startedAt
    && nowDate(now).getTime() < new Date(progress.startedAt).getTime()
  ) {
    const secs = Math.ceil(
      (new Date(progress.startedAt).getTime() - nowDate(now).getTime()) / 1000,
    );
    const err = new Error(
      `Read the instructions first — the 3-minute timer starts in ${secs}s`,
    );
    err.status = 409;
    err.code = 'TIMER_NOT_STARTED';
    throw err;
  }

  const expired = isExpired(progress.expiresAt, now);
  const allowLate = Boolean(scoring.allowLateSubmit)
    || Number(challengeNumber) === 2
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
        revealedLocation: existing?.failureReason === 'REVEALED_ZERO_POINTS'
          ? (challenge.answer || challenge.destinationInstruction || null)
          : undefined,
        destinationInstruction: existing?.failureReason === 'REVEALED_ZERO_POINTS'
          ? (challenge.destinationInstruction || '')
          : undefined,
        message: 'Answer already processed — refresh if your stage looks wrong.',
        teamStage: freshTeam?.currentStage || team.currentStage,
        currentScore: freshTeam?.currentScore ?? team.currentScore,
        alreadyProcessed: true,
      };
    }

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

    notifyTeam(updatedTeam);
    return {
      correct: false,
      state: updatedProgress.state || (failed ? 'FAILED' : 'ACTIVE'),
      attemptsLeft,
      awardedPoints: 0,
      revealed: Boolean(clue1Reveal),
      revealedLocation: clue1Reveal
        ? (challenge.answer || challenge.destinationInstruction || null)
        : undefined,
      destinationInstruction: clue1Reveal
        ? (challenge.destinationInstruction || '')
        : undefined,
      nextAttemptPoints: !failed && nextPts != null ? nextPts : undefined,
      message: clue1Reveal
        ? `Out of attempts. Location unlocked (0 points). Go scan the station QR with all ${Math.max(2, Math.min(8, Number(event?.teamSize) || 4))} members.`
        : attemptsLeft > 0
          ? `Incorrect. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left`
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
            currentScore: applyAward(fresh.currentScore, award.total),
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
      awardedPoints: award.total,
      stage: updatedTeam.currentStage,
      score: updatedTeam.currentScore,
    },
  });

  const nextInstruction = Number(challengeNumber) === 2
    ? (
      challenge.destinationInstruction
      || 'Go to your next location now. Find the shared green SECOND SCAN QR. '
        + 'All members scan, then enter your team code to unlock Clue 3.'
    )
    : Number(challengeNumber) === 3
      ? (
        challenge.destinationInstruction
        || 'Riddle solved — go find the shared blue THIRD SCAN QR. '
          + 'All members scan, then enter your team code to unlock the prop hunt.'
      )
    : Number(challengeNumber) === 4
      ? (
        challenge.destinationInstruction
        || 'Prop found — scan the shared purple FOURTH SCAN QR here. '
          + 'All members scan, then enter your team code to unlock Final.'
      )
    : Number(challengeNumber) === 5
      ? (
        challenge.destinationInstruction
        || 'Report to your start location. Ask the organizer to mark your team reached.'
      )
      : (challenge.destinationInstruction || '');

  notifyTeam(updatedTeam);
  return {
    correct: true,
    state: 'COMPLETED',
    attemptsLeft: Math.max(0, maxAttempts - nextAttempts),
    awardedPoints: award.total,
    speedBonus: award.speedBonus,
    late: Boolean(award.late),
    destinationInstruction: nextInstruction,
    teamStage: updatedTeam.currentStage,
    currentScore: updatedTeam.currentScore,
    message: Number(challengeNumber) === 2
      ? (
        award.late
          ? 'Correct (0 pts — time up). Go scan green SECOND SCAN, then enter team code → Clue 3.'
          : 'Correct! Go to next place · shared green QR · scan + team code → Clue 3.'
      )
      : Number(challengeNumber) === 4
        ? (
          award.late
            ? 'Correct (0 pts — time up). Scan purple FOURTH SCAN here, then team code → Final.'
            : 'Correct! Scan the purple FOURTH SCAN QR here — all members + team code → Final.'
        )
      : Number(challengeNumber) === 5
        ? (
          award.late
            ? 'Correct (0 pts — time up). Report to your start — ask the organizer to mark you reached.'
            : 'Correct! Report to your start location and ask the organizer to mark your team reached.'
        )
        : (award.late
          ? 'Correct — but time expired. 0 points awarded. Continue to the next step.'
          : undefined),
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

  if (
    Number(challengeNumber) === 2
    && progress.startedAt
    && nowDate(now).getTime() < new Date(progress.startedAt).getTime()
  ) {
    const err = new Error('Hints unlock when the 3-minute timer starts');
    err.status = 409;
    err.code = 'TIMER_NOT_STARTED';
    throw err;
  }

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

  // Auto-timeout challenges without late submit. Clue 2/4 stay ACTIVE for late 0-pt submit.
  for (const ch of challenges) {
    const p = byNumber2.get(ch.challengeNumber);
    const scoringRow = scoringForChallenge(eventForTimeout, ch.challengeNumber);
    if (scoringRow.allowLateSubmit || ch.challengeNumber === 2 || ch.challengeNumber === 4 || ch.challengeNumber === 5) {
      continue;
    }
    if (
      p?.state === 'ACTIVE'
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
    if (p?.failureReason === 'REVEALED_ZERO_POINTS' && Number(ch.challengeNumber) === 1) {
      // eslint-disable-next-line no-await-in-loop
      const secret = await CampusHuntChallenge.findById(ch._id).select('+answer');
      revealedLocation = secret?.answer || ch.destinationInstruction || null;
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
  const [startingPoint, round, eventMeta] = await Promise.all([
    teamFresh.startingPointId
      ? CampusHuntStartingPoint.findById(teamFresh.startingPointId)
        .select('code name description releasesPaused')
        .lean()
      : null,
    teamFresh.roundId
      ? CampusHuntRound.findById(teamFresh.roundId).select('releasesPaused').lean()
      : null,
    CampusHuntEvent.findById(teamFresh.eventId).select('teamSize').lean(),
  ]);

  const teamSize = Math.max(2, Math.min(8, Number(eventMeta?.teamSize) || 4));

  return {
    team: teamFresh,
    teamSize,
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
