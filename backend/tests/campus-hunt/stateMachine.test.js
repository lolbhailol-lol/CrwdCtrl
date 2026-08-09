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
  assert.ok(stagesAllowingCheckpoint('FINISH').includes('CLUE_4_COMPLETED'));
});

test('checkpoint cascade unlocks next clue', () => {
  const team = { currentStage: 'CLUE_1_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, '1');
  assert.equal(stage, 'CLUE_2_ACTIVE');
  assert.equal(team.currentStage, 'CLUE_2_ACTIVE');
});

test('finish cascade locks score', () => {
  const team = { currentStage: 'CLUE_4_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, 'FINISH');
  assert.equal(stage, 'SCORE_LOCKED');
});

test('challenge stage helpers', () => {
  assert.equal(requiredStageForChallenge(2), 'CLUE_2_ACTIVE');
  assert.equal(resolvedStageForChallenge(2, 'timeout'), 'CLUE_2_TIMEOUT');
  assert.equal(resolvedStageForChallenge(3, 'failed'), 'CLUE_3_FAILED');
});
