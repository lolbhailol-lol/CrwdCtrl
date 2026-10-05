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

test('clue5 time bands: 30 / 15 / 5', () => {
  const bands = DEFAULT_SCORING_CONFIG.clue5.speedBonusBands;
  assert.equal(speedBonusFromBands(45, bands), 30);
  assert.equal(speedBonusFromBands(90, bands), 30);
  assert.equal(speedBonusFromBands(120, bands), 15);
  assert.equal(speedBonusFromBands(150, bands), 15);
  assert.equal(speedBonusFromBands(200, bands), 5);
  assert.equal(speedBonusFromBands(240, bands), 5);
  assert.equal(speedBonusFromBands(241, bands), 0);
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

test('computeChallengeAward clue2 is flat 50 (no timer)', () => {
  const award = computeChallengeAward({
    challengeNumber: 2,
    basePoints: DEFAULT_SCORING_CONFIG.clue2.basePoints,
    awardMode: 'flat_base',
  });
  assert.equal(award.total, 50);
  assert.equal(award.late, false);
  assert.equal(award.speedBonus, 0);
});

test('computeChallengeAward clue3 is flat 65', () => {
  const award = computeChallengeAward({
    challengeNumber: 3,
    basePoints: DEFAULT_SCORING_CONFIG.clue3.basePoints,
    awardMode: 'flat_base',
  });
  assert.equal(award.total, 65);
  assert.equal(award.speedBonus, 0);
});

test('computeChallengeAward clue4 is flat 50 (Field Terminal / Zip)', () => {
  const award = computeChallengeAward({
    challengeNumber: 4,
    basePoints: DEFAULT_SCORING_CONFIG.clue4.basePoints,
    awardMode: 'flat_base',
  });
  assert.equal(award.total, 50);
  assert.equal(award.speedBonus, 0);
});

test('computeChallengeAward clue5 base + speed', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const submittedAt = new Date('2026-01-01T10:01:00Z');
  const award = computeChallengeAward({
    challengeNumber: 5,
    basePoints: DEFAULT_SCORING_CONFIG.clue5.basePoints,
    awardMode: 'base_plus_speed',
    timerSeconds: 240,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue5.speedBonusBands,
    startedAt,
    submittedAt,
  });
  assert.equal(award.total, 75);
  assert.equal(award.basePoints, 45);
  assert.equal(award.speedBonus, 30);
});

test('computeChallengeAward clue5 late is 0', () => {
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const late = new Date('2026-01-01T10:05:00Z');
  const award = computeChallengeAward({
    challengeNumber: 5,
    basePoints: DEFAULT_SCORING_CONFIG.clue5.basePoints,
    awardMode: 'base_plus_speed',
    timerSeconds: 240,
    allowLateSubmit: true,
    speedBonusBands: DEFAULT_SCORING_CONFIG.clue5.speedBonusBands,
    startedAt,
    submittedAt: late,
  });
  assert.equal(award.total, 0);
  assert.equal(award.late, true);
});

test('hint deduction floors at 0', () => {
  assert.equal(applyHintDeduction(100, 20), 80);
  assert.equal(applyHintDeduction(10, 20), 0);
});

test('applyAward adds points', () => {
  assert.equal(applyAward(100, 50), 150);
});

test('theoreticalMaxScore is 420 (100+50+50+65+50+75+30)', () => {
  assert.equal(theoreticalMaxScore(DEFAULT_SCORING_CONFIG), 420);
});

test('scoringForChallenge forces Clue 2 flat / no timer', () => {
  const { scoringForChallenge } = require('../../src/modules/campus-hunt/services/challengeService');
  const event = {
    scoringConfig: {
      clue2: {
        timerSeconds: 240,
        timerStartDelaySeconds: 10,
        awardMode: 'time_bands_total',
        allowLateSubmit: true,
        speedBonusBands: [{ maxSeconds: 30, bonus: 50 }],
      },
    },
  };
  const scoring = scoringForChallenge(event, 2);
  assert.equal(scoring.timerSeconds, 0);
  assert.equal(scoring.timerStartDelaySeconds, 0);
  assert.equal(scoring.awardMode, 'flat_base');
  assert.deepEqual(scoring.speedBonusBands, []);
  assert.equal(scoring.basePoints, 50);
});

test('scoringForChallenge falls back to Clue 2 defaults when custom missing', () => {
  const { scoringForChallenge } = require('../../src/modules/campus-hunt/services/challengeService');
  const scoring = scoringForChallenge({ scoringConfig: {} }, 2);
  assert.equal(scoring.timerSeconds, DEFAULT_SCORING_CONFIG.clue2.timerSeconds);
  assert.equal(scoring.timerStartDelaySeconds, DEFAULT_SCORING_CONFIG.clue2.timerStartDelaySeconds);
  assert.equal(scoring.awardMode, DEFAULT_SCORING_CONFIG.clue2.awardMode);
});
