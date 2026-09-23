/**
 * Finish at Mindspark Lobby after Clue 5 / red scan unlocks Clue 6.
 * Organizers tell teams a finish code; leader types it → score locked.
 * Admin desk can still mark reached without the code.
 */

const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntTeamProgress = require('../models/CampusHuntTeamProgress');
const { applyCheckpointCompletionCascade, canTransition } = require('./stateMachine');
const { completionMs } = require('./timerService');
const { writeAudit } = require('./auditService');
const { normalizeAnswer, matchesAnyAccepted } = require('../utils/answerNormalize');
const { resolveOrganizerFinishCode } = require('./stationCatalogService');
const { applyAward } = require('./scoringService');
const { DEFAULT_SCORING_CONFIG } = require('../constants');

const FINISH_READY_STAGES = new Set(['CLUE_6_COMPLETED', 'CLUE_6_FAILED']);
const FINISH_ENTRY_STAGES = new Set([
  'CLUE_6_ACTIVE',
  'CLUE_6_COMPLETED',
  'CLUE_6_FAILED',
]);

async function markTeamReachedAtStart({
  teamId,
  actor = {},
  reason = '',
  now = new Date(),
} = {}) {
  const team = await CampusHuntTeam.findById(teamId);
  if (!team) {
    const err = new Error('Team not found');
    err.status = 404;
    throw err;
  }

  if (team.currentStage === 'SCORE_LOCKED' || team.currentStage === 'FINISH_COMPLETED') {
    return {
      alreadyProcessed: true,
      team,
      message: 'Team already marked complete',
    };
  }

  if (!FINISH_READY_STAGES.has(team.currentStage)) {
    const err = new Error(
      'Team must reach Mindspark Lobby (Clue 6) first, then enter the finish code',
    );
    err.status = 409;
    err.code = 'NOT_READY_FOR_FINISH';
    throw err;
  }

  const fromStage = team.currentStage;
  applyCheckpointCompletionCascade(team, 'FINISH');

  const round = team.roundId ? await CampusHuntRound.findById(team.roundId) : null;
  const $set = {
    currentStage: team.currentStage,
    finishedAt: now,
    scoreLockedAt: now,
    finalScore: team.currentScore,
    status: team.status === 'disqualified' ? 'disqualified' : 'finished',
    startStatus: 'COMPLETED',
  };
  const startClock = team.actualStartAt || team.scheduledStartAt || round?.startsAt;
  if (startClock) {
    $set['stats.totalCompletionMs'] = completionMs(startClock, now);
  }

  const updated = await CampusHuntTeam.findOneAndUpdate(
    { _id: team._id, currentStage: fromStage },
    { $set },
    { new: true },
  );

  if (!updated) {
    const fresh = await CampusHuntTeam.findById(team._id);
    return {
      alreadyProcessed: true,
      team: fresh,
      message: 'Team already marked complete',
    };
  }

  await writeAudit({
    eventId: team.eventId,
    actorType: actor.actorType || 'admin',
    actorId: actor.actorId,
    actorLabel: actor.actorLabel,
    action: 'mark_start_reached',
    targetType: 'team',
    targetId: team._id,
    reason: reason || 'Organizer marked team reached at Mindspark Lobby',
    before: { stage: fromStage },
    after: {
      stage: updated.currentStage,
      finalScore: updated.finalScore,
      finishedAt: updated.finishedAt,
    },
  });

  const { publishTeamProgress } = require('./teamProgressBus');
  publishTeamProgress(team._id);

  return {
    alreadyProcessed: false,
    team: updated,
    message: 'Team marked complete at Mindspark Lobby — score locked',
  };
}

/**
 * Accepted finish codes: organizer code + this team's Clue 6 answer only.
 */
async function acceptedFinishCodes(team) {
  const event = await CampusHuntEvent.findById(team.eventId)
    .select('organizerFinishCode');
  const finish = resolveOrganizerFinishCode(event);
  const codes = [finish];
  if (team.clue6ChallengeId) {
    const ch = await CampusHuntChallenge.findById(team.clue6ChallengeId)
      .select('+answer acceptedAnswers');
    if (ch?.answer) codes.push(ch.answer);
    (ch?.acceptedAnswers || []).forEach((a) => codes.push(a));
  } else {
    // Shared DEFAULT Clue 6 for the route
    const shared = await CampusHuntChallenge.findOne({
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 6,
      active: true,
    }).select('+answer acceptedAnswers');
    if (shared?.answer) codes.push(shared.answer);
    (shared?.acceptedAnswers || []).forEach((a) => codes.push(a));
  }
  return [...new Set(codes.filter(Boolean).map((c) => String(c).trim()).filter(Boolean))];
}

/**
 * From CLUE_6_ACTIVE → mark Clue 6 complete (award flat pts) then ready for finish lock.
 */
async function completeClue6ForFinish(team, { userId, now = new Date() } = {}) {
  if (team.currentStage !== 'CLUE_6_ACTIVE') return team;

  let challenge = null;
  if (team.clue6ChallengeId) {
    challenge = await CampusHuntChallenge.findById(team.clue6ChallengeId);
  }
  if (!challenge) {
    challenge = await CampusHuntChallenge.findOne({
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      challengeNumber: 6,
      active: true,
    });
  }

  const basePts = Number(
    challenge?.basePoints
    ?? DEFAULT_SCORING_CONFIG.clue6?.basePoints
    ?? 25,
  ) || 0;

  if (challenge) {
    await CampusHuntTeamProgress.findOneAndUpdate(
      { teamId: team._id, challengeNumber: 6 },
      {
        $set: {
          eventId: team.eventId,
          teamId: team._id,
          challengeId: challenge._id,
          challengeNumber: 6,
          state: 'COMPLETED',
          awardedPoints: basePts,
          completedAt: now,
          submittedAt: now,
          failureReason: undefined,
        },
        $setOnInsert: {
          attempts: 1,
          startedAt: now,
        },
      },
      { upsert: true, new: true },
    );
  }

  const newScore = applyAward(team.currentScore, basePts);
  let updated = await CampusHuntTeam.findOneAndUpdate(
    { _id: team._id, currentStage: 'CLUE_6_ACTIVE' },
    {
      $set: {
        currentStage: 'CLUE_6_COMPLETED',
        currentScore: newScore,
        ...(challenge && !team.clue6ChallengeId ? { clue6ChallengeId: challenge._id } : {}),
      },
    },
    { new: true },
  );

  if (!updated) {
    updated = await CampusHuntTeam.findById(team._id);
    if (updated?.currentStage === 'CLUE_6_ACTIVE' && canTransition('CLUE_6_ACTIVE', 'CLUE_6_COMPLETED')) {
      updated.currentStage = 'CLUE_6_COMPLETED';
      updated.currentScore = newScore;
      await updated.save();
    }
  }

  if (userId) {
    await writeAudit({
      eventId: team.eventId,
      actorType: 'player',
      actorId: userId,
      action: 'challenge_6_completed',
      targetType: 'team',
      targetId: team._id,
      after: { stage: 'CLUE_6_COMPLETED', via: 'finish_code' },
    });
  }

  return updated || team;
}

/**
 * Leader types organizer finish code at Mindspark Lobby.
 * Works from CLUE_6_ACTIVE (complete + lock) or CLUE_6_COMPLETED (lock only).
 */
async function submitOrganizerFinishCode({
  team,
  userId,
  isLeader,
  finishCode,
  now = new Date(),
}) {
  if (!isLeader) {
    const err = new Error('Only the team leader can submit the finish code');
    err.status = 403;
    err.code = 'LEADER_ONLY';
    throw err;
  }

  if (team.currentStage === 'SCORE_LOCKED' || team.currentStage === 'FINISH_COMPLETED') {
    return {
      alreadyProcessed: true,
      team,
      message: 'Score already locked',
      finalScore: team.finalScore ?? team.currentScore,
      scoreLocked: true,
    };
  }

  if (!FINISH_ENTRY_STAGES.has(team.currentStage)) {
    const err = new Error(
      'Go to Mindspark Lobby after the red scan — then ask the organizer for the finish code',
    );
    err.status = 409;
    err.code = 'NOT_READY_FOR_FINISH';
    throw err;
  }

  const accepted = await acceptedFinishCodes(team);
  if (!matchesAnyAccepted(finishCode, accepted)) {
    const err = new Error('Wrong finish code — ask the organizer at Mindspark Lobby');
    err.status = 400;
    err.code = 'BAD_FINISH_CODE';
    throw err;
  }

  let working = team;
  if (working.currentStage === 'CLUE_6_ACTIVE') {
    working = await completeClue6ForFinish(working, { userId, now });
  }

  if (!FINISH_READY_STAGES.has(working.currentStage)) {
    const err = new Error('Could not complete Clue 6 — ask an organizer');
    err.status = 409;
    err.code = 'CLUE_6_INCOMPLETE';
    throw err;
  }

  const result = await markTeamReachedAtStart({
    teamId: working._id,
    actor: {
      actorType: 'player',
      actorId: userId,
      actorLabel: `team:${working.teamCode}`,
    },
    reason: `Player finish code ${normalizeAnswer(finishCode)}`,
    now,
  });

  return {
    ...result,
    correct: true,
    scoreLocked: true,
    finalScore: result.team?.finalScore ?? result.team?.currentScore,
    message: result.message
      || 'Finish code accepted — score locked at Mindspark Lobby',
  };
}

module.exports = {
  markTeamReachedAtStart,
  submitOrganizerFinishCode,
  acceptedFinishCodes,
  completeClue6ForFinish,
  FINISH_READY_STAGES,
  FINISH_ENTRY_STAGES,
};
