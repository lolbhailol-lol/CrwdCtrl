const test = require('node:test');
const assert = require('node:assert/strict');

const { canTransition } = require('../../src/modules/campus-hunt/services/stateMachine');
const { isCampusHuntEnabled } = require('../../src/modules/campus-hunt/middleware/featureEnabled');

test('cannot skip directly to clue 4', () => {
  assert.equal(canTransition('CLUE_1_ACTIVE', 'CLUE_4_ACTIVE'), false);
  assert.equal(canTransition('CHECKPOINT_1_COMPLETED', 'CLUE_4_ACTIVE'), false);
  assert.equal(canTransition('CHECKPOINT_3_COMPLETED', 'CLUE_4_ACTIVE'), true);
});

test('feature flag defaults to disabled', () => {
  const prev = process.env.CAMPUS_HUNT_ENABLED;
  delete process.env.CAMPUS_HUNT_ENABLED;
  assert.equal(isCampusHuntEnabled(), false);
  process.env.CAMPUS_HUNT_ENABLED = 'true';
  assert.equal(isCampusHuntEnabled(), true);
  process.env.CAMPUS_HUNT_ENABLED = 'false';
  assert.equal(isCampusHuntEnabled(), false);
  if (prev === undefined) delete process.env.CAMPUS_HUNT_ENABLED;
  else process.env.CAMPUS_HUNT_ENABLED = prev;
});

test('score locked has no outbound transitions', () => {
  assert.equal(canTransition('SCORE_LOCKED', 'CLUE_1_ACTIVE'), false);
  assert.equal(canTransition('SCORE_LOCKED', 'FINISH_COMPLETED'), false);
});
