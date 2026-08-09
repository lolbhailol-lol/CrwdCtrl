const test = require('node:test');
const assert = require('node:assert/strict');

const {
  speedBonusFromBands,
  computeChallengeAward,
  applyHintDeduction,
  applyAward,
  theoreticalMaxScore,
} = require('../../src/modules/campus-hunt/services/scoringService');
const { DEFAULT_SCORING_CONFIG } = require('../../src/modules/campus-hunt/constants');

test('clue2 time bands: 50 / 30 / 10', () => {
  const bands = DEFAULT_SCORING_CONFIG.clue2.speedBonusBands;
  assert.equal(speedBonusFromBands(45, bands), 50);
  assert.equal(speedBonusFromBands(60, bands), 50);
  assert.equal(speedBonusFromBands(90, bands), 30);
  assert.equal(speedBonusFromBands(120, bands), 30);
  assert.equal(speedBonusFromBands(200, bands), 10);
  assert.equal(speedBonusFromBands(300, bands), 10);
  assert.equal(speedBonusFromBands(301, bands), 0);
});

test('computeChallengeAward clue1 uses attempt bands 20 / 10 / 5', () => {
  const bands = DEFAULT_SCORING_CONFIG.clue1.attemptBands;
  assert.equal(
    computeChallengeAward({
      challengeNumber: 1,
      awardMode: 'attempt_bands',
      attemptBands: bands,
      attemptNumber: 1,
    }).total,
    20,
  );
  assert.equal(
    computeChallengeAward({
      challengeNumber: 1,
      awardMode: 'attempt_bands',
      attemptBands: bands,
      attemptNumber: 2,
    }).total,
    10,
  );
  assert.equal(
    computeChallengeAward({
      challengeNumber: 1,
      awardMode: 'attempt_bands',
      attemptBands: bands,
      attemptNumber: 3,
    }).total,
    5,
  );
});

test('computeChallengeAward clue2 uses time-band totals', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const inOneMin = new Date('2026-01-01T10:00:50Z');
  const award = computeChallengeAward({
    challengeNumber: 2,
    basePoints: 0,
    awardMode: 'time_bands_total',
    timerSeconds: 300,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue2.speedBonusBands,
    startedAt,
    submittedAt: inOneMin,
  });
  assert.equal(award.total, 50);
  assert.equal(award.late, false);
});

test('computeChallengeAward clue2 late after 5 min is 0', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const late = new Date('2026-01-01T10:05:01Z');
  const award = computeChallengeAward({
    challengeNumber: 2,
    awardMode: 'time_bands_total',
    timerSeconds: 300,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue2.speedBonusBands,
    startedAt,
    submittedAt: late,
  });
  assert.equal(award.total, 0);
  assert.equal(award.late, true);
});

test('computeChallengeAward clue3 has no speed bonus', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const submittedAt = new Date('2026-01-01T10:00:30Z');
  const award = computeChallengeAward({
    challengeNumber: 3,
    basePoints: 75,
    speedBonusBands: [{ maxSeconds: 30, bonus: 99 }],
    startedAt,
    submittedAt,
  });
  assert.equal(award.total, 75);
  assert.equal(award.speedBonus, 0);
});

test('computeChallengeAward clue4 max is 120', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const submittedAt = new Date('2026-01-01T10:02:00Z');
  const award = computeChallengeAward({
    challengeNumber: 4,
    basePoints: 100,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue4.speedBonusBands,
    startedAt,
    submittedAt,
  });
  assert.equal(award.total, 120);
});

test('hint deduction floors at 0', () => {
  assert.equal(applyHintDeduction(100, 15), 85);
  assert.equal(applyHintDeduction(10, 15), 0);
});

test('applyAward adds points', () => {
  assert.equal(applyAward(100, 50), 150);
});

test('theoreticalMaxScore is 365 with clue1 max 20 + clue2 max 50', () => {
  assert.equal(theoreticalMaxScore(DEFAULT_SCORING_CONFIG), 365);
});
