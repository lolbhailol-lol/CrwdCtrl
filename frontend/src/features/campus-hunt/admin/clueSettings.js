export const CLUE1_DEFAULT_SETTINGS = {
  maxAttempts: 3,
  hintCost: 15,
  basePoints: 50,
};

export const CLUE2_DEFAULT_SETTINGS = {
  timerStartDelaySeconds: 20,
  timerSeconds: 180,
  maxAttempts: 3,
  hintCost: 15,
  allowLateSubmit: true,
  awardMode: 'time_bands_total',
  basePoints: 0,
  speedBonusBands: [
    { maxSeconds: 60, bonus: 50 },
    { maxSeconds: 120, bonus: 30 },
    { maxSeconds: 180, bonus: 10 },
  ],
};

export const CLUE3_DEFAULT_SETTINGS = {
  maxAttempts: 3,
  hintCost: 15,
  basePoints: 50,
};

export const CLUE4_DEFAULT_SETTINGS = {
  timerStartDelaySeconds: 15,
  timerSeconds: 180,
  maxAttempts: 3,
  hintCost: 15,
  allowLateSubmit: true,
  basePoints: 0,
  speedBonusBands: [
    { maxSeconds: 60, bonus: 50 },
    { maxSeconds: 120, bonus: 30 },
    { maxSeconds: 180, bonus: 10 },
  ],
};

export const CLUE5_DEFAULT_SETTINGS = {
  timerSeconds: 300,
  maxAttempts: 3,
  hintCost: 15,
  basePoints: 50,
  allowLateSubmit: true,
  speedBonusBands: [
    { maxSeconds: 120, bonus: 25 },
    { maxSeconds: 210, bonus: 15 },
    { maxSeconds: 300, bonus: 5 },
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
    out.timerStartDelaySeconds = Number(merged.timerStartDelaySeconds) ?? defaults.timerStartDelaySeconds ?? 0;
  }
  if (merged.basePoints != null) {
    out.basePoints = Number(merged.basePoints) ?? defaults.basePoints ?? 0;
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
