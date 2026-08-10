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
  assert.equal(speedBonusFromBands(150, bands), 10);
  assert.equal(speedBonusFromBands(180, bands), 10);
  assert.equal(speedBonusFromBands(181, bands), 0);
});

test('computeChallengeAward clue1 flat 50 from scoring config', () => {
  const award = computeChallengeAward({
    challengeNumber: 1,
    basePoints: DEFAULT_SCORING_CONFIG.clue1.basePoints,
    awardMode: 'flat_base',
    attemptNumber: 1,
  });
  assert.equal(award.total, 50);
  assert.equal(award.late, false);
});

test('stored challenge basePoints 0 must not win over flat scoring 50', () => {
  // Mimic award resolution used in challengeService
  const scoring = DEFAULT_SCORING_CONFIG.clue1;
  const challengeBase = 0;
  const awardBase = (
    scoring.awardMode === 'flat_base'
  )
    ? (Number(scoring.basePoints) || Number(challengeBase) || 0)
    : (Number(challengeBase) || Number(scoring.basePoints) || 0);
  assert.equal(awardBase, 50);
  assert.equal(
    computeChallengeAward({
      challengeNumber: 1,
      basePoints: awardBase,
      awardMode: 'flat_base',
    }).total,
    50,
  );
});

test('computeChallengeAward clue2 uses time-band totals', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const inOneMin = new Date('2026-01-01T10:00:50Z');
  const award = computeChallengeAward({
    challengeNumber: 2,
    basePoints: 0,
    awardMode: 'time_bands_total',
    timerSeconds: 180,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue2.speedBonusBands,
    startedAt,
    submittedAt: inOneMin,
  });
  assert.equal(award.total, 50);
  assert.equal(award.late, false);
});

test('computeChallengeAward clue2 late after 3 min is 0', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const late = new Date('2026-01-01T10:03:01Z');
  const award = computeChallengeAward({
    challengeNumber: 2,
    awardMode: 'time_bands_total',
    timerSeconds: 180,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue2.speedBonusBands,
    startedAt,
    submittedAt: late,
  });
  assert.equal(award.total, 0);
  assert.equal(award.late, true);
});

test('computeChallengeAward clue3 is flat 50', () => {
  const award = computeChallengeAward({
    challengeNumber: 3,
    basePoints: 50,
    awardMode: 'flat_base',
  });
  assert.equal(award.total, 50);
  assert.equal(award.speedBonus, 0);
});

test('computeChallengeAward clue4 base + speed', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const submittedAt = new Date('2026-01-01T10:02:00Z');
  const award = computeChallengeAward({
    challengeNumber: 4,
    basePoints: 50,
    awardMode: 'base_plus_speed',
    timerSeconds: 300,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue4.speedBonusBands,
    startedAt,
    submittedAt,
  });
  assert.equal(award.total, 75);
  assert.equal(award.basePoints, 50);
  assert.equal(award.speedBonus, 25);
});

test('computeChallengeAward clue4 late is 0', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const late = new Date('2026-01-01T10:06:00Z');
  const award = computeChallengeAward({
    challengeNumber: 4,
    basePoints: 50,
    awardMode: 'base_plus_speed',
    timerSeconds: 300,
    allowLateSubmit: true,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue4.speedBonusBands,
    startedAt,
    submittedAt: late,
  });
  assert.equal(award.total, 0);
  assert.equal(award.late, true);
});

test('hint deduction floors at 0', () => {
  assert.equal(applyHintDeduction(100, 15), 85);
  assert.equal(applyHintDeduction(10, 15), 0);
});

test('applyAward adds points', () => {
  assert.equal(applyAward(100, 50), 150);
});

test('theoreticalMaxScore is 325 (100+50+50+50+75)', () => {
  assert.equal(theoreticalMaxScore(DEFAULT_SCORING_CONFIG), 325);
});
