const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertValidTeamRoster,
  uniqueIdStrings,
  hasDistinctVerifiedRoster,
  assertOnlineRosterReady,
} = require('../../src/modules/campus-hunt/utils/roster');
const {
  canExposeChallengeContent,
  publicChallengeView,
  rewindPreviousStep,
} = require('../../src/modules/campus-hunt/services/challengeService');
const {
  assertTeamEligibleForCheckpoint,
} = require('../../src/modules/campus-hunt/services/checkpointService');

test('roster rejects duplicate members and leader-in-members', () => {
  assert.throws(
    () => assertValidTeamRoster({
      leaderUserId: 'a',
      memberUserIds: ['b', 'b', 'c'],
      teamSize: 4,
    }),
    (err) => err.code === 'ROSTER_DUPLICATE',
  );
  assert.throws(
    () => assertValidTeamRoster({
      leaderUserId: 'a',
      memberUserIds: ['a', 'b', 'c'],
      teamSize: 4,
    }),
    (err) => err.code === 'ROSTER_DUPLICATE',
  );
});

test('roster accepts 4 distinct users', () => {
  const r = assertValidTeamRoster({
    leaderUserId: 'a',
    memberUserIds: ['b', 'c', 'd'],
    teamSize: 4,
  });
  assert.deepEqual(r.allMemberIds.sort(), ['a', 'b', 'c', 'd']);
});

test('distinct verified roster requires 4 unique roster hits', () => {
  const roster = ['a', 'b', 'c', 'd'];
  assert.equal(hasDistinctVerifiedRoster(['a', 'a', 'a', 'a'], roster, 4), false);
  assert.equal(hasDistinctVerifiedRoster(['a', 'b', 'c', 'd'], roster, 4), true);
  assert.equal(hasDistinctVerifiedRoster(['a', 'b', 'c', 'x'], roster, 4), false);
});

test('online roster ready rejects undersized unique teams', () => {
  assert.throws(
    () => assertOnlineRosterReady({
      leaderUserId: 'a',
      memberUserIds: ['a', 'a', 'a'],
    }, 4),
    (err) => err.code === 'ROSTER_INCOMPLETE',
  );
  const ids = assertOnlineRosterReady({
    leaderUserId: 'a',
    memberUserIds: ['b', 'c', 'd'],
  }, 4);
  assert.equal(uniqueIdStrings(ids).length, 4);
});

test('future clue prompts are not exposed while locked', () => {
  assert.equal(canExposeChallengeContent(2, 'LOCKED', 'CLUE_1_ACTIVE'), false);
  assert.equal(canExposeChallengeContent(3, 'LOCKED', 'CLUE_2_ACTIVE'), false);
  assert.equal(canExposeChallengeContent(4, undefined, 'CLUE_3_ACTIVE'), false);
  assert.equal(canExposeChallengeContent(2, 'ACTIVE', 'CLUE_2_ACTIVE'), true);
  assert.equal(canExposeChallengeContent(1, 'COMPLETED', 'CLUE_2_ACTIVE'), true);
});

test('Clue 1 text is never serialized to a non-leader', () => {
  const view = publicChallengeView(
    {
      _id: 'clue-1',
      challengeNumber: 1,
      prompt: 'Leader secret clue',
      type: 'text',
      destinationInstruction: 'Proceed to the checkpoint',
    },
    { state: 'COMPLETED', attempts: 1, awardedPoints: 20 },
    {
      isLeader: false,
      memberIndex: 0,
      now: new Date(),
      scoring: { maxAttempts: 3 },
      teamStage: 'CLUE_1_COMPLETED',
    },
  );
  assert.equal(view.prompt, null);
  assert.equal(view.destinationInstruction, 'Proceed to the checkpoint');
});

test('CP1 verification accepts only the team assigned first checkpoint', () => {
  const team = {
    _id: 'team-1',
    eventId: 'event-1',
    roundId: 'round-1',
    routeId: 'route-1',
    firstCheckpointId: 'cp-right',
    currentStage: 'CLUE_1_COMPLETED',
  };
  const baseCheckpoint = {
    eventId: 'event-1',
    roundId: 'round-1',
    routeId: 'route-1',
    progressionKey: '1',
    active: true,
    allowedTeamIds: [],
  };
  assert.doesNotThrow(() => assertTeamEligibleForCheckpoint(team, {
    ...baseCheckpoint,
    _id: 'cp-right',
  }));
  assert.throws(
    () => assertTeamEligibleForCheckpoint(team, { ...baseCheckpoint, _id: 'cp-wrong' }),
    (error) => error.code === 'WRONG_FIRST_CHECKPOINT',
  );
});

test('player rewind is disabled', async () => {
  await assert.rejects(
    () => rewindPreviousStep({ team: {}, userId: 'x', isLeader: true }),
    (err) => err.code === 'REWIND_DISABLED' && err.status === 403,
  );
});

test('force-unlock is unavailable when NODE_ENV=production', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const { forceUnlockClue2 } = require('../../src/modules/campus-hunt/controllers/playerController');
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    await forceUnlockClue2(
      { huntTeam: {}, user: { userId: 'x' }, body: {} },
      res,
      () => {},
    );
    assert.equal(res.statusCode, 404);
    assert.equal(res.body?.success, false);
  } finally {
    process.env.NODE_ENV = prev;
  }
});
