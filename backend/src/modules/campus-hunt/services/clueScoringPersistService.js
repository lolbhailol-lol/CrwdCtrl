/**
 * Persist clue timer / hint / attempt settings on the event and sync to challenge docs.
 */

const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const { DEFAULT_SCORING_CONFIG } = require('../constants');

function clueKey(clueNumber) {
  return `clue${Number(clueNumber)}`;
}

function normalizeClueScoring(clueNumber, scoring = {}, event = null) {
  const n = Number(clueNumber);
  const defaults = DEFAULT_SCORING_CONFIG[clueKey(n)] || {};
  const cfg = event?.scoringConfig || {};
  const existing = cfg[clueKey(n)]?.toObject?.() || cfg[clueKey(n)] || {};
  const merged = { ...defaults, ...existing, ...scoring };

  const hintCostRaw = scoring.hintCost ?? merged.hintCost ?? cfg.hintCost;
  const hintCost = Number.isFinite(Number(hintCostRaw)) && Number(hintCostRaw) >= 0
    ? Number(hintCostRaw)
    : (Number(DEFAULT_SCORING_CONFIG.hintCost) || 15);

  const normalized = {
    ...merged,
    maxAttempts: Math.max(1, Number(merged.maxAttempts) || 3),
    hintCost,
  };

  if (n === 1) {
    normalized.basePoints = Number(merged.basePoints) || 50;
    normalized.awardMode = merged.awardMode || 'flat_base';
    normalized.revealOnMaxAttempts = merged.revealOnMaxAttempts !== false;
    normalized.attemptBands = Array.isArray(merged.attemptBands) && merged.attemptBands.length
      ? merged.attemptBands
      : (defaults.attemptBands || []);
  }

  if (n === 2) {
    normalized.basePoints = Number(merged.basePoints) || 50;
    normalized.awardMode = 'flat_base';
    normalized.timerSeconds = 0;
    normalized.timerStartDelaySeconds = 0;
    normalized.revealOnMaxAttempts = merged.revealOnMaxAttempts !== false;
    normalized.speedBonusBands = [];
  }

  if (n === 4) {
    normalized.basePoints = Number(merged.basePoints) > 0 ? Number(merged.basePoints) : 50;
    normalized.awardMode = 'flat_base';
    normalized.allowLateSubmit = merged.allowLateSubmit !== false;
    normalized.timerSeconds = 0;
    normalized.timerStartDelaySeconds = 0;
    normalized.speedBonusBands = [];
  }

  if (n === 3) {
    normalized.basePoints = Number(merged.basePoints) || 65;
    normalized.awardMode = merged.awardMode || 'flat_base';
  }

  if (n === 5) {
    normalized.basePoints = Number(merged.basePoints) || 50;
    normalized.awardMode = merged.awardMode || 'base_plus_speed';
    normalized.allowLateSubmit = merged.allowLateSubmit !== false;
    normalized.timerSeconds = Math.max(1, Number(merged.timerSeconds) || 300);
    normalized.speedBonusBands = (
      Array.isArray(merged.speedBonusBands) && merged.speedBonusBands.length
        ? merged.speedBonusBands
        : (defaults.speedBonusBands || [])
    );
  }

  return normalized;
}

async function persistClueScoring({ eventId, clueNumber, scoring = {} }) {
  const event = await CampusHuntEvent.findById(eventId);
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }

  const normalized = normalizeClueScoring(clueNumber, scoring, event);
  if (!event.scoringConfig) {
    event.scoringConfig = { ...DEFAULT_SCORING_CONFIG };
  }
  event.scoringConfig[clueKey(clueNumber)] = normalized;
  event.scoringConfig.hintCost = normalized.hintCost;
  event.markModified('scoringConfig');
  await event.save();

  return { event, scoring: normalized };
}

async function syncChallengeScoring({ eventId, clueNumber, scoring, roundId }) {
  const n = Number(clueNumber);
  const normalized = scoring || {};
  const $set = {
    maxAttempts: normalized.maxAttempts,
    hintCost: normalized.hintCost,
  };

  if (n === 1 || n === 2 || n === 3 || n === 5) {
    $set.basePoints = normalized.basePoints;
  }
  if (n === 2 || n === 4 || n === 5) {
    $set.timerSeconds = normalized.timerSeconds ?? 0;
  }
  if (n === 2 || n === 4 || n === 5) {
    if (Array.isArray(normalized.speedBonusBands)) {
      $set.speedBonusBands = normalized.speedBonusBands;
    }
  }

  const filter = {
    eventId,
    challengeNumber: n,
    active: true,
  };
  if (roundId) filter.roundId = roundId;
  if (n === 2 || n === 3 || n === 4) {
    filter.variantKey = { $ne: 'DEFAULT' };
  }

  const result = await CampusHuntChallenge.updateMany(filter, { $set });
  return result.modifiedCount || 0;
}

async function saveClueScoring({ eventId, roundId, clueNumber, scoring = {} }) {
  const { scoring: normalized } = await persistClueScoring({ eventId, clueNumber, scoring });
  const challengesUpdated = await syncChallengeScoring({
    eventId,
    clueNumber,
    scoring: normalized,
    roundId,
  });
  return { scoring: normalized, challengesUpdated };
}

module.exports = {
  normalizeClueScoring,
  persistClueScoring,
  syncChallengeScoring,
  saveClueScoring,
};
