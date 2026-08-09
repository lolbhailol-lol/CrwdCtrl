const test = require('node:test');
const assert = require('node:assert/strict');

const CampusHuntRound = require('../../src/modules/campus-hunt/models/CampusHuntRound');
const CampusHuntStartingPoint = require(
  '../../src/modules/campus-hunt/models/CampusHuntStartingPoint',
);
const CampusHuntTeam = require('../../src/modules/campus-hunt/models/CampusHuntTeam');
const CampusHuntChallenge = require('../../src/modules/campus-hunt/models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const {
  releaseTeamIfDue,
} = require('../../src/modules/campus-hunt/services/teamReleaseService');
const {
  buildDeterministicSchedule,
} = require('../../src/modules/campus-hunt/services/startScheduleService');
const {
  assertTeamEligibleForCheckpoint,
} = require('../../src/modules/campus-hunt/services/checkpointService');
const {
  publicChallengeView,
} = require('../../src/modules/campus-hunt/services/challengeService');
const {
  requireTeamLeader,
} = require('../../src/modules/campus-hunt/middleware/playerAuthz');

const id = (suffix) => `64f0000000000000000000${suffix}`;

function releaseFixture(overrides = {}) {
  return {
    _id: id('01'),
    eventId: id('02'),
    roundId: id('03'),
    routeId: id('04'),
    startingPointId: id('05'),
    clue1ChallengeId: id('06'),
    firstCheckpointId: id('07'),
    scheduledStartAt: new Date('2026-08-09T05:00:00.000Z'),
    startStatus: 'READY',
    currentStage: 'WAITING',
    ...overrides,
  };
}

async function withReleaseLookups(team, round, point, callback) {
  const originals = {
    team: CampusHuntTeam.findById,
    round: CampusHuntRound.findById,
    point: CampusHuntStartingPoint.findById,
  };
  CampusHuntTeam.findById = async () => team;
  CampusHuntRound.findById = async () => round;
  CampusHuntStartingPoint.findById = async () => point;
  try {
    await callback();
  } finally {
    CampusHuntTeam.findById = originals.team;
    CampusHuntRound.findById = originals.round;
    CampusHuntStartingPoint.findById = originals.point;
  }
}

test('schedule service honors per-start capacity and release interval', () => {
  const teams = [1, 2, 3].map((number) => ({
    _id: `team-${number}`,
    teamCode: `TEAM-${number}`,
  }));
  const startingPoints = [
    { _id: 'start-a', code: 'A', displayOrder: 1, capacity: 1, active: true },
    { _id: 'start-b', code: 'B', displayOrder: 2, capacity: 2, active: true },
  ];
  const routes = [{ _id: 'route-a', routeKey: 'A', active: true }];
  const variants = startingPoints.map((point) => ({
    _id: `variant-${point._id}`,
    routeId: 'route-a',
    startingPointId: point._id,
    challengeNumber: 1,
    variantKey: point.code,
    firstCheckpointId: `cp-${point._id}`,
    active: true,
  }));
  const startsAt = new Date('2026-08-09T05:00:00.000Z');

  const schedule = buildDeterministicSchedule({
    teams,
    startingPoints,
    routes,
    variants,
    startsAt,
    releaseIntervalMinutes: 3,
  });

  assert.deepEqual(schedule.map((row) => row.startingPointCode), ['A', 'B', 'B']);
  assert.deepEqual(
    schedule.map((row) => row.scheduledStartAt.toISOString()),
    [
      startsAt.toISOString(),
      startsAt.toISOString(),
      new Date(startsAt.getTime() + 3 * 60 * 1000).toISOString(),
    ],
  );
  assert.ok(schedule.every((row) => row.complete));
});

test('scheduled release rejects a team before its slot without a database', async () => {
  const team = releaseFixture();
  await withReleaseLookups(
    team,
    {
      eventId: team.eventId,
      status: 'live',
      scheduleStatus: 'locked',
      releasesPaused: false,
    },
    { eventId: team.eventId, releasesPaused: false },
    async () => {
      await assert.rejects(
        releaseTeamIfDue({
          team,
          now: new Date('2026-08-09T04:59:59.000Z'),
        }),
        (error) => (
          error.code === 'START_NOT_DUE'
          && error.scheduledStartAt.getTime() === team.scheduledStartAt.getTime()
        ),
      );
    },
  );
});

test('round and starting-point pauses block timed releases', async () => {
  const team = releaseFixture();
  const due = new Date('2026-08-09T05:01:00.000Z');

  for (const [roundPaused, pointPaused] of [[true, false], [false, true]]) {
    // eslint-disable-next-line no-await-in-loop
    await withReleaseLookups(
      team,
      {
        eventId: team.eventId,
        status: 'live',
        scheduleStatus: 'locked',
        releasesPaused: roundPaused,
      },
      { eventId: team.eventId, releasesPaused: pointPaused },
      async () => {
        await assert.rejects(
          releaseTeamIfDue({ team, now: due }),
          (error) => error.code === 'RELEASES_PAUSED',
        );
      },
    );
  }
});

test('assigned first-checkpoint and allow-list checks reject the wrong team', () => {
  const team = releaseFixture({ currentStage: 'CLUE_1_COMPLETED' });
  const baseCheckpoint = {
    _id: team.firstCheckpointId,
    eventId: team.eventId,
    roundId: team.roundId,
    routeId: team.routeId,
    progressionKey: '1',
    active: true,
  };

  assert.doesNotThrow(() => assertTeamEligibleForCheckpoint(team, baseCheckpoint));
  assert.throws(
    () => assertTeamEligibleForCheckpoint(
      team,
      { ...baseCheckpoint, _id: id('08') },
    ),
    (error) => error.code === 'WRONG_FIRST_CHECKPOINT',
  );
  assert.throws(
    () => assertTeamEligibleForCheckpoint(
      team,
      { ...baseCheckpoint, allowedTeamIds: [id('09')] },
    ),
    (error) => error.code === 'TEAM_NOT_ALLOWED',
  );
});

test('Clue 1 content remains leader-only after release', () => {
  const challenge = {
    challengeNumber: 1,
    type: 'navigation',
    prompt: 'Leader secret',
    maxAttempts: 3,
  };
  const progress = { state: 'ACTIVE', attempts: 0 };
  const leader = publicChallengeView(
    challenge,
    progress,
    { isLeader: true, teamStage: 'CLUE_1_ACTIVE' },
  );
  const scanner = publicChallengeView(
    challenge,
    progress,
    { isLeader: false, teamStage: 'CLUE_1_ACTIVE' },
  );

  assert.equal(leader.prompt, 'Leader secret');
  assert.equal(scanner.prompt, null);

  let response;
  requireTeamLeader(
    { isHuntLeader: false },
    {
      status(status) {
        response = { status };
        return {
          json(body) {
            response.body = body;
            return response;
          },
        };
      },
    },
    () => assert.fail('scanner must not pass leader authorization'),
  );
  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'LEADER_ONLY');
});

test('staggered-start model fields enforce enum and capacity validation', async () => {
  const round = new CampusHuntRound({
    eventId: id('10'),
    roundNumber: 1,
    name: 'THE_HUNT',
    releaseIntervalMinutes: 0,
    assignmentStrategy: 'random',
    scheduleStatus: 'open',
  });
  await assert.rejects(round.validate(), /releaseIntervalMinutes|assignmentStrategy|scheduleStatus/);

  const point = new CampusHuntStartingPoint({
    eventId: id('10'),
    roundId: id('11'),
    name: 'North Gate',
    code: 'NORTH',
    capacity: 0,
  });
  await assert.rejects(point.validate(), /capacity/);

  const team = new CampusHuntTeam({
    eventId: id('10'),
    teamCode: 'TEAM-1',
    teamName: 'Team One',
    leaderUserId: id('13'),
    startStatus: 'QUEUED',
  });
  await assert.rejects(team.validate(), /startStatus/);

  const challenge = new CampusHuntChallenge({
    eventId: id('10'),
    roundId: id('11'),
    routeId: id('12'),
    challengeNumber: 1,
    type: 'navigation',
    difficulty: 'extreme',
  });
  await assert.rejects(challenge.validate(), /difficulty/);

  const checkpoint = new CampusHuntCheckpoint({
    eventId: id('10'),
    roundId: id('11'),
    routeId: id('12'),
    checkpointNumber: 1,
    checkpointKey: '1',
    progressionKey: 'START',
    locationName: 'Library',
    sequence: 1,
    capacityGuidance: 0,
  });
  await assert.rejects(checkpoint.validate(), /progressionKey|capacityGuidance/);
});
