const test = require('node:test');
const assert = require('node:assert/strict');

const lockbox = require('../../../src/modules/campus-hunt/finale/missions/lockbox');
const {
  sanitizePublicMissionState,
  payloadContainsMissionSecrets,
} = require('../../../src/modules/campus-hunt/services/finale/finalePublicState');
const { seatForUser } = require('../../../src/modules/campus-hunt/services/finale/finaleMissionService');

const assignedKey = {
  id: 'key_07',
  label: 'CRWDCtrl KEY — 07',
  acceptedAnswers: ['07', 'KEY-07', 'KEY 07', 'CRWDCTRL KEY — 07'],
};

const assignedCode = {
  id: 'code_01',
  acceptedCodes: ['9407'],
  playerPieces: [
    { seat: 0, label: 'Team Leader', info: 'The first digit is 9' },
    { seat: 1, label: 'Player 2', info: 'The second digit is 4' },
    { seat: 2, label: 'Player 3', info: 'The third digit is 0' },
    { seat: 3, label: 'Player 4', info: 'The fourth digit is 7' },
  ],
};

const baseConfig = {
  missions: [{ id: 'lockbox', points: 75 }],
  lockbox: {
    clue: 'Thousands of stories live here,\nbut none can speak.',
    locationHint: 'Solve the clue, then go find the physical key.',
    maxAttemptsKey: 3,
    maxAttemptsCode: 3,
    playerPieces: assignedCode.playerPieces,
    acceptedCodes: ['9407'],
    lockboxInstruction: 'Talk it out. Leader submits.',
  },
};

const entry = {
  completedMissionIds: [],
  activeMissionId: null,
  status: 'playing',
};

test('Lockbox: starts on Task 1 with campus clue only (no key id leaked)', () => {
  const { state, playerView } = lockbox.startRun(entry, baseConfig, { assignedKey, assignedCode });
  assert.equal(state.step, 'find_key');
  assert.equal(state.assignedKeyId, 'key_07');
  assert.equal(state.assignedCodeId, 'code_01');
  assert.equal(playerView.step, 'find_key');
  assert.equal(playerView.points, 75);
  assert.match(playerView.clue, /stories/i);
  assert.doesNotMatch(JSON.stringify(playerView), /key_07|KEY — 07|9407/i);
});

test('sanitizePublicMissionState strips Lockbox and Intel secrets', () => {
  const lockboxState = {
    step: 'find_key',
    attempts: { key: 1, code: 0 },
    missionExpiresAt: '2026-01-01T00:00:00.000Z',
    assignedKeyId: 'key_07',
    assignedKey: assignedKey,
    assignedCode,
    combinedAnswer: 'SHOULD_NOT_LEAK',
  };
  const pub = sanitizePublicMissionState('lockbox', lockboxState);
  assert.equal(pub.step, 'find_key');
  assert.deepEqual(pub.attempts, { key: 1, code: 0 });
  assert.equal(pub.missionExpiresAt, '2026-01-01T00:00:00.000Z');
  assert.equal(pub.assignedKey, undefined);
  assert.equal(pub.assignedKeyId, undefined);
  assert.equal(pub.assignedCode, undefined);
  assert.equal(payloadContainsMissionSecrets(pub), false);
  assert.equal(payloadContainsMissionSecrets({ activeMission: { state: lockboxState } }), true);

  const intelState = {
    step: 'loc1',
    assignment: {
      location1: { acceptedAnswers: ['ARC'] },
      location2: { acceptedAnswers: ['ADE'] },
    },
    combinedAnswer: 'ARCADE',
  };
  const intelPub = sanitizePublicMissionState('intel_hunt', intelState);
  assert.equal(intelPub.step, 'loc1');
  assert.equal(intelPub.assignment, undefined);
  assert.equal(intelPub.combinedAnswer, undefined);
  assert.equal(payloadContainsMissionSecrets(intelPub), false);

  const devicePub = sanitizePublicMissionState('field_terminal', {
    step: 'grid_game',
    accessCode: 'ABC123',
    gridSessionId: 'sess1',
  });
  assert.equal(devicePub.accessCode, 'ABC123');
  assert.equal(devicePub.gridSessionId, 'sess1');
});

test('Lockbox: wrong key fails; correct key advances to Task 2 only', () => {
  const { state } = lockbox.startRun(entry, baseConfig, { assignedKey, assignedCode });
  const run = { state };

  const wrong = lockbox.submitStep(entry, run, { answer: '99' }, baseConfig, { isLeader: true, seat: 0 });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.state.step, 'find_key');
  assert.equal(wrong.complete, undefined);

  run.state = wrong.state;
  const ok = lockbox.submitStep(entry, run, { answer: '07' }, baseConfig, { isLeader: true, seat: 0 });
  assert.equal(ok.ok, true);
  assert.equal(ok.complete, false);
  assert.equal(ok.state.step, 'lockbox_code');
  assert.equal(ok.playerView.step, 'lockbox_code');
  assert.equal(ok.playerView.yourInfo, 'The first digit is 9');
});

test('Lockbox: Task 2 uses assigned code snapshot and awards +75 once', () => {
  const run = {
    state: {
      step: 'lockbox_code',
      assignedKeyId: 'key_07',
      assignedKey,
      assignedCodeId: 'code_02',
      assignedCode: {
        id: 'code_02',
        acceptedCodes: ['3815'],
        playerPieces: [
          { seat: 0, label: 'Team Leader', info: 'The first digit is 3' },
          { seat: 1, label: 'Player 2', info: 'The second digit is 8' },
          { seat: 2, label: 'Player 3', info: 'The third digit is 1' },
          { seat: 3, label: 'Player 4', info: 'The fourth digit is 5' },
        ],
      },
      attempts: { key: 1, code: 0 },
    },
  };

  const seat2 = lockbox.rebuildPlayerView(run, baseConfig, { seat: 2, isLeader: false });
  assert.equal(seat2.yourInfo, 'The third digit is 1');
  assert.equal(seat2.canSubmit, false);

  const bad = lockbox.submitStep(entry, run, { answer: '9407' }, baseConfig, { isLeader: true, seat: 0 });
  assert.equal(bad.ok, false);

  run.state = bad.state;
  const good = lockbox.submitStep(entry, run, { answer: '3815' }, baseConfig, { isLeader: true, seat: 0 });
  assert.equal(good.ok, true);
  assert.equal(good.complete, true);
  assert.equal(good.points, 75);
});

test('Lockbox: unknown seat does not get leader piece', () => {
  const run = {
    state: {
      step: 'lockbox_code',
      assignedCode,
      attempts: { key: 1, code: 0 },
    },
  };
  const view = lockbox.rebuildPlayerView(run, baseConfig, { seat: -1, isLeader: false });
  assert.equal(view.yourSeat, -1);
  assert.equal(view.yourInfo, null);
  assert.ok(view.rosterError);
  assert.equal(view.canSubmit, false);
});

test('seatForUser: leader=0, members=1..n, unknown=-1', () => {
  const team = {
    leaderUserId: 'L1',
    memberUserIds: ['M1', 'M2', 'M3'],
    isLeader(id) { return String(id) === 'L1'; },
  };
  assert.equal(seatForUser(team, 'L1'), 0);
  assert.equal(seatForUser(team, 'M2'), 2);
  assert.equal(seatForUser(team, 'UNKNOWN'), -1);
  assert.equal(seatForUser(null, 'L1'), -1);
});

test('Lockbox: resume state keeps attempts (handler preserves state shape)', () => {
  const { state } = lockbox.startRun(entry, baseConfig, { assignedKey, assignedCode });
  const run = { state };
  const wrong = lockbox.submitStep(entry, run, { answer: '99' }, baseConfig, { isLeader: true, seat: 0 });
  assert.equal(wrong.state.attempts.key, 1);
  assert.equal(wrong.state.assignedKeyId, 'key_07');
  // Abandon/resume service reactivates this state; attempts must remain
  const resumedView = lockbox.rebuildPlayerView({ state: wrong.state }, baseConfig, { seat: 0, isLeader: true });
  assert.equal(resumedView.step, 'find_key');
  assert.equal(wrong.state.attempts.key, 1);
});

test('Lockbox: never has a third task step', () => {
  const { state } = lockbox.startRun(entry, baseConfig, { assignedKey, assignedCode });
  assert.equal(state.step, 'find_key');
  const run = { state };
  const afterKey = lockbox.submitStep(entry, run, { answer: 'KEY-07' }, baseConfig, { isLeader: true, seat: 0 });
  assert.equal(afterKey.state.step, 'lockbox_code');
  run.state = afterKey.state;
  const done = lockbox.submitStep(entry, run, { answer: '9407' }, baseConfig, { isLeader: true, seat: 0 });
  assert.equal(done.state.step, 'done');
  assert.ok(['find_key', 'lockbox_code', 'done'].includes(done.state.step));
});
