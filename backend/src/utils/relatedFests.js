const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const { scoreSimilarCompetition } = require('./competitionSimilarity');

const RELATED_FESTS_LIMIT = 6;
const SAMPLE_COMPETITIONS_PER_FEST = 2;

/** Public-visible statuses for related-fest discovery */
const PUBLIC_RELATED_STATUSES = ['ongoing', 'upcoming', 'beyondcampus'];

/**
 * Normalize admin-submitted relatedFestIds: valid ObjectIds, unique, exclude self.
 */
function normalizeRelatedFestIds(raw, selfId = null) {
  if (!Array.isArray(raw)) return [];
  const self = selfId ? String(selfId) : null;
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const id = item && typeof item === 'object' && item._id ? item._id : item;
    if (!mongoose.Types.ObjectId.isValid(id)) continue;
    const key = String(id);
    if (self && key === self) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(new mongoose.Types.ObjectId(key));
  }
  return out;
}

function toSlimRelatedFest(fest, sampleCompetitions = []) {
  const mode = String(fest?.registration?.mode || '').trim();
  return {
    _id: fest._id,
    festName: fest.festName || '',
    collegeName: fest.collegeName || '',
    coverImage: fest.coverImage || '',
    slug: fest.slug || '',
    festType: fest.festType || '',
    festDate: fest.festDate || '',
    feeAmount: Number(fest.feeAmount) || 0,
    // Needed so Explore → competition detail doesn't flash "Registration Not Open Yet"
    registration: mode
      ? {
          mode,
          externalLink: String(fest?.registration?.externalLink || '').trim(),
        }
      : undefined,
    sampleCompetitions: sampleCompetitions.map((c) => ({
      _id: c._id,
      name: c.name || '',
      slug: c.slug || '',
      coverImage: c.coverImage || '',
      registrationFee: c.registrationFee || '',
      feeAmount: Number(c.feeAmount) || 0,
      feeTiers: Array.isArray(c.feeTiers) ? c.feeTiers : [],
      module: c.module || '',
      competitionType: c.competitionType || '',
      registrationType: c.registrationType || 'fest',
    })),
  };
}

function pickSampleCompetitions(comps, seedCompetition, limit = SAMPLE_COMPETITIONS_PER_FEST) {
  if (!Array.isArray(comps) || comps.length === 0) return [];
  if (!seedCompetition) {
    return comps.slice(0, limit);
  }
  const seed = {
    name: seedCompetition.name || seedCompetition.title,
    title: seedCompetition.name || seedCompetition.title,
    module: seedCompetition.module,
    competitionType: seedCompetition.competitionType,
    category: seedCompetition.category,
    subtitle: seedCompetition.subtitle,
  };
  return [...comps]
    .map((c) => ({ c, score: scoreSimilarCompetition(c, seed) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.c.name || '').localeCompare(String(b.c.name || ''));
    })
    .slice(0, limit)
    .map(({ c }) => c);
}

/**
 * Resolve pinned related fests first, then fill with same festType.
 * When seedCompetition is set (competition detail), sample comps are best topic matches.
 */
async function resolveRelatedFests(fest, { limit = RELATED_FESTS_LIMIT, seedCompetition = null } = {}) {
  if (!fest?._id || !fest.festType) return [];

  const selfId = String(fest._id);
  const pinnedIds = normalizeRelatedFestIds(fest.relatedFestIds, fest._id);
  const result = [];
  const used = new Set([selfId]);

  const publicFilter = {
    isApproved: true,
    status: { $in: PUBLIC_RELATED_STATUSES },
  };

  if (pinnedIds.length > 0) {
    const pinned = await FestOrganizer.find({
      ...publicFilter,
      _id: { $in: pinnedIds },
    })
      .select('festName collegeName coverImage slug festType festDate priority feeAmount registration.mode registration.externalLink')
      .lean();

    const byId = new Map(pinned.map((f) => [String(f._id), f]));
    for (const id of pinnedIds) {
      if (result.length >= limit) break;
      const row = byId.get(String(id));
      if (!row) continue;
      const key = String(row._id);
      if (used.has(key)) continue;
      used.add(key);
      result.push(row);
    }
  }

  if (result.length < limit) {
    const fillers = await FestOrganizer.find({
      ...publicFilter,
      festType: fest.festType,
      _id: { $nin: [...used].map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select('festName collegeName coverImage slug festType festDate priority feeAmount registration.mode registration.externalLink')
      .sort({ priority: 1, createdAt: -1 })
      .limit(limit - result.length)
      .lean();

    for (const row of fillers) {
      const key = String(row._id);
      if (used.has(key)) continue;
      used.add(key);
      result.push(row);
    }
  }

  if (result.length === 0) return [];

  const festIds = result.map((f) => f._id);
  const comps = await Competition.find({
    fest: { $in: festIds },
    isApproved: { $ne: false },
  })
    .select('name slug fest coverImage registrationFee feeAmount feeTiers module competitionType category subtitle registrationType')
    .lean();

  const compsByFest = new Map();
  for (const comp of comps) {
    const key = String(comp.fest);
    if (!compsByFest.has(key)) compsByFest.set(key, []);
    compsByFest.get(key).push(comp);
  }

  return result.map((f) =>
    toSlimRelatedFest(
      f,
      pickSampleCompetitions(compsByFest.get(String(f._id)) || [], seedCompetition),
    ),
  );
}

module.exports = {
  RELATED_FESTS_LIMIT,
  SAMPLE_COMPETITIONS_PER_FEST,
  PUBLIC_RELATED_STATUSES,
  normalizeRelatedFestIds,
  resolveRelatedFests,
  pickSampleCompetitions,
};
