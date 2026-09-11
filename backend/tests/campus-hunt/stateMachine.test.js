const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canTransition,
  assertTransition,
  stagesAllowingCheckpoint,
  applyCheckpointCompletionCascade,
  requiredStageForChallenge,
  resolvedStageForChallenge,
} = require('../../src/modules/campus-hunt/services/stateMachine');

test('allows legal transitions and rejects illegal jumps', () => {
  assert.equal(canTransition('CLUE_1_ACTIVE', 'CLUE_1_COMPLETED'), true);
  assert.equal(canTransition('CLUE_1_ACTIVE', 'CLUE_4_ACTIVE'), false);
  assert.throws(() => assertTransition('WAITING', 'SCORE_LOCKED'), /Invalid stage/);
});

test('checkpoint unlock stages', () => {
  assert.deepEqual(stagesAllowingCheckpoint(1), ['CLUE_1_COMPLETED']);
  assert.ok(stagesAllowingCheckpoint(2).includes('CLUE_2_FAILED'));
  assert.ok(stagesAllowingCheckpoint(3).includes('CLUE_3_COMPLETED'));
  assert.ok(stagesAllowingCheckpoint('FINISH').includes('CLUE_4_COMPLETED'));
});

test('checkpoint cascade unlocks next clue', () => {
  const team = { currentStage: 'CLUE_1_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, '1');
  assert.equal(stage, 'CLUE_2_ACTIVE');
  assert.equal(team.currentStage, 'CLUE_2_ACTIVE');
});

test('green cascade unlocks Clue 3 riddle', () => {
  const team = { currentStage: 'CLUE_2_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, '2');
  assert.equal(stage, 'CLUE_3_ACTIVE');
});

test('blue cascade unlocks Final', () => {
  const team = { currentStage: 'CLUE_3_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, '3');
  assert.equal(stage, 'CLUE_4_ACTIVE');
});

test('finish cascade locks score', () => {
  const team = { currentStage: 'CLUE_4_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, 'FINISH');
  assert.equal(stage, 'SCORE_LOCKED');
});

test('challenge stage helpers', () => {
  assert.equal(requiredStageForChallenge(2), 'CLUE_2_ACTIVE');
  assert.equal(resolvedStageForChallenge(2, 'timeout'), 'CLUE_2_TIMEOUT');
  // Clue 3 resolves to CLUE_3_* — blue scan comes next (not Final)
  assert.equal(resolvedStageForChallenge(3, 'failed'), 'CLUE_3_FAILED');
  assert.equal(resolvedStageForChallenge(3, 'completed'), 'CLUE_3_COMPLETED');
});

test('clue3 then blue then final', () => {
  assert.equal(canTransition('CLUE_3_COMPLETED', 'CHECKPOINT_3_COMPLETED'), true);
  assert.equal(canTransition('CHECKPOINT_3_COMPLETED', 'CLUE_4_ACTIVE'), true);
  assert.equal(canTransition('CLUE_3_COMPLETED', 'CLUE_4_ACTIVE'), false);
});
