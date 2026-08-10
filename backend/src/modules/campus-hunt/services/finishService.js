/**
 * Organizer marks a team as reached at their start location after Clue 4.
 * Locks score (FINISH → SCORE_LOCKED).
 */

const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntRound = require('../models/CampusHuntRound');
const { applyCheckpointCompletionCascade } = require('./stateMachine');
const { completionMs } = require('./timerService');
const { writeAudit } = require('./auditService');

const FINISH_READY_STAGES = new Set(['CLUE_4_COMPLETED', 'CLUE_4_FAILED']);

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
      'Team must finish Clue 4 first, then report to their start location',
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
    reason: reason || 'Organizer marked team reached at start',
    before: { stage: fromStage },
    after: {
      stage: updated.currentStage,
      finalScore: updated.finalScore,
      finishedAt: updated.finishedAt,
    },
  });

  return {
    alreadyProcessed: false,
    team: updated,
    message: 'Team marked complete at start — score locked',
  };
}

module.exports = {
  markTeamReachedAtStart,
  FINISH_READY_STAGES,
};
