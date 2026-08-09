const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDeterministicSchedule,
} = require('../../src/modules/campus-hunt/services/startScheduleService');

function fixtures(teamCount, pointCount, pointCapacity) {
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    _id: `team-${index + 1}`,
    teamCode: `CC${String(index + 1).padStart(3, '0')}`,
  }));
  const startingPoints = Array.from({ length: pointCount }, (_, index) => ({
    _id: `start-${index + 1}`,
    code: `START-${index + 1}`,
    displayOrder: index,
    capacity: pointCapacity,
    active: true,
  }));
  const routes = Array.from({ length: 4 }, (_, index) => ({
    _id: `route-${index + 1}`,
    routeKey: String.fromCharCode(65 + index),
    active: true,
  }));
  const variants = [];
  for (const route of routes) {
    for (const point of startingPoints) {
      for (let index = 0; index < 4; index += 1) {
        variants.push({
          _id: `variant-${route._id}-${point._id}-${index}`,
          routeId: route._id,
          startingPointId: point._id,
          challengeNumber: 1,
          variantKey: `V${index + 1}`,
          firstCheckpointId: `cp-${route._id}-${index}`,
          active: true,
        });
      }
    }
  }
  return { teams, startingPoints, routes, variants };
}

test('deterministically assigns 40 teams across four starts with staggered parallel slots', () => {
  const data = fixtures(40, 4, 10);
  const startsAt = new Date('2026-08-09T04:30:00.000Z');
  const result = buildDeterministicSchedule({
    ...data,
    startsAt,
    releaseIntervalMinutes: 2,
    assignmentStrategy: 'route_balanced',
  });

  assert.equal(result.length, 40);
  for (const point of data.startingPoints) {
    const assigned = result.filter((row) => row.startingPointId === point._id);
    assert.equal(assigned.length, 10);
    assert.equal(assigned[0].scheduledStartAt.toISOString(), startsAt.toISOString());
    assert.equal(
      assigned[9].scheduledStartAt.toISOString(),
      new Date(startsAt.getTime() + 18 * 60 * 1000).toISOString(),
    );
    assert.equal(new Set(assigned.map((row) => row.routeId)).size, 4);
    assert.ok(assigned.every((row) => row.complete));
  }
});

test('supports future 50 team / five start configuration without hardcoded pilot values', () => {
  const data = fixtures(50, 5, 10);
  const result = buildDeterministicSchedule({
    ...data,
    startsAt: '2026-08-09T05:00:00.000Z',
    releaseIntervalMinutes: 3,
    assignmentStrategy: 'route_balanced',
  });
  assert.equal(result.length, 50);
  assert.deepEqual(
    data.startingPoints.map((point) => (
      result.filter((row) => row.startingPointId === point._id).length
    )),
    [10, 10, 10, 10, 10],
  );
});

test('rejects schedules that exceed active starting-point capacity', () => {
  const data = fixtures(41, 4, 10);
  assert.throws(
    () => buildDeterministicSchedule({
      ...data,
      startsAt: new Date(),
      releaseIntervalMinutes: 2,
    }),
    (error) => error.code === 'START_CAPACITY_EXCEEDED',
  );
});

test('marks assignments incomplete when no eligible Clue 1 variant exists', () => {
  const data = fixtures(1, 1, 10);
  data.variants = [];
  const [assignment] = buildDeterministicSchedule({
    ...data,
    startsAt: new Date(),
    releaseIntervalMinutes: 2,
  });
  assert.equal(assignment.complete, false);
  assert.equal(assignment.clue1ChallengeId, null);
  assert.equal(assignment.firstCheckpointId, null);
});
