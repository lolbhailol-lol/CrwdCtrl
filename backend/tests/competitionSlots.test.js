const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveAllottedSlots,
  slotState,
  isCompetitionRegistrationClosed,
  assertCompetitionAcceptsRegistration,
  REGISTRATION_CLOSED_MESSAGE,
  COMPETITION_NOT_FOUND_MESSAGE,
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

test('registration_closed is independent of remaining slots', () => {
  assert.equal(isCompetitionRegistrationClosed({
    slotsAllotted: 50,
    registration: { status: 'registration_closed' },
  }), true);
  assert.equal(isCompetitionRegistrationClosed({
    registration: { status: 'not_started' },
  }), false);
  assert.equal(REGISTRATION_CLOSED_MESSAGE.includes('closed'), true);
});

test('missing competition does not bypass registration checks', async () => {
  await assert.rejects(
    () => assertCompetitionAcceptsRegistration(null),
    (err) => err.status === 404 && err.code === 'COMPETITION_NOT_FOUND'
      && err.message === COMPETITION_NOT_FOUND_MESSAGE,
  );
  await assert.rejects(
    () => assertCompetitionAcceptsRegistration(''),
    (err) => err.code === 'COMPETITION_NOT_FOUND',
  );
  await assert.rejects(
    () => assertCompetitionAcceptsRegistration({
      _id: '000000000000000000000001',
      registration: { status: 'registration_closed' },
      slotsAllotted: 50,
    }),
    (err) => err.status === 409 && err.code === 'REGISTRATION_CLOSED',
  );
});
