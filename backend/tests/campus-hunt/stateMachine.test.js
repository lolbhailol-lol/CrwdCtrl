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
  assert.ok(stagesAllowingCheckpoint(5).includes('CLUE_5_COMPLETED'));
  assert.ok(stagesAllowingCheckpoint('FINISH').includes('CLUE_6_COMPLETED'));
});

test('checkpoint cascade unlocks next clue', () => {
  const team = { currentStage: 'CLUE_1_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, '1');
  assert.equal(stage, 'CLUE_2_ACTIVE');
  assert.equal(team.currentStage, 'CLUE_2_ACTIVE');
});

test('green cascade unlocks Clue 3', () => {
  const team = { currentStage: 'CLUE_2_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, '2');
  assert.equal(stage, 'CLUE_3_ACTIVE');
});

test('blue cascade unlocks Clue 4', () => {
  const team = { currentStage: 'CLUE_3_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, '3');
  assert.equal(stage, 'CLUE_4_ACTIVE');
});

test('Field Terminal completion waits for purple scan, which unlocks Clue 5', () => {
  const team = { currentStage: 'CLUE_4_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, '4');
  assert.equal(stage, 'CLUE_5_ACTIVE');
  assert.equal(team.currentStage, 'CLUE_5_ACTIVE');
});

test('fifth scan cascade unlocks Clue 6 destination', () => {
  const team = { currentStage: 'CLUE_5_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, '5');
  assert.equal(stage, 'CLUE_6_ACTIVE');
});

test('finish cascade locks score after Clue 6', () => {
  const team = { currentStage: 'CLUE_6_COMPLETED' };
  const stage = applyCheckpointCompletionCascade(team, 'FINISH');
  assert.equal(stage, 'SCORE_LOCKED');
});

test('challenge stage helpers', () => {
  assert.equal(requiredStageForChallenge(2), 'CLUE_2_ACTIVE');
  assert.equal(resolvedStageForChallenge(2, 'timeout'), 'CLUE_2_TIMEOUT');
  assert.equal(resolvedStageForChallenge(3, 'failed'), 'CLUE_3_FAILED');
  assert.equal(resolvedStageForChallenge(3, 'completed'), 'CLUE_3_COMPLETED');
  assert.equal(resolvedStageForChallenge(6, 'completed'), 'CLUE_6_COMPLETED');
});

test('clue5 then fifth scan then destination', () => {
  assert.equal(canTransition('CLUE_5_COMPLETED', 'CHECKPOINT_5_COMPLETED'), true);
  assert.equal(canTransition('CHECKPOINT_5_COMPLETED', 'CLUE_6_ACTIVE'), true);
  assert.equal(canTransition('CLUE_5_COMPLETED', 'CLUE_6_ACTIVE'), false);
});
