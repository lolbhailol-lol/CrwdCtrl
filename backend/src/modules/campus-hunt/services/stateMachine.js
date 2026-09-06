const {
  STAGE_TRANSITIONS,
  CHALLENGE_NUMBER_TO_ACTIVE_STAGE,
  CHALLENGE_RESOLVED_STAGES,
  CHECKPOINT_UNLOCK_STAGE,
  CHECKPOINT_NEXT_STAGE,
  AUTO_ADVANCE_AFTER_CHECKPOINT,
} = require('../constants');

function canTransition(fromStage, toStage) {
  const allowed = STAGE_TRANSITIONS[fromStage];
  if (!allowed) return false;
  return allowed.includes(toStage);
}

function assertTransition(fromStage, toStage) {
  if (!canTransition(fromStage, toStage)) {
    const err = new Error(`Invalid stage transition: ${fromStage} → ${toStage}`);
    err.code = 'INVALID_STAGE_TRANSITION';
    err.status = 409;
    throw err;
  }
}

function requiredStageForChallenge(challengeNumber) {
  return CHALLENGE_NUMBER_TO_ACTIVE_STAGE[challengeNumber] || null;
}

function resolvedStageForChallenge(challengeNumber, outcome) {
  const map = CHALLENGE_RESOLVED_STAGES[challengeNumber];
  if (!map) return null;
  let stage = map[outcome] || null;
  // Clue 3 resolves to CLUE_3_* then player scans blue (no auto-jump to Final).
  const auto = stage ? AUTO_ADVANCE_AFTER_CHECKPOINT[stage] : null;
  if (auto && canTransition(stage, auto)) {
    stage = auto;
  }
  return stage;
}

function stagesAllowingCheckpoint(checkpointKey) {
  const key = String(checkpointKey).toUpperCase() === 'FINISH'
    ? 'FINISH'
    : Number(checkpointKey);
  const unlock = CHECKPOINT_UNLOCK_STAGE[key];
  if (!unlock) return [];
  return Array.isArray(unlock) ? unlock : [unlock];
}

function nextStageAfterCheckpoint(checkpointKey) {
  const key = String(checkpointKey).toUpperCase() === 'FINISH'
    ? 'FINISH'
    : Number(checkpointKey);
  return CHECKPOINT_NEXT_STAGE[key] || null;
}

function autoAdvanceStage(stage) {
  return AUTO_ADVANCE_AFTER_CHECKPOINT[stage] || null;
}

/**
 * Apply a legal transition on a team document (in-memory).
 * Caller persists via conditional findOneAndUpdate.
 */
function applyStageTransition(team, toStage) {
  assertTransition(team.currentStage, toStage);
  const from = team.currentStage;
  team.currentStage = toStage;
  return { from, to: toStage };
}

/**
 * After checkpoint completion stage is set, auto-advance into next clue / score lock.
 */
function applyCheckpointCompletionCascade(team, checkpointKey) {
  const checkpointStage = nextStageAfterCheckpoint(checkpointKey);
  if (!checkpointStage) {
    const err = new Error(`Unknown checkpoint key: ${checkpointKey}`);
    err.code = 'INVALID_CHECKPOINT';
    err.status = 400;
    throw err;
  }
  assertTransition(team.currentStage, checkpointStage);
  team.currentStage = checkpointStage;

  const auto = autoAdvanceStage(checkpointStage);
  if (auto && canTransition(team.currentStage, auto)) {
    team.currentStage = auto;
  }
  return team.currentStage;
}

function isScoreLocked(stage) {
  return stage === 'SCORE_LOCKED' || stage === 'FINISH_COMPLETED';
}

function isChallengeTerminalProgress(state) {
  return ['COMPLETED', 'FAILED', 'TIMED_OUT', 'VOIDED'].includes(state);
}

module.exports = {
  canTransition,
  assertTransition,
  requiredStageForChallenge,
  resolvedStageForChallenge,
  stagesAllowingCheckpoint,
  nextStageAfterCheckpoint,
  autoAdvanceStage,
  applyStageTransition,
  applyCheckpointCompletionCascade,
  isScoreLocked,
  isChallengeTerminalProgress,
};
