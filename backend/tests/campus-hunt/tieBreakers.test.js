const test = require('node:test');
const assert = require('node:assert/strict');

const { compareTeamsForLeaderboard, rankTeams } = require('../../src/modules/campus-hunt/utils/tieBreakers');
const { normalizeAnswer, matchesAnyAccepted } = require('../../src/modules/campus-hunt/utils/answerNormalize');
const { isExpired, buildChallengeWindow } = require('../../src/modules/campus-hunt/services/timerService');

test('higher score ranks first', () => {
  const a = { currentScore: 200, teamCode: 'CC001', stats: {} };
  const b = { currentScore: 300, teamCode: 'CC002', stats: {} };
  assert.ok(compareTeamsForLeaderboard(a, b) > 0);
});

test('tie breakers: time then hints then fails', () => {
  const base = { currentScore: 200, stats: { totalCompletionMs: 1000, hintsUsed: 1, failedAttempts: 2 } };
  const faster = { ...base, teamCode: 'A', stats: { ...base.stats, totalCompletionMs: 500 } };
  const fewerHints = { ...base, teamCode: 'B', stats: { ...base.stats, hintsUsed: 0 } };
  assert.ok(compareTeamsForLeaderboard(faster, base) < 0);
  assert.ok(compareTeamsForLeaderboard(fewerHints, base) < 0);

  const ranked = rankTeams([base, faster, fewerHints]);
  assert.equal(ranked[0].team.teamCode, 'A');
  assert.equal(ranked[0].qualification, 'DIRECT_FINALE');
});

test('top 5 qualify for finale', () => {
  const teams = Array.from({ length: 10 }, (_, i) => ({
    currentScore: 100 - i,
    teamCode: `CC${String(i + 1).padStart(3, '0')}`,
    stats: {},
  }));
  const ranked = rankTeams(teams);
  assert.equal(ranked[4].qualification, 'DIRECT_FINALE');
  assert.equal(ranked[5].qualification, 'SURVIVAL_STAGE');
});

test('qualification.topNDirectFinale overrides default', () => {
  const teams = Array.from({ length: 10 }, (_, i) => ({
    currentScore: 100 - i,
    teamCode: `CC${String(i + 1).padStart(3, '0')}`,
    stats: {},
  }));
  const ranked = rankTeams(teams, { topNDirectFinale: 3 });
  assert.equal(ranked[2].qualification, 'DIRECT_FINALE');
  assert.equal(ranked[3].qualification, 'SURVIVAL_STAGE');
});

test('answer normalize and match', () => {
  assert.equal(normalizeAnswer('  Hello  '), 'hello');
  assert.equal(matchesAnyAccepted('Library', ['library', 'the library']), true);
  assert.equal(matchesAnyAccepted('482', ['719']), false);
});

test('timer expiry is server-side', () => {
  const { startedAt, expiresAt } = buildChallengeWindow(180, new Date('2026-01-01T10:00:00Z'));
  assert.ok(startedAt);
  assert.equal(expiresAt.toISOString(), '2026-01-01T10:03:00.000Z');
  assert.equal(isExpired(expiresAt, new Date('2026-01-01T10:02:59Z')), false);
  assert.equal(isExpired(expiresAt, new Date('2026-01-01T10:03:00Z')), true);
});
