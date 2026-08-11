const test = require('node:test');
const assert = require('node:assert/strict');

const {
  pickTwoLocations,
  buildCombinedAnswer,
  getLocationPool,
} = require('../../../src/modules/campus-hunt/services/finale/intelLocationService');
const { DEFAULT_INTEL_LOCATION_POOL } = require('../../../src/modules/campus-hunt/constants');

test('location pool defaults to 12 pilot locations', () => {
  const pool = getLocationPool({});
  assert.equal(pool.length, 12);
});

test('pickTwoLocations prefers least-used locations', () => {
  const pool = DEFAULT_INTEL_LOCATION_POOL.slice(0, 4);
  const usage = new Map([[pool[0].id, 2], [pool[1].id, 2]]);
  const [a, b] = pickTwoLocations(pool, usage);
  assert.notEqual(a.id, b.id);
  assert.ok([a.id, b.id].every((id) => id === pool[2].id || id === pool[3].id));
});

test('combined answer concatenates fragments', () => {
  assert.equal(
    buildCombinedAnswer(
      { fragment: 'ARC' },
      { fragment: 'ADE' },
    ),
    'ARCADE',
  );
});
