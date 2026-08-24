const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveAllottedSlots,
  slotState,
} = require('../src/utils/competitionSlots');

test('allotted slots prefer slotsAllotted over nested maxRegistrations', () => {
  assert.equal(resolveAllottedSlots({ slotsAllotted: 10 }), 10);
  assert.equal(resolveAllottedSlots({
    slotsAllotted: 0,
    registration: { maxRegistrations: 8 },
  }), 8);
  assert.equal(resolveAllottedSlots({
    slotsAllotted: 0,
    registration: { settings: { maxRegistrations: 5 } },
  }), 5);
  assert.equal(resolveAllottedSlots({}), 0);
});

test('slot state treats 10 filled of 10 as full', () => {
  const foxHunt = slotState({ allotted: 10, filled: 10 });
  assert.equal(foxHunt.full, true);
  assert.equal(foxHunt.left, 0);
  assert.equal(foxHunt.limited, true);
});

test('zero allotted is unlimited and never full', () => {
  const open = slotState({ allotted: 0, filled: 40 });
  assert.equal(open.limited, false);
  assert.equal(open.full, false);
  assert.equal(open.left, null);
});
