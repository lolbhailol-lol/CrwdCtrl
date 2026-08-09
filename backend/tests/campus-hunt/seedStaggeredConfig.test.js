const test = require('node:test');
const assert = require('node:assert/strict');

const {
  readSeedConfig,
  clue1Definition,
} = require('../../scripts/seed-campus-hunt-pilot');

test('seed config derives capacity without hardcoding the pilot size', () => {
  const config = readSeedConfig(
    {
      CAMPUS_HUNT_START_COUNT: '5',
      CAMPUS_HUNT_START_CAPACITY: '12',
      CAMPUS_HUNT_RELEASE_INTERVAL_MINUTES: '3',
      CAMPUS_HUNT_STARTS_AT: '2026-08-09T04:30:00.000Z',
    },
    [],
  );

  assert.equal(config.startCount, 5);
  assert.equal(config.startCapacity, 12);
  assert.equal(config.teamCapacity, 60);
  assert.equal(config.releaseIntervalMinutes, 3);
  assert.equal(config.locations.length, 5);
});

test('CLI staggered-start values override environment values', () => {
  const config = readSeedConfig(
    {
      CAMPUS_HUNT_START_COUNT: '2',
      CAMPUS_HUNT_START_CAPACITY: '5',
      CAMPUS_HUNT_RELEASE_INTERVAL_MINUTES: '9',
    },
    ['--start-count=3', '--start-capacity', '7', '--release-interval=4'],
  );

  assert.equal(config.startCount, 3);
  assert.equal(config.startCapacity, 7);
  assert.equal(config.releaseIntervalMinutes, 4);
  assert.equal(config.teamCapacity, 21);
});

test('seed config rejects team capacity above aggregate starting capacity', () => {
  assert.throws(
    () => readSeedConfig(
      {
        CAMPUS_HUNT_START_COUNT: '2',
        CAMPUS_HUNT_START_CAPACITY: '3',
        CAMPUS_HUNT_TEAM_CAPACITY: '7',
      },
      [],
    ),
    /exceeds starting capacity/,
  );
});

test('production requires explicit real starts and a complete Clue 1 matrix', () => {
  assert.throws(
    () => readSeedConfig(
      {
        NODE_ENV: 'production',
        CAMPUS_HUNT_START_COUNT: '2',
        CAMPUS_HUNT_START_CAPACITY: '5',
      },
      [],
    ),
    /explicit CAMPUS_HUNT_STARTING_LOCATIONS/,
  );

  const locations = [
    { code: 'NORTH', name: 'North Gate' },
    { code: 'SOUTH', name: 'South Gate' },
  ];
  assert.throws(
    () => readSeedConfig(
      {
        NODE_ENV: 'production',
        CAMPUS_HUNT_START_COUNT: '2',
        CAMPUS_HUNT_START_CAPACITY: '5',
        CAMPUS_HUNT_STARTING_LOCATIONS: JSON.stringify(locations),
        CAMPUS_HUNT_CLUE1_VARIANTS: '[]',
      },
      [],
    ),
    /8 explicit Clue 1 variants/,
  );
});

test('production Clue 1 definitions require a linked real checkpoint', () => {
  const config = {
    production: true,
    clue1Variants: [{
      startingPointCode: 'NORTH',
      routeKey: 'A',
      prompt: 'Find the archive',
      answer: 'library',
      destinationInstruction: 'Proceed to the library desk',
      firstCheckpoint: { code: 'LIB-A' },
    }],
  };

  assert.throws(
    () => clue1Definition(config, { code: 'NORTH' }, 'A'),
    /Incomplete Clue 1 variant/,
  );
});
