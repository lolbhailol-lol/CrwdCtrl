/**
 * Open Graph / share-preview HTML for social crawlers (WhatsApp, Facebook, etc.).
 * Used when the frontend is on Railway/Caddy (Vercel Edge middleware does not run).
 */

const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const Trek = require('../model/trek_model');
const TrekCommunity = require('../model/trek_community_model');
const SportsEvent = require('../model/sports_model');
const RunClub = require('../model/run_club_model');
const EventShow = require('../model/event_show_model');
const { findByIdOrSlug } = require('../utils/slug');

const SITE_URL = (process.env.PUBLIC_WEB_URL || process.env.VITE_PUBLIC_WEB_URL || 'https://www.crwdctrl.in').replace(/\/$/, '');
const SITE_NAME = 'CrwdCtrl';
const DEFAULT_IMAGE = `${SITE_URL}/logo-crwdctrl.png`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cleanDescription(text, max = 160) {
  if (!text) return `${SITE_NAME} — Discover fests, clubs & events.`;
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

/** Prefer landscape slots for WhatsApp/Facebook (they struggle with tall portraits). */
function pickShareImage(entity) {
  if (!entity || typeof entity !== 'object') return undefined;
  const covers = entity.coverImages && typeof entity.coverImages === 'object' ? entity.coverImages : {};
  const candidates = [
    covers.wide,
    covers.landscape,
    covers.hero,
    covers.page,
    covers.square,
    covers.portrait,
    covers.video,
    entity.coverImage,
    entity.poster,
    entity.banner,
    entity.image,
    Array.isArray(entity.heroImages) ? entity.heroImages[0] : null,
    Array.isArray(entity.images) ? entity.images[0] : null,
    Array.isArray(entity.galleryImages) ? entity.galleryImages[0] : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

/** WhatsApp prefers ~1200×630 JPEG; Cloudinary can crop on the fly. */
function toOgImageUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_IMAGE;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_IMAGE;
  if (/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(trimmed) && !/\/upload\/[^/]+,/.test(trimmed)) {
    return trimmed.replace(
      /\/image\/upload\//i,
      '/image/upload/c_fill,w_1200,h_630,f_jpg,q_auto/',
    );
  }
  return trimmed;
}

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return SITE_URL;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}

const ROUTES = [
  {
    test: /^\/view-details\/([^/]+)\/?$/,
    load: async (id) => {
      const fest = await findByIdOrSlug(FestOrganizer, id, {
        baseFilter: { isApproved: true },
        pickName: (row) => row.festName,
        lean: true,
      });
      if (!fest) return null;
      return {
        title: fest.festName,
        description: fest.description,
        image: pickShareImage(fest),
      };
    },
  },
  {
    test: /^\/competitions-view-details\/([^/]+)\/?$/,
    load: async (id) => {
      const competition = await findByIdOrSlug(Competition, id, {
        pickName: (row) => row.name,
        lean: true,
      });
      if (!competition) return null;
      return {
        title: competition.name,
        description: competition.description,
        image: pickShareImage(competition),
      };
    },
  },
  {
    test: /^\/trek\/([^/]+)\/?$/,
    load: async (id) => {
      const trek = await findByIdOrSlug(Trek, id, {
        baseFilter: { status: { $in: ['published', 'completed'] } },
        pickName: (row) => row.trekName || row.title,
        lean: true,
      });
      if (!trek) return null;
      return {
        title: trek.trekName || trek.title,
        description: trek.description,
        image: pickShareImage(trek),
      };
    },
  },
  {
    test: /^\/treks\/community\/([^/]+)\/?$/,
    load: async (id) => {
      const community = await findByIdOrSlug(TrekCommunity, id, {
        baseFilter: { status: 'published' },
        pickName: (row) => row.name,
        lean: true,
      });
      if (!community) return null;
      return {
        title: `${community.name} — Trek Community`,
        description: community.aboutUs,
        image: pickShareImage(community),
      };
    },
  },
  {
    test: /^\/sports\/run\/([^/]+)\/?$/,
    load: async (id) => loadSportsEvent(id),
  },
  {
    test: /^\/sports\/run-club\/([^/]+)\/?$/,
    load: async (id) => loadRunClub(id, 'Running Club'),
  },
  {
    test: /^\/events\/community-event\/([^/]+)\/?$/,
    load: async (id) => loadSportsEvent(id),
  },
  {
    test: /^\/events\/community\/([^/]+)\/?$/,
    load: async (id) => loadRunClub(id, 'Community'),
  },
  {
    test: /^\/events\/([^/]+)\/?$/,
    load: async (id) => {
      const show = await findByIdOrSlug(EventShow, id, {
        baseFilter: { status: 'published' },
        pickName: (row) => row.displayName || row.title,
        lean: true,
      });
      if (!show) return null;
      return {
        title: show.displayName || show.title,
        description: show.description || show.about,
        image: pickShareImage(show),
      };
    },
  },
];

async function loadSportsEvent(id) {
  const event = await findByIdOrSlug(SportsEvent, id, {
    baseFilter: { status: { $in: ['published', 'completed'] } },
    pickName: (row) => row.title,
    lean: true,
  });
  if (!event) return null;
  return {
    title: event.title,
    description: event.description,
    image: pickShareImage(event),
  };
}

async function loadRunClub(id, suffix) {
  const club = await findByIdOrSlug(RunClub, id, {
    pickName: (row) => row.name,
    lean: true,
  });
  if (!club) return null;
  return {
    title: `${club.name} — ${suffix}`,
    description: club.aboutUs || club.tagline || club.description,
    image: pickShareImage(club),
  };
}

function buildOgHtml({ title, description, image, path }) {
  const safeTitle = title || SITE_NAME;
  const desc = cleanDescription(description || `${safeTitle} on ${SITE_NAME}.`);
  const pageUrl = absoluteUrl(path);
  const imageUrl = toOgImageUrl(image);
  const fullTitle = safeTitle.includes(SITE_NAME) ? safeTitle : `${safeTitle} | ${SITE_NAME}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
  <meta property="og:title" content="${escapeHtml(safeTitle)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(safeTitle)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(safeTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
</head>
<body>
  <h1>${escapeHtml(safeTitle)}</h1>
  <p>${escapeHtml(desc)}</p>
  <p><a href="${escapeHtml(pageUrl)}">Open on ${escapeHtml(SITE_NAME)}</a></p>
</body>
</html>`;
}

/**
 * Resolve a public SPA path to OG HTML, or null if the path is not a known detail route / entity missing.
 */
async function resolveOgHtml(pathname) {
  const path = String(pathname || '').split('?')[0];
  if (!path.startsWith('/')) return null;

  const route = ROUTES.find((r) => r.test.test(path));
  if (!route) return null;

  const id = path.match(route.test)?.[1];
  if (!id) return null;

  const item = await route.load(id);
  if (!item) return null;

  return buildOgHtml({
    title: item.title,
    description: item.description,
    image: item.image,
    path,
  });
}

module.exports = {
  resolveOgHtml,
  pickShareImage,
  toOgImageUrl,
  SITE_URL,
};
