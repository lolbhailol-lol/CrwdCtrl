const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertCanStart,
  assertCanLock,
  assertCanReopen,
  assertCanFinalize,
  buildActivationFilter,
} = require('../../src/modules/campus-hunt/services/roundLifecycle');

test('round lifecycle permits the normal scheduled-live-locked-finalized flow', () => {
  assert.doesNotThrow(() => assertCanStart('scheduled'));
  assert.doesNotThrow(() => assertCanLock('live'));
  assert.doesNotThrow(() => assertCanFinalize('locked'));
});

test('locked round restart requires explicit destructive reopen', () => {
  assert.throws(() => assertCanStart('locked'), /explicit reopen/);
  assert.throws(() => assertCanReopen('locked', { confirm: true }), /resetProgress/);
  assert.doesNotThrow(() => assertCanReopen('locked', {
    confirm: true,
    resetProgress: true,
  }));
});

test('finalized rounds cannot restart, lock, reopen, or finalize again', () => {
  assert.throws(() => assertCanStart('finalized'));
  assert.throws(() => assertCanLock('finalized'));
  assert.throws(() => assertCanReopen('finalized', { confirm: true, resetProgress: true }));
  assert.throws(() => assertCanFinalize('finalized'));
});

test('finalizing a live round requires explicit lock confirmation', () => {
  assert.throws(() => assertCanFinalize('live'), /locked round/);
  assert.doesNotThrow(() => assertCanFinalize('live', { confirmLock: true }));
});

test('wave activation can target routes or teams while requiring assignments', () => {
  const all = buildActivationFilter('event-1');
  assert.equal(all.currentStage, 'WAITING');
  assert.deepEqual(all.routeId, { $exists: true, $ne: null });

  const wave = buildActivationFilter('event-1', {
    teamIds: ['team-1'],
    routeIds: ['route-a'],
  });
  assert.deepEqual(wave._id, { $in: ['team-1'] });
  assert.deepEqual(wave.routeId, { $in: ['route-a'] });
});
