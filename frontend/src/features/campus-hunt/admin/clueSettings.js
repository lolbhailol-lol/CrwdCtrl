export const CLUE1_DEFAULT_SETTINGS = {
  maxAttempts: 3,
  hintCost: 15,
  basePoints: 50,
};

export const CLUE2_DEFAULT_SETTINGS = {
  timerStartDelaySeconds: 20,
  timerSeconds: 180,
  maxAttempts: 3,
  hintCost: 20,
  allowLateSubmit: true,
  awardMode: 'time_bands_total',
  basePoints: 0,
  speedBonusBands: [
    { maxSeconds: 60, bonus: 55 },
    { maxSeconds: 120, bonus: 35 },
    { maxSeconds: 180, bonus: 15 },
  ],
};

export const CLUE3_DEFAULT_SETTINGS = {
  maxAttempts: 2,
  hintCost: 25,
  basePoints: 65,
};

export const CLUE4_DEFAULT_SETTINGS = {
  timerStartDelaySeconds: 0,
  timerSeconds: 0,
  maxAttempts: 3,
  hintCost: 20,
  allowLateSubmit: true,
  basePoints: 50,
  speedBonusBands: [],
};

export const CLUE5_DEFAULT_SETTINGS = {
  timerSeconds: 240,
  maxAttempts: 2,
  hintCost: 30,
  basePoints: 45,
  allowLateSubmit: true,
  speedBonusBands: [
    { maxSeconds: 90, bonus: 30 },
    { maxSeconds: 150, bonus: 15 },
    { maxSeconds: 240, bonus: 5 },
  ],
};

export function loadClueSettings(scoringConfig, clueKey, defaults, sampleChallenge = null) {
  const cfg = scoringConfig || {};
  const clue = cfg[clueKey] || {};
  const sample = sampleChallenge || {};
  return {
    ...defaults,
    ...clue,
    hintCost: clue.hintCost ?? cfg.hintCost ?? sample.hintCost ?? defaults.hintCost,
    maxAttempts: clue.maxAttempts ?? sample.maxAttempts ?? defaults.maxAttempts,
    timerSeconds: clue.timerSeconds ?? sample.timerSeconds ?? defaults.timerSeconds,
    timerStartDelaySeconds:
      clue.timerStartDelaySeconds
      ?? sample.timerStartDelaySeconds
      ?? defaults.timerStartDelaySeconds,
    basePoints: clue.basePoints ?? sample.basePoints ?? defaults.basePoints,
    speedBonusBands: clue.speedBonusBands?.length
      ? clue.speedBonusBands
      : (defaults.speedBonusBands || []),
  };
}

export function coerceClueScoring(settings, defaults) {
  const merged = { ...defaults, ...settings };
  const out = {
    ...merged,
    maxAttempts: Number(merged.maxAttempts) || defaults.maxAttempts || 3,
    hintCost: Number(merged.hintCost ?? defaults.hintCost) || 15,
  };
  if (merged.timerSeconds != null) {
    out.timerSeconds = Number(merged.timerSeconds) || defaults.timerSeconds || 180;
  }
  if (merged.timerStartDelaySeconds != null) {
    const delay = Number(merged.timerStartDelaySeconds);
    out.timerStartDelaySeconds = Number.isFinite(delay) ? delay : (defaults.timerStartDelaySeconds ?? 0);
  }
  if (merged.basePoints != null) {
    const points = Number(merged.basePoints);
    out.basePoints = Number.isFinite(points) ? points : (defaults.basePoints ?? 0);
  }
  if (defaults.speedBonusBands) {
    out.speedBonusBands = merged.speedBonusBands?.length
      ? merged.speedBonusBands
      : defaults.speedBonusBands;
  }
  if (defaults.allowLateSubmit != null) {
    out.allowLateSubmit = merged.allowLateSubmit !== false;
  }
  return out;
}
