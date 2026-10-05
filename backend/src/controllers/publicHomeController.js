const Trek = require('../model/trek_model');
const TrekCommunity = require('../model/trek_community_model');
const SportsEvent = require('../model/sports_model');
const RunClub = require('../model/run_club_model');
const EventShow = require('../model/event_show_model');
const festOrganizerController = require('./festOrganizerController');
const { readHomeSectionLabels, readPublicConfig, DEFAULT_HOME_SECTION_LABELS } = require('./siteSettingController');
const homepageSectionCtrl = require('./homepageSectionController');
const {
  sanitizePublicTrek,
  sanitizePublicSportsEvent,
  sanitizePublicRunClub,
  sanitizePublicCommunity,
  sanitizePublicEventShow,
} = require('../utils/publicEntitySanitize');

/**
 * Invoke an existing Express handler programmatically and resolve with the JSON
 * body it would have sent. Lets the aggregate reuse the exact fest logic
 * (caching, field selection, shaping) without duplicating it. Resolves null on
 * any error so one failing section never breaks the whole response.
 */
function captureHandler(handler, reqOverrides = {}) {
  return new Promise((resolve) => {
    const req = { query: {}, params: {}, headers: {}, ...reqOverrides };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      set() { return this; },
      setHeader() { return this; },
      json(body) { resolve(body); },
      send(body) { resolve(body); },
    };
    try {
      Promise.resolve(handler(req, res, () => resolve(null))).catch(() => resolve(null));
    } catch (_) {
      resolve(null);
    }
  });
}

const safe = async (fn, fallback) => {
  try {
    return await fn();
  } catch (_) {
    return fallback;
  }
};

/** Short in-memory cache — collapses thrash when hundreds open the homepage at once. */
const HOME_CACHE_TTL_MS = Number(process.env.HOME_FEED_CACHE_MS) || 20_000;
let homeCache = null;
let homeInFlight = null;

function readHomeCache() {
  if (!homeCache) return null;
  if (Date.now() - homeCache.at > HOME_CACHE_TTL_MS) {
    homeCache = null;
    return null;
  }
  return homeCache.payload;
}

function writeHomeCache(payload) {
  homeCache = { at: Date.now(), payload };
}

async function buildHomeFeed() {
  const [festsBody, treks, communities, sports, runClubs, eventShows, eventClubIds, sectionLabels, homepageSections, config] = await Promise.all([
    safe(() => captureHandler(festOrganizerController.getAllFests), null),
    safe(() => Trek.find({ status: 'published' }).sort({ trekDate: 1, createdAt: -1 }).limit(50).lean(), []),
    safe(() => TrekCommunity.find({ status: 'published' }).sort({ trekPagePriority: 1, createdAt: -1 }).limit(50).lean(), []),
    safe(() => SportsEvent.find({
      status: 'published',
      $or: [
        { showOnSportsPage: { $ne: false } },
        { showOnEventsPage: true },
        { homeSection: { $nin: [null, ''] } },
        { showOnHomeSlide: true },
        { 'customPageSections.0': { $exists: true } },
      ],
    }).sort({ priority: 1, eventDate: 1, createdAt: -1 }).limit(150).lean(), []),
    safe(() => RunClub.find({
      status: 'published',
      $or: [
        { listingHub: { $ne: 'events' }, showOnSportsPage: { $ne: false }, showInRunClubs: { $ne: false } },
        { listingHub: 'events' },
      ],
    }).sort({ runClubPriority: 1, createdAt: -1 }).limit(150).lean(), []),
    safe(() => EventShow.find({ status: 'published' }).sort({ pagePriority: 1, createdAt: -1 }).limit(100).lean(), []),
    safe(() => RunClub.find({ listingHub: 'events' }).distinct('_id'), []),
    safe(() => readHomeSectionLabels(), { ...DEFAULT_HOME_SECTION_LABELS }),
    safe(() => homepageSectionCtrl.listEnabledForPage('home'), []),
    safe(() => readPublicConfig(), null),
  ]);

  const festsOk = festsBody != null && Array.isArray(festsBody.fests);
  const fests = festsOk ? festsBody.fests : [];
  const partial = !festsOk;
  const eventClubSet = new Set((Array.isArray(eventClubIds) ? eventClubIds : []).map(String));

  return {
    success: true,
    partial,
    fests,
    treks: Array.isArray(treks) ? treks.map(sanitizePublicTrek) : [],
    communities: Array.isArray(communities) ? communities.map(sanitizePublicCommunity) : [],
    sports: Array.isArray(sports) ? sports.map((s) => {
      const clean = sanitizePublicSportsEvent(s);
      if (s.runClubId && eventClubSet.has(String(s.runClubId))) clean.listingHub = 'events';
      return clean;
    }) : [],
    runClubs: Array.isArray(runClubs) ? runClubs.map(sanitizePublicRunClub) : [],
    eventShows: Array.isArray(eventShows) ? eventShows.map(sanitizePublicEventShow) : [],
    homepageSections: Array.isArray(homepageSections) ? homepageSections : [],
    sectionLabels: sectionLabels || { ...DEFAULT_HOME_SECTION_LABELS },
    config: config || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * GET /api/home — single aggregated payload for the homepage.
 * Collapses the 6 separate public reads (fests, treks, communities, sports,
 * run clubs, event shows) into one request. Each section degrades to an empty
 * list independently; `partial: true` when the core fest fetch fails so clients
 * can fall back instead of treating empty arrays as a healthy catalog.
 */
exports.getHomeFeed = async (_req, res) => {
  const cached = readHomeCache();
  if (cached) {
    res.set({
      'Cache-Control': 'public, max-age=20, stale-while-revalidate=60',
      'X-Cache': 'HIT',
    });
    return res.status(200).json(cached);
  }

  if (!homeInFlight) {
    homeInFlight = buildHomeFeed()
      .then((payload) => {
        // Only cache healthy feeds — never pin an empty/partial homepage.
        if (payload && !payload.partial && Array.isArray(payload.fests) && payload.fests.length > 0) {
          writeHomeCache(payload);
        }
        return payload;
      })
      .finally(() => {
        homeInFlight = null;
      });
  }

  const payload = await homeInFlight;
  if (payload?.partial) {
    res.set('Cache-Control', 'no-store');
  } else {
    res.set({
      'Cache-Control': 'public, max-age=20, stale-while-revalidate=60',
      'X-Cache': 'MISS',
    });
  }
  return res.status(200).json(payload);
};

/** Test helper — clear between unit runs. */
exports._clearHomeCache = () => {
  homeCache = null;
  homeInFlight = null;
};
