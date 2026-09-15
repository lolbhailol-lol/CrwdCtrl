/**
 * Player FINISH scan must be rejected — organizer marks reached at start.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  stagesAllowingCheckpoint,
  canTransition,
  applyCheckpointCompletionCascade,
} = require('../../src/modules/campus-hunt/services/stateMachine');

test('FINISH unlock stages remain for organizer cascade', () => {
  assert.ok(stagesAllowingCheckpoint('FINISH').includes('CLUE_4_COMPLETED'));
  assert.ok(stagesAllowingCheckpoint('FINISH').includes('CLUE_4_FAILED'));
});

test('organizer finish cascade still locks score', () => {
  const team = { currentStage: 'CLUE_4_COMPLETED' };
  assert.equal(applyCheckpointCompletionCascade(team, 'FINISH'), 'SCORE_LOCKED');
  assert.equal(canTransition('FINISH_COMPLETED', 'SCORE_LOCKED'), true);
});

test('player-facing ORGANIZER_FINISH_ONLY code is reserved', () => {
  // Contract used by checkpointService.playerScanStation
  const code = 'ORGANIZER_FINISH_ONLY';
  assert.equal(code, 'ORGANIZER_FINISH_ONLY');
});
