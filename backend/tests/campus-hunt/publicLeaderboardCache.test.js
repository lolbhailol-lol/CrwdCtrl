const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPublicLeaderboardSnapshot,
  clearPublicLeaderboardCache,
} = require('../../src/modules/campus-hunt/services/publicLeaderboardCache');

test.afterEach(() => clearPublicLeaderboardCache());

test('150 simultaneous leaderboard viewers share one database load', async () => {
  let loads = 0;
  const loader = async () => {
    loads += 1;
    await new Promise((resolve) => setImmediate(resolve));
    return { leaderboard: [{ rank: 1, teamCode: 'CC01' }] };
  };

  const results = await Promise.all(
    Array.from({ length: 150 }, () => getPublicLeaderboardSnapshot('event-1', loader)),
  );

  assert.equal(loads, 1);
  assert.equal(results.length, 150);
  assert.deepEqual(results[149], results[0]);
});

test('leaderboard snapshot refreshes after its short live TTL', async () => {
  let nowMs = 1000;
  let loads = 0;
  const loader = async () => ({ version: ++loads });
  const options = { ttlMs: 3000, now: () => nowMs };

  assert.deepEqual(await getPublicLeaderboardSnapshot('event-2', loader, options), { version: 1 });
  nowMs = 3999;
  assert.deepEqual(await getPublicLeaderboardSnapshot('event-2', loader, options), { version: 1 });
  nowMs = 4001;
  assert.deepEqual(await getPublicLeaderboardSnapshot('event-2', loader, options), { version: 2 });
  assert.equal(loads, 2);
});

test('failed loads are not cached and the next request can recover', async () => {
  let loads = 0;
  const loader = async () => {
    loads += 1;
    if (loads === 1) throw new Error('temporary database error');
    return { leaderboard: [] };
  };

  await assert.rejects(
    getPublicLeaderboardSnapshot('event-3', loader),
    /temporary database error/,
  );
  assert.deepEqual(await getPublicLeaderboardSnapshot('event-3', loader), { leaderboard: [] });
  assert.equal(loads, 2);
});
