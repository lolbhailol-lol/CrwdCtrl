const mongoose = require('mongoose');
const Competition = require('../model/competition_model');
const {
  RELATED_COMPETITIONS_LIMIT,
  scoreSimilarCompetition,
  toSlimRelatedCompetition,
} = require('./competitionSimilarity');

/**
 * Same-fest similar competitions: topic + module + type ranking.
 * Returns at most `limit` slim cards (default 2) — best matches only.
 */
async function resolveRelatedCompetitions(competition, { limit = RELATED_COMPETITIONS_LIMIT } = {}) {
  if (!competition?._id || !competition.fest) return [];

  const festId = competition.fest._id || competition.fest;
  if (!mongoose.Types.ObjectId.isValid(festId)) return [];

  const selfId = String(competition._id);
  const siblings = await Competition.find({
    fest: festId,
    _id: { $ne: competition._id },
    isApproved: { $ne: false },
  })
    .select('name slug coverImage module competitionType category registrationFee feeAmount feeTiers subtitle')
    .lean();

  if (!siblings.length) return [];

  const seed = {
    name: competition.name,
    title: competition.name,
    module: competition.module,
    competitionType: competition.competitionType,
    category: competition.category,
    subtitle: competition.subtitle,
  };

  const ranked = siblings
    .map((c) => ({ c, score: scoreSimilarCompetition(c, seed) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.c.name || '').localeCompare(String(b.c.name || ''));
    })
    .slice(0, limit)
    .map(({ c }) => toSlimRelatedCompetition(c));

  return ranked.filter((c) => String(c._id) !== selfId);
}

module.exports = {
  RELATED_COMPETITIONS_LIMIT,
  resolveRelatedCompetitions,
  scoreSimilarCompetition,
  toSlimRelatedCompetition,
};
