const Competition = require('../model/competition_model');

function responsesToPlain(responses) {
  if (!responses) return {};
  if (responses instanceof Map) return Object.fromEntries(responses);
  if (typeof responses.toObject === 'function') return responses.toObject();
  return { ...responses };
}

function normalizeCompetitionLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function extractCompetitionChoice(responses = {}, formSchema = []) {
  const plain = responsesToPlain(responses);
  const schema = Array.isArray(formSchema) ? formSchema : [];

  const competitionFields = schema.filter((field) => {
    const label = String(field?.label || '').toLowerCase();
    const name = String(field?.fieldName || field?.id || '').toLowerCase();
    return (
      label.includes('competition')
      || label.includes('event')
      || label.includes('category')
      || name.includes('competition')
      || name.includes('event')
      || name.includes('category')
    );
  });

  for (const field of competitionFields) {
    const key = field.fieldName || field.id;
    if (!key) continue;
    const value = plain[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }

  // Fallback: common response keys
  for (const key of Object.keys(plain)) {
    if (/competition|event_name|category/i.test(key)) {
      const value = plain[key];
      if (value != null && String(value).trim() && typeof value !== 'object') {
        return String(value).trim();
      }
    }
  }

  return '';
}

/**
 * Match a fest-form competition select value (e.g. "Inner Flame (Solo Dance)")
 * to a Competition document under the fest.
 */
function matchCompetitionByLabel(competitions = [], rawLabel = '') {
  const label = String(rawLabel || '').trim();
  if (!label || !competitions.length) return null;

  const normalizedLabel = normalizeCompetitionLabel(label);
  if (!normalizedLabel) return null;

  // 1) Exact name match (case-insensitive)
  let hit = competitions.find(
    (c) => normalizeCompetitionLabel(c.name) === normalizedLabel,
  );
  if (hit) return hit;

  // 2) Option is "Name (subtitle)" — match by leading name
  const beforeParen = normalizeCompetitionLabel(label.split('(')[0]);
  if (beforeParen) {
    hit = competitions.find((c) => normalizeCompetitionLabel(c.name) === beforeParen);
    if (hit) return hit;
  }

  // 3) Competition name is a prefix/contained token of the selected option
  const ranked = competitions
    .map((c) => {
      const n = normalizeCompetitionLabel(c.name);
      if (!n) return null;
      if (normalizedLabel === n) return { c, score: 100 };
      if (normalizedLabel.startsWith(`${n} `) || normalizedLabel.startsWith(n)) return { c, score: 80 };
      if (n.startsWith(normalizedLabel)) return { c, score: 60 };
      if (normalizedLabel.includes(n) && n.length >= 3) return { c, score: 40 };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.c || null;
}

/**
 * Resolve competition ObjectId for a fest-level registration.
 * Prefers explicit competitionId from the client, else matches form responses.
 */
async function resolveFestCompetitionId({
  festId,
  responses = {},
  formSchema = [],
  explicitCompetitionId = null,
} = {}) {
  const CompetitionModel = Competition;
  const mongoose = require('mongoose');

  if (explicitCompetitionId && mongoose.Types.ObjectId.isValid(String(explicitCompetitionId))) {
    const byId = await CompetitionModel.findOne({
      _id: explicitCompetitionId,
      fest: festId,
    }).select('_id name');
    if (byId) return byId._id;
  }

  const choice = extractCompetitionChoice(responses, formSchema);
  if (!choice) return null;

  const competitions = await CompetitionModel.find({ fest: festId }).select('_id name').lean();
  const matched = matchCompetitionByLabel(competitions, choice);
  return matched?._id || null;
}

module.exports = {
  responsesToPlain,
  normalizeCompetitionLabel,
  extractCompetitionChoice,
  matchCompetitionByLabel,
  resolveFestCompetitionId,
};
