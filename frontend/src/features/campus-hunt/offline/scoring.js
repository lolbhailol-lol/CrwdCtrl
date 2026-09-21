/** Client-side scoring for offline hunt — mirrors backend scoringService. */

export const DEFAULT_SCORING_CONFIG = {
  startingScore: 100,
  hintCost: 20,
  clue1: {
    basePoints: 50,
    maxAttempts: 3,
    timerSeconds: 0,
    awardMode: 'flat_base',
    revealOnMaxAttempts: true,
    hintCost: 15,
    attemptBands: [
      { attempt: 1, points: 50 },
      { attempt: 2, points: 50 },
      { attempt: 3, points: 50 },
    ],
  },
  clue2: {
    basePoints: 0,
    maxAttempts: 3,
    timerSeconds: 180,
    timerStartDelaySeconds: 20,
    awardMode: 'time_bands_total',
    allowLateSubmit: true,
    revealOnMaxAttempts: true,
    hintCost: 20,
    speedBonusBands: [
      { maxSeconds: 60, bonus: 55 },
      { maxSeconds: 120, bonus: 35 },
      { maxSeconds: 180, bonus: 15 },
    ],
  },
  clue3: {
    basePoints: 65,
    maxAttempts: 2,
    timerSeconds: 0,
    awardMode: 'flat_base',
    revealOnMaxAttempts: true,
    hintCost: 25,
    speedBonusBands: [],
  },
  clue4: {
    basePoints: 50,
    maxAttempts: 3,
    timerSeconds: 0,
    timerStartDelaySeconds: 0,
    awardMode: 'flat_base',
    allowLateSubmit: true,
    hintCost: 20,
    speedBonusBands: [],
  },
  clue5: {
    basePoints: 45,
    maxAttempts: 2,
    timerSeconds: 240,
    awardMode: 'base_plus_speed',
    allowLateSubmit: true,
    revealOnMaxAttempts: true,
    hintCost: 30,
    speedBonusBands: [
      { maxSeconds: 90, bonus: 30 },
      { maxSeconds: 150, bonus: 15 },
      { maxSeconds: 240, bonus: 5 },
    ],
  },
  clue6: {
    basePoints: 30,
    maxAttempts: 3,
    timerSeconds: 0,
    awardMode: 'flat_base',
    hintCost: 15,
    speedBonusBands: [],
  },
};

export function scoringForChallenge(event, challengeNumber) {
  const defaults = DEFAULT_SCORING_CONFIG[`clue${challengeNumber}`] || {
    basePoints: 0,
    maxAttempts: 3,
    timerSeconds: 0,
    speedBonusBands: [],
  };
  const cfg = event?.scoringConfig || DEFAULT_SCORING_CONFIG;
  const custom = cfg[`clue${challengeNumber}`] || {};
  const merged = { ...defaults, ...custom };
  if (Number(challengeNumber) === 4) {
    merged.timerSeconds = 0;
    merged.timerStartDelaySeconds = 0;
    merged.awardMode = 'flat_base';
    merged.basePoints = Number(merged.basePoints) > 0 ? Number(merged.basePoints) : 50;
    merged.allowLateSubmit = true;
    merged.speedBonusBands = [];
  }
  if (Number(challengeNumber) === 2) {
    const timer = Number(merged.timerSeconds);
    merged.timerSeconds = Number.isFinite(timer) && timer > 0
      ? timer
      : (Number(defaults.timerSeconds) || 180);
    const delay = Number(merged.timerStartDelaySeconds);
    merged.timerStartDelaySeconds = Number.isFinite(delay) && delay >= 0
      ? delay
      : (Number(defaults.timerStartDelaySeconds) || 20);
    merged.awardMode = merged.awardMode || defaults.awardMode || 'time_bands_total';
    merged.allowLateSubmit = merged.allowLateSubmit !== false;
    merged.speedBonusBands = Array.isArray(merged.speedBonusBands) && merged.speedBonusBands.length
      ? merged.speedBonusBands
      : (defaults.speedBonusBands || []);
  }
  if (Number(challengeNumber) === 5) {
    const timer = Number(merged.timerSeconds);
    merged.timerSeconds = Number.isFinite(timer) && timer > 0
      ? timer
      : (Number(defaults.timerSeconds) || 240);
    merged.awardMode = merged.awardMode || defaults.awardMode || 'base_plus_speed';
    merged.allowLateSubmit = merged.allowLateSubmit !== false;
    merged.speedBonusBands = Array.isArray(merged.speedBonusBands) && merged.speedBonusBands.length
      ? merged.speedBonusBands
      : (defaults.speedBonusBands || []);
  }
  const hint = Number(merged.hintCost ?? cfg.hintCost ?? defaults.hintCost);
  merged.hintCost = Number.isFinite(hint) && hint >= 0 ? hint : 20;
  return merged;
}

export function normalizeAnswer(value) {
  if (value == null) return '';
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function answersMatch(submitted, expected) {
  const a = normalizeAnswer(submitted);
  const b = normalizeAnswer(expected);
  return a.length > 0 && a === b;
}

export function matchesAnyAccepted(submitted, acceptedAnswers = []) {
  return (acceptedAnswers || []).some((expected) => answersMatch(submitted, expected));
}

function speedBonusFromBands(elapsedSeconds, bands = []) {
  if (!Array.isArray(bands) || bands.length === 0) return 0;
  const elapsed = Number(elapsedSeconds);
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  const sorted = [...bands].sort((a, b) => a.maxSeconds - b.maxSeconds);
  for (const band of sorted) {
    if (elapsed <= band.maxSeconds) return Number(band.bonus) || 0;
  }
  return 0;
}

function elapsedSecondsBetween(startedAt, submittedAt) {
  if (!startedAt || !submittedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(submittedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

export function computeChallengeAward({
  challengeNumber,
  basePoints = 0,
  speedBonusBands = [],
  startedAt,
  submittedAt,
  awardMode,
  timerSeconds,
  allowLateSubmit = false,
}) {
  const n = Number(challengeNumber);
  const mode = awardMode
    || (n === 1 || n === 3 || n === 4 || n === 6
      ? 'flat_base'
      : n === 2
        ? 'time_bands_total'
        : 'base_plus_speed');

  if (mode === 'flat_base' || n === 1 || n === 3 || n === 4 || n === 6) {
    const total = Number(basePoints) || 0;
    return { basePoints: total, speedBonus: 0, total, late: false };
  }

  const elapsed = elapsedSecondsBetween(startedAt, submittedAt);

  if (n === 2 || mode === 'time_bands_total') {
    const limit = Number(timerSeconds) || 180;
    if (elapsed == null || elapsed > limit) {
      return { basePoints: 0, speedBonus: 0, total: 0, late: true, elapsedSeconds: elapsed };
    }
    const award = speedBonusFromBands(elapsed, speedBonusBands);
    return { basePoints: 0, speedBonus: award, total: award, late: false, elapsedSeconds: elapsed };
  }

  const base = Number(basePoints) || 0;
  const limit = Number(timerSeconds) || 0;
  if (limit > 0 && (elapsed == null || elapsed > limit)) {
    return {
      basePoints: 0,
      speedBonus: 0,
      total: 0,
      late: true,
      elapsedSeconds: elapsed,
      allowLateSubmit: Boolean(allowLateSubmit),
    };
  }

  const speedBonus = elapsed != null ? speedBonusFromBands(elapsed, speedBonusBands) : 0;
  return {
    basePoints: base,
    speedBonus,
    total: base + speedBonus,
    late: false,
    elapsedSeconds: elapsed,
  };
}
