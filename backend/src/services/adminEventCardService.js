/**
 * Resolve a first-party event card from a Notification Center audience filter.
 * Used for compose prefill and rich campaign emails.
 */
const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const Trek = require('../model/trek_model');
const SportsEvent = require('../model/sports_model');
const EventShow = require('../model/event_show_model');

function asObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
  return null;
}

function toSlug(value = '') {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pickCover(doc = {}) {
  const covers = doc.coverImages || {};
  return (
    doc.coverImage ||
    doc.poster ||
    doc.banner ||
    covers.wide ||
    covers.hero ||
    covers.landscape ||
    covers.portrait ||
    covers.square ||
    ''
  );
}

function formatDateLabel(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatShowTiming(showTimings = []) {
  if (!Array.isArray(showTimings) || !showTimings.length) return '';
  const first = showTimings[0];
  const datePart = formatDateLabel(first?.date);
  const timePart = first?.time ? String(first.time) : '';
  return [datePart, timePart].filter(Boolean).join(' · ');
}

function buildCard({
  kind,
  id,
  name,
  subtitle = '',
  dateLabel = '',
  placeLabel = '',
  imageUrl = '',
  ctaPath = '',
  ctaLabel = 'View on CrwdCtrl',
}) {
  const cleanName = name || 'Event';
  const suggestedTitle = `Don't miss ${cleanName}`;
  const bits = [dateLabel, placeLabel].filter(Boolean);
  const suggestedMessage = bits.length
    ? `${cleanName} is on CrwdCtrl${bits.length ? ` — ${bits.join(' · ')}` : ''}. Open the link for details and updates.`
    : `${cleanName} is on CrwdCtrl. Open the link for details and updates.`;

  return {
    kind,
    id: String(id),
    name: cleanName,
    subtitle: subtitle || '',
    dateLabel: dateLabel || '',
    placeLabel: placeLabel || '',
    imageUrl: imageUrl || '',
    ctaPath: ctaPath || '/',
    ctaLabel,
    suggestedTitle,
    suggestedMessage,
  };
}

/**
 * @param {object} audience - { type, filters }
 * @returns {Promise<object|null>}
 */
async function resolveEventCardFromAudience(audience = {}) {
  const type = String(audience.type || '').trim();
  const filters = audience.filters || {};

  if (type === 'fest') {
    const festId = asObjectId(filters.festId);
    if (!festId) return null;
    const fest = await FestOrganizer.findById(festId)
      .select('festName subtitle festDate venue collegeName coverImage')
      .lean();
    if (!fest) return null;
    const slug = toSlug(fest.festName);
    return buildCard({
      kind: 'fest',
      id: fest._id,
      name: fest.festName,
      subtitle: fest.subtitle || fest.collegeName || '',
      dateLabel: formatDateLabel(fest.festDate),
      placeLabel: fest.venue || '',
      imageUrl: pickCover(fest),
      ctaPath: `/view-details/${slug || fest._id}`,
      ctaLabel: 'View fest',
    });
  }

  if (type === 'competition') {
    const competitionId = asObjectId(filters.competitionId);
    if (!competitionId) return null;
    const comp = await Competition.findById(competitionId)
      .select('name subtitle competitionType coverImage fest')
      .populate('fest', 'festName festDate venue')
      .lean();
    if (!comp) return null;
    const slug = toSlug(comp.name);
    const festName = comp.fest?.festName || '';
    return buildCard({
      kind: 'competition',
      id: comp._id,
      name: comp.name,
      subtitle: [comp.competitionType, festName].filter(Boolean).join(' · '),
      dateLabel: formatDateLabel(comp.fest?.festDate),
      placeLabel: comp.fest?.venue || '',
      imageUrl: pickCover(comp),
      ctaPath: `/competitions-view-details/${slug || comp._id}`,
      ctaLabel: 'View competition',
    });
  }

  if (type === 'trek') {
    const trekId = asObjectId(filters.trekId);
    if (!trekId) return null;
    const trek = await Trek.findById(trekId)
      .select('trekName trekDate venue city coverImage coverImages')
      .lean();
    if (!trek) return null;
    const slug = toSlug(trek.trekName);
    return buildCard({
      kind: 'trek',
      id: trek._id,
      name: trek.trekName,
      subtitle: 'Trek',
      dateLabel: formatDateLabel(trek.trekDate),
      placeLabel: [trek.venue, trek.city].filter(Boolean).join(', '),
      imageUrl: pickCover(trek),
      ctaPath: `/trek/${slug || trek._id}`,
      ctaLabel: 'View trek',
    });
  }

  if (type === 'run') {
    const eventId = asObjectId(filters.eventId);
    if (!eventId) return null;
    const run = await SportsEvent.findById(eventId)
      .select('title eventDate venue city coverImage coverImages sportType')
      .lean();
    if (!run) return null;
    const slug = toSlug(run.title);
    return buildCard({
      kind: 'run',
      id: run._id,
      name: run.title,
      subtitle: run.sportType || 'Run',
      dateLabel: formatDateLabel(run.eventDate),
      placeLabel: [run.venue, run.city].filter(Boolean).join(', '),
      imageUrl: pickCover(run),
      ctaPath: `/sports/run/${slug || run._id}`,
      ctaLabel: 'View run',
    });
  }

  if (type === 'event_show') {
    const eventShowId = asObjectId(filters.eventShowId);
    if (!eventShowId) return null;
    const show = await EventShow.findById(eventShowId)
      .select('title displayName venue city showTimings poster coverImages banner')
      .lean();
    if (!show) return null;
    const name = show.displayName || show.title;
    const slug = toSlug(show.title || show.displayName);
    return buildCard({
      kind: 'event_show',
      id: show._id,
      name,
      subtitle: 'Event',
      dateLabel: formatShowTiming(show.showTimings),
      placeLabel: [show.venue, show.city].filter(Boolean).join(', '),
      imageUrl: pickCover(show),
      ctaPath: `/events/${slug || show._id}`,
      ctaLabel: 'View event',
    });
  }

  // competition_type / all_users / manual → no single event card
  return null;
}

/**
 * Resolve card from explicit about { kind, id }.
 */
async function resolveEventCardFromAbout(about = {}) {
  if (!about || !about.kind || !about.id) return null;
  const kind = String(about.kind).trim();
  const id = String(about.id).trim();
  if (!id) return null;

  const filters = {};
  if (kind === 'fest') filters.festId = id;
  else if (kind === 'competition') filters.competitionId = id;
  else if (kind === 'trek') filters.trekId = id;
  else if (kind === 'run') filters.eventId = id;
  else if (kind === 'event_show') filters.eventShowId = id;
  else return null;

  return resolveEventCardFromAudience({ type: kind, filters });
}

/**
 * Prefer explicit about when provided.
 * - aboutPresent + valid about → card from about
 * - aboutPresent + null/empty about → plain (no audience fallback; admin cleared About)
 * - about not in request → fall back to audience-derived card (legacy)
 */
async function resolveEventContext({
  about = null,
  audience = null,
  aboutPresent = false,
} = {}) {
  if (aboutPresent) {
    if (about && about.kind && about.id) {
      return resolveEventCardFromAbout(about);
    }
    return null;
  }
  if (about && about.kind && about.id) {
    const card = await resolveEventCardFromAbout(about);
    if (card) return card;
  }
  if (audience?.type) {
    return resolveEventCardFromAudience(audience);
  }
  return null;
}

/**
 * Build audience-like filters from query params for GET event-card.
 */
function audienceFromQuery(query = {}) {
  const type = String(query.type || '').trim();
  const filters = {};
  if (query.festId) filters.festId = query.festId;
  if (query.competitionId) filters.competitionId = query.competitionId;
  if (query.competitionType) filters.competitionType = query.competitionType;
  if (query.trekId) filters.trekId = query.trekId;
  if (query.eventId) filters.eventId = query.eventId;
  if (query.eventShowId) filters.eventShowId = query.eventShowId;
  return { type, filters };
}

module.exports = {
  resolveEventCardFromAudience,
  resolveEventCardFromAbout,
  resolveEventContext,
  audienceFromQuery,
};
