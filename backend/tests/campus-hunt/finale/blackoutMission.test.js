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

const leader = { seat: 0, isLeader: true };

test('Blackout: leader-only phone sequential Scout→Controller', () => {
  const { state } = blackout.startRun(entry, baseConfig, { teamId });
  assert.equal(state.step, 'scout');
  assert.ok(state.pendingToken);
  assert.ok(state.pendingRoute);
  assert.equal(Object.keys(state.roleBySeat).length, 4);

  const run = { state };
  const wrong = blackout.submitStep(entry, run, { answer: 'NOPE' }, baseConfig, leader);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.penalty, 10);
  run.state = wrong.state;

  const scoutOk = blackout.submitStep(entry, run, { answer: 'ORBIT' }, baseConfig, leader);
  assert.equal(scoutOk.ok, true);
  assert.equal(scoutOk.state.step, 'cracker');
  assert.ok(scoutOk.state.accessToken);
  assert.equal(scoutOk.state.crackerUnlocked, true);
  assert.doesNotMatch(JSON.stringify(scoutOk.playerView), /pendingToken/i);
  run.state = scoutOk.state;

  const crack = blackout.submitStep(entry, run, { answer: 'LOCK' }, baseConfig, leader);
  assert.equal(crack.ok, true);
  assert.equal(crack.state.step, 'navigator');
  assert.ok(crack.state.route);
  assert.equal(crack.state.navigatorUnlocked, true);
  run.state = crack.state;

  // Leader phone auto-unlocks navigator — go straight to frequency.
  const freqOk = blackout.submitStep(entry, run, { answer: '88.1' }, baseConfig, leader);
  assert.equal(freqOk.ok, true);
  assert.equal(freqOk.state.step, 'controller');
  run.state = freqOk.state;

  const expected = blackout.buildDerivedActivation(run.state);
  const done = blackout.submitStep(entry, run, { answer: expected }, baseConfig, leader);
  assert.equal(done.ok, true);
  assert.equal(done.complete, true);
  assert.equal(done.points, 200);
});

test('Blackout: non-leader cannot submit; leader view keeps token on phone', () => {
  const { state } = blackout.startRun(entry, baseConfig, { teamId });
  const run = { state };

  const blocked = blackout.submitStep(entry, run, { answer: 'ORBIT' }, baseConfig, {
    seat: 1,
    isLeader: false,
  });
  assert.equal(blocked.ok, false);
  assert.match(String(blocked.playerView?.message || ''), /Team Leader/i);

  const scoutOk = blackout.submitStep(entry, run, { answer: 'ORBIT' }, baseConfig, leader);
  run.state = scoutOk.state;

  const leaderView = blackout.rebuildPlayerView(run, baseConfig, leader);
  assert.equal(leaderView.accessToken, run.state.accessToken);

  const memberView = blackout.rebuildPlayerView(run, baseConfig, { seat: 1, isLeader: false });
  assert.equal(memberView.canSubmit, false);
  assert.equal(memberView.accessToken, undefined);
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

test('Blackout: unknown seat without leader flag cannot submit', () => {
  const { state } = blackout.startRun(entry, baseConfig, { teamId });
  const res = blackout.submitStep(entry, { state }, { answer: 'ORBIT' }, baseConfig, { seat: -1 });
  assert.equal(res.ok, false);
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
