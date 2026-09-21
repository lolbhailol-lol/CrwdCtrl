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
    basePoints: 50,
    maxAttempts: 3,
    timerSeconds: 0,
    timerStartDelaySeconds: 0,
    awardMode: 'flat_base',
    revealOnMaxAttempts: true,
    hintCost: 20,
    speedBonusBands: [],
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
    timerSeconds: 0,
    awardMode: 'flat_base',
    allowLateSubmit: true,
    revealOnMaxAttempts: true,
    hintCost: 30,
    speedBonusBands: [],
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
  if ([2, 3, 4, 5].includes(Number(challengeNumber))) {
    merged.timerSeconds = 0;
    merged.timerStartDelaySeconds = 0;
    merged.awardMode = 'flat_base';
    merged.speedBonusBands = [];
    if (Number(challengeNumber) === 2 || Number(challengeNumber) === 4) {
      merged.basePoints = Number(merged.basePoints) > 0 ? Number(merged.basePoints) : 50;
    }
    if (Number(challengeNumber) === 3) {
      merged.basePoints = Number(merged.basePoints) > 0 ? Number(merged.basePoints) : 65;
    }
    if (Number(challengeNumber) === 4 || Number(challengeNumber) === 5) {
      merged.allowLateSubmit = true;
    }
    if (Number(challengeNumber) === 5) {
      merged.basePoints = Number(merged.basePoints) > 0 ? Number(merged.basePoints) : 45;
    }
  }
  const hint = Number(merged.hintCost ?? cfg.hintCost ?? defaults.hintCost);
  merged.hintCost = Number.isFinite(hint) && hint >= 0 ? hint : 20;
  return merged;
}

export function normalizeAnswer(value) {
  if (value == null) return '';
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeDigits(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

export function normalizeLetters(value) {
  return String(value == null ? '' : value).replace(/[^A-Za-z]/g, '').toUpperCase();
}

export function answersMatch(submitted, expected) {
  const a = normalizeAnswer(submitted);
  const b = normalizeAnswer(expected);
  return a.length > 0 && a === b;
}

/** Clue-aware match: digits for 2, letters for 5, flexible for lockbox/others. */
export function answersMatchForClue(challengeNumber, submitted, expected) {
  const n = Number(challengeNumber);
  if (n === 2) {
    const a = normalizeDigits(submitted);
    const b = normalizeDigits(expected);
    return a.length >= 3 && a === b;
  }
  if (n === 5) {
    const a = normalizeLetters(submitted);
    const b = normalizeLetters(expected);
    return a.length >= 3 && a === b;
  }
  if (n === 3) {
    const aDigits = normalizeDigits(submitted);
    const bDigits = normalizeDigits(expected);
    if (aDigits.length >= 3 && bDigits.length >= 3) return aDigits === bDigits;
  }
  return answersMatch(submitted, expected);
}

export function matchesAnyAccepted(submitted, acceptedAnswers = [], challengeNumber = null) {
  if (challengeNumber != null) {
    return (acceptedAnswers || []).some((expected) => (
      answersMatchForClue(challengeNumber, submitted, expected)
    ));
  }
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
    || (n === 1 || n === 2 || n === 3 || n === 4 || n === 6
      ? 'flat_base'
      : 'base_plus_speed');

  if (mode === 'flat_base' || n === 1 || n === 2 || n === 3 || n === 4 || n === 6) {
    const total = Number(basePoints) || 0;
    return { basePoints: total, speedBonus: 0, total, late: false };
  }

  const elapsed = elapsedSecondsBetween(startedAt, submittedAt);

  if (mode === 'time_bands_total') {
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
