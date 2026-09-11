const test = require('node:test');
const assert = require('node:assert/strict');

const blackout = require('../../../src/modules/campus-hunt/finale/missions/blackout');
const {
  sanitizePublicMissionState,
  payloadContainsMissionSecrets,
} = require('../../../src/modules/campus-hunt/services/finale/finalePublicState');

const teamId = 'team-blackout-1';
const entry = {
  teamId,
  completedMissionIds: [],
  activeMissionId: null,
  status: 'playing',
};

const baseConfig = {
  missions: [{ id: 'operation_blackout', points: 200 }],
  blackout: {
    durationMinutes: 15,
    maxPenaltyTotal: 100,
    scout: {
      clue: 'east of auditorium',
      acceptedAnswers: ['ORBIT'],
      maxAttempts: 3,
      penalty: 10,
    },
    cracker: {
      puzzlePrompt: '12-15-3-11',
      acceptedAnswers: ['LOCK'],
      maxAttempts: 3,
      penalty: 15,
    },
    navigator: {
      challengePrompt: 'frequency',
      acceptedAnswers: ['88.1', '881'],
      maxAttempts: 3,
      penalty: 15,
    },
    controller: {
      challengePrompt: 'activation',
      acceptedAnswers: [],
      useDerivedActivation: true,
      maxAttempts: 3,
      penalty: 20,
    },
  },
};

function seatForRole(state, role) {
  const map = state.seatByRole || {};
  return Number(map[role]);
}

test('Blackout: deterministic roles and sequential Scout→Controller', () => {
  const { state } = blackout.startRun(entry, baseConfig, { teamId });
  assert.equal(state.step, 'scout');
  assert.ok(state.pendingToken);
  assert.ok(state.pendingRoute);
  assert.equal(Object.keys(state.roleBySeat).length, 4);

  const scoutSeat = seatForRole(state, 'scout');
  const crackerSeat = seatForRole(state, 'cracker');
  const navSeat = seatForRole(state, 'navigator');
  const ctrlSeat = seatForRole(state, 'controller');

  const run = { state };
  const wrong = blackout.submitStep(entry, run, { answer: 'NOPE' }, baseConfig, { seat: scoutSeat });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.penalty, 10);
  run.state = wrong.state;

  const scoutOk = blackout.submitStep(entry, run, { answer: 'ORBIT' }, baseConfig, { seat: scoutSeat });
  assert.equal(scoutOk.ok, true);
  assert.equal(scoutOk.state.step, 'cracker');
  assert.ok(scoutOk.state.accessToken);
  assert.doesNotMatch(JSON.stringify(scoutOk.playerView), /pendingToken/i);
  run.state = scoutOk.state;

  // Wrong role cannot advance cracker
  const wrongRole = blackout.submitStep(
    entry,
    run,
    { answer: run.state.accessToken },
    baseConfig,
    { seat: scoutSeat },
  );
  assert.equal(wrongRole.ok, false);

  const unlock = blackout.submitStep(
    entry,
    run,
    { answer: run.state.accessToken },
    baseConfig,
    { seat: crackerSeat },
  );
  assert.equal(unlock.ok, true);
  assert.equal(unlock.state.crackerUnlocked, true);
  run.state = unlock.state;

  const crack = blackout.submitStep(entry, run, { answer: 'LOCK' }, baseConfig, { seat: crackerSeat });
  assert.equal(crack.ok, true);
  assert.equal(crack.state.step, 'navigator');
  assert.ok(crack.state.route);
  run.state = crack.state;

  const routeOk = blackout.submitStep(
    entry,
    run,
    { answer: run.state.route },
    baseConfig,
    { seat: navSeat },
  );
  assert.equal(routeOk.ok, true);
  assert.equal(routeOk.state.navigatorUnlocked, true);
  run.state = routeOk.state;

  const freqOk = blackout.submitStep(entry, run, { answer: '88.1' }, baseConfig, { seat: navSeat });
  assert.equal(freqOk.ok, true);
  assert.equal(freqOk.state.step, 'controller');
  run.state = freqOk.state;

  const expected = blackout.buildDerivedActivation(run.state);
  const done = blackout.submitStep(entry, run, { answer: expected }, baseConfig, { seat: ctrlSeat });
  assert.equal(done.ok, true);
  assert.equal(done.complete, true);
  assert.equal(done.points, 200);
});

test('Blackout: role views hide other operators secrets until earned', () => {
  const { state } = blackout.startRun(entry, baseConfig, { teamId });
  const scoutSeat = seatForRole(state, 'scout');
  const crackerSeat = seatForRole(state, 'cracker');
  const run = { state };

  const after = blackout.submitStep(entry, run, { answer: 'ORBIT' }, baseConfig, { seat: scoutSeat });
  run.state = after.state;

  const scoutView = blackout.rebuildPlayerView(run, baseConfig, { seat: scoutSeat });
  assert.equal(scoutView.accessToken, run.state.accessToken);

  const crackerView = blackout.rebuildPlayerView(run, baseConfig, { seat: crackerSeat });
  assert.equal(crackerView.canSubmit, true);
  assert.equal(crackerView.subStep, 'token');
  // Token not auto-shown to cracker — must receive verbally
  assert.equal(crackerView.accessToken, null);
});

test('sanitizePublicMissionState never leaks blackout pending secrets', () => {
  const { state } = blackout.startRun(entry, baseConfig, { teamId });
  const pub = sanitizePublicMissionState('operation_blackout', state);
  assert.equal(pub.step, 'scout');
  assert.equal(payloadContainsMissionSecrets({ state: pub }), false);
  assert.equal(pub.pendingToken, undefined);
  assert.equal(pub.pendingRoute, undefined);
  assert.equal(pub.roleBySeat, undefined);
});

test('Blackout: unknown seat cannot submit', () => {
  const { state } = blackout.startRun(entry, baseConfig, { teamId });
  const res = blackout.submitStep(entry, { state }, { answer: 'ORBIT' }, baseConfig, { seat: -1 });
  assert.equal(res.ok, false);
  assert.ok(res.playerView.rosterError);
});

test('Blackout: playtestForceAdvance walks Scout→Controller', () => {
  const { state } = blackout.startRun(entry, baseConfig, { teamId });
  let cur = state;

  const scout = blackout.playtestForceAdvance(cur, baseConfig, { task: 'scout', teamId });
  assert.equal(scout.complete, false);
  assert.equal(scout.state.step, 'cracker');
  assert.ok(scout.state.accessToken);
  cur = scout.state;

  const cracker = blackout.playtestForceAdvance(cur, baseConfig, { task: 'cracker', teamId });
  assert.equal(cracker.state.step, 'navigator');
  assert.ok(cracker.state.route);
  cur = cracker.state;

  const nav = blackout.playtestForceAdvance(cur, baseConfig, { task: 'navigator', teamId });
  assert.equal(nav.state.step, 'controller');
  assert.ok(nav.state.frequency);
  cur = nav.state;

  const ctrl = blackout.playtestForceAdvance(cur, baseConfig, { task: 'controller', teamId });
  assert.equal(ctrl.complete, true);
  assert.equal(ctrl.points, 200);
  assert.equal(ctrl.state.step, 'done');
});
