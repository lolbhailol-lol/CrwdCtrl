const test = require('node:test');
const assert = require('node:assert/strict');

const intelHunt = require('../../../src/modules/campus-hunt/finale/missions/intelHunt');
const fieldTerminal = require('../../../src/modules/campus-hunt/finale/missions/fieldTerminal');
const { isRoundClosed } = require('../../../src/modules/campus-hunt/services/timerService');
const { FINALE_DEFAULTS } = require('../../../src/modules/campus-hunt/constants');

const sampleAssignment = {
  location1: {
    id: 'a',
    name: 'Loc1',
    instruction: 'Find A',
    acceptedAnswers: ['THUN'],
    fragment: 'THUN',
  },
  location2: {
    id: 'b',
    name: 'Loc2',
    instruction: 'Find B',
    acceptedAnswers: ['DER'],
    fragment: 'DER',
  },
  assignedLocationIds: ['a', 'b'],
  combinedAnswer: 'THUNDER',
};

const baseConfig = {
  missions: [
    { id: 'intel_hunt', points: 50 },
    { id: 'field_terminal', points: 75 },
  ],
  intelHunt: {
    maxAttemptsPerStep: 2,
  },
  fieldTerminal: {
    locationName: 'Device Station',
    maxAttempts: 3,
  },
};

const entry = {
  completedMissionIds: [],
  activeMissionId: null,
  status: 'playing',
};

test('Intel Hunt: loc2 hidden until loc1 success', () => {
  const { state, playerView } = intelHunt.startRun(entry, baseConfig, { assignment: sampleAssignment });
  assert.equal(state.step, 'loc1');
  assert.equal(playerView.step, 'loc1');
  assert.equal(playerView.locationName, 'Loc1');

  const run = { state };
  const wrong = intelHunt.submitStep(entry, run, { answer: 'NOPE' }, baseConfig);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.state.step, 'loc1');

  const ok1 = intelHunt.submitStep(entry, run, { answer: 'THUN' }, baseConfig);
  run.state = ok1.state;
  assert.equal(ok1.ok, true);
  assert.equal(ok1.state.step, 'loc2');
  assert.equal(ok1.playerView.step, 'loc2');
  assert.equal(ok1.state.intel1Fragment, 'THUN');
});

test('Intel Hunt: combine requires both fragments and awards points once', () => {
  const run = {
    state: {
      step: 'combine',
      intel1Fragment: 'THUN',
      intel2Fragment: 'DER',
      assignment: sampleAssignment,
      combinedAnswer: 'THUNDER',
      attempts: { loc1: 1, loc2: 1, combine: 0 },
    },
  };
  const bad = intelHunt.submitStep(entry, run, { answer: 'WRONG' }, baseConfig);
  assert.equal(bad.ok, false);
  assert.equal(bad.complete, undefined);

  const good = intelHunt.submitStep(entry, run, { answer: 'THUNDER' }, baseConfig);
  assert.equal(good.ok, true);
  assert.equal(good.complete, true);
  assert.equal(good.points, 50);
});

test('Intel Hunt: combine enforces max attempts', () => {
  const run = {
    state: {
      step: 'combine',
      intel1Fragment: 'THUN',
      intel2Fragment: 'DER',
      assignment: sampleAssignment,
      combinedAnswer: 'THUNDER',
      attempts: { loc1: 1, loc2: 1, combine: 2 },
    },
  };
  const locked = intelHunt.submitStep(entry, run, { answer: 'WRONG' }, baseConfig);
  assert.equal(locked.ok, false);
  assert.equal(locked.playerView.locked, true);
});

test('Intel Hunt: max attempts never leaks accepted answers', () => {
  const { state } = intelHunt.startRun(entry, baseConfig, { assignment: sampleAssignment });
  const run = { state };
  for (let i = 0; i < 2; i += 1) {
    const res = intelHunt.submitStep(entry, run, { answer: 'NOPE' }, baseConfig);
    run.state = res.state;
  }
  const third = intelHunt.submitStep(entry, run, { answer: 'NOPE' }, baseConfig);
  assert.equal(third.playerView.locked, true);
  assert.doesNotMatch(third.playerView.message, /THUN/);
});

test('Field Terminal: awards grid session score (capped by mission max)', () => {
  const run = { state: { step: 'grid_game', attempts: 0, accessCode: 'ABC123' } };
  const config = {
    missions: [{ id: 'field_terminal', points: 100 }],
    fieldTerminal: {},
  };

  const bad = fieldTerminal.submitStep(entry, run, { answer: 'GRID-FAKE' }, config, {
    gridValidation: { ok: false, message: 'Invalid code' },
  });
  assert.equal(bad.ok, false);

  const good = fieldTerminal.submitStep(entry, run, { answer: 'GRID-ABCD' }, config, {
    gridValidation: { ok: true, score: 60 },
  });
  assert.equal(good.ok, true);
  assert.equal(good.complete, true);
  assert.equal(good.points, 60);

  const capped = fieldTerminal.submitStep(entry, run, { answer: 'GRID-ABCD' }, config, {
    gridValidation: { ok: true, score: 140 },
  });
  assert.equal(capped.points, 100);
});

test('Field Terminal: board + award respect admin max below grid max (e.g. 75)', () => {
  const config = {
    missions: [{ id: 'field_terminal', title: 'Field Terminal', points: 75 }],
    fieldTerminal: {},
  };
  const card = fieldTerminal.getBoardCard(entry, config, { title: 'Field Terminal', points: 75 });
  assert.equal(card.points, 75);

  const run = { state: { step: 'grid_game', attempts: 0, accessCode: 'ABC123' } };
  const awarded = fieldTerminal.submitStep(entry, run, { answer: 'GRID-ABCD' }, config, {
    gridValidation: { ok: true, score: 100 },
  });
  assert.equal(awarded.ok, true);
  assert.equal(awarded.points, 75);
});

test('Field Terminal: locks after max wrong codes', () => {
  const run = { state: { step: 'grid_game', attempts: 3, accessCode: 'ABC123' } };
  const config = {
    missions: [{ id: 'field_terminal', points: 100 }],
    fieldTerminal: { maxAttempts: 3 },
  };
  const locked = fieldTerminal.submitStep(entry, run, { answer: 'GRID-FAKE' }, config, {
    gridValidation: { ok: false, message: 'Invalid code' },
  });
  assert.equal(locked.ok, false);
  assert.equal(locked.playerView.locked, true);
});

test('Completed mission shows locked on board card', () => {
  const doneEntry = {
    ...entry,
    completedMissionIds: ['intel_hunt'],
  };
  const card = intelHunt.getBoardCard(doneEntry, baseConfig, { title: 'Intel Hunt', points: 50 });
  assert.equal(card.status, 'completed');
});

test('isRoundClosed blocks actions at timer zero and when locked', () => {
  const past = new Date(Date.now() - 1000);
  const liveRound = { status: 'live', endsAt: past };
  assert.equal(isRoundClosed(liveRound), true);

  const lockedRound = { status: 'locked' };
  assert.equal(isRoundClosed(lockedRound), true);

  const future = new Date(Date.now() + 60_000);
  const activeRound = { status: 'live', endsAt: future };
  assert.equal(isRoundClosed(activeRound), false);
});

test('Finale defaults match plan spec', () => {
  assert.equal(FINALE_DEFAULTS.startingScore, 500);
  assert.equal(FINALE_DEFAULTS.durationMinutes, 45);
  assert.equal(FINALE_DEFAULTS.maxFinalists, 12);
  assert.equal(FINALE_DEFAULTS.missionDurationMinutes, 10);
  assert.equal(FINALE_DEFAULTS.intelMaxAttemptsPerStep, 2);
});
