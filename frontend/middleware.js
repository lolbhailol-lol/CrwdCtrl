/**
 * Vercel Edge Middleware — dynamic SEO/OG for shared detail links.
 *
 * The app is a client-rendered SPA, so non-JS crawlers (social link scrapers,
 * answer engines) only see the homepage <head> for dynamic routes like a shared
 * fest or trek link. This middleware intercepts *crawler* requests to detail
 * routes, fetches the public API for that item, and returns the built
 * index.html with the item's title, description, Open Graph image and
 * Event/WebPage JSON-LD injected into the head.
 *
 * Real users are passed straight through to the normal SPA — zero impact on the
 * interactive experience. On any error or timeout we also pass through.
 */
import { next } from '@vercel/edge';
import { breadcrumbSchema, eventSchema, webPageSchema } from './src/utils/seo.js';
import { applySeoToHtml } from './src/utils/seoHtml.js';

export const config = {
  matcher: [
    '/view-details/:path*',
    '/competitions-view-details/:path*',
    '/trek/:path*',
    '/treks/community/:path*',
    '/sports/run/:path*',
    '/sports/run-club/:path*',
    '/events/:path*',
  ],
};

const API_BASE =
  process.env.VITE_API_BASE_URL || 'https://crwdctrl-production-9c58.up.railway.app/api';

const BOT_UA =
  /(facebookexternalhit|facebot|twitterbot|whatsapp|slackbot|slack-imgproxy|linkedinbot|discordbot|telegrambot|pinterest|redditbot|googlebot|google-inspectiontool|storebot-google|bingbot|duckduckbot|applebot|gptbot|oai-searchbot|chatgpt-user|perplexitybot|claudebot|claude-web|anthropic-ai|bytespider|amazonbot|yandexbot|embedly|quora link preview|vkshare|w3c_validator|iframely|skypeuripreview|nuzzel|bitlybot|developers\.google\.com\/\+\/web\/snippet)/i;

/** Prefer cover slots over falling back to the CrwdCtrl logo in OG previews. */
function pickShareImage(entity) {
  if (!entity || typeof entity !== 'object') return undefined;
  const covers = entity.coverImages && typeof entity.coverImages === 'object' ? entity.coverImages : {};
  const candidates = [
    covers.page,
    entity.coverImage,
    covers.hero,
    covers.portrait,
    covers.wide,
    covers.landscape,
    covers.square,
    covers.video,
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

const ROUTES = [
  {
    test: /^\/view-details\/([^/]+)\/?$/,
    api: (id) => `/fests/${id}/public`,
    pick: (j) => j?.data || j,
    build: (f, path) => buildEvent(f.festName, f.description, pickShareImage(f), f.venue, f.ticketPrice ?? f.feeAmount, f.collegeName, path, 'Fests', '/fests'),
  },
  {
    test: /^\/competitions-view-details\/([^/]+)\/?$/,
    api: (id) => `/fests/competitions/${id}/public`,
    pick: (j) => j?.data || j?.competition || j,
    build: (c, path) => buildEvent(c.name, c.description, pickShareImage(c), c.venue, c.registrationFee ?? c.feeAmount, c.fest?.festName, path, 'Fests', '/fests'),
  },
  {
    test: /^\/trek\/([^/]+)\/?$/,
    api: (id) => `/treks/${id}`,
    pick: (j) => j?.trek || j?.data || j,
    build: (t, path) => buildEvent(t.trekName || t.title, t.description, pickShareImage(t), t.city || t.destination || t.startingPoint, t.registrationFee, t.communityName, path, 'Treks', '/treks'),
  },
  {
    test: /^\/treks\/community\/([^/]+)\/?$/,
    api: (id) => `/trek-communities/${id}`,
    pick: (j) => j?.community || j?.data || j,
    build: (c, path) => buildPage(`${c.name} — Trek Community`, c.aboutUs, pickShareImage(c), path, 'Treks', '/treks', c.name),
  },
  {
    test: /^\/sports\/run\/([^/]+)\/?$/,
    api: (id) => `/sports/${id}`,
    pick: (j) => j?.event || j?.data || j,
    build: (e, path) => buildEvent(e.title, e.description, pickShareImage(e), e.venue || e.city, e.registrationFee, e.runClub?.name || e.organizer, path, 'Sports', '/sports'),
  },
  {
    test: /^\/sports\/run-club\/([^/]+)\/?$/,
    api: (id) => `/run-clubs/${id}`,
    pick: (j) => j?.club || j?.data || j,
    build: (c, path) => buildPage(`${c.name} — Running Club`, c.aboutUs, pickShareImage(c), path, 'Sports', '/sports', c.name),
  },
  {
    test: /^\/events\/([^/]+)\/?$/,
    api: (id) => `/events/${id}`,
    pick: (j) => j?.show || j?.data || j,
    build: (e, path) => buildEvent(
      e.displayName || e.title,
      e.description || e.about,
      pickShareImage(e),
      e.venue || e.city,
      e.ticketPrice,
      e.organizer,
      path,
      'Events',
      '/events',
    ),
  },
];

function buildEvent(name, description, image, location, price, organizer, path, parentName, parentPath) {
  const safeName = name || 'CrwdCtrl';
  const desc = description || `${safeName} on CrwdCtrl.`;
  const shareImage = image || undefined;
  return {
    title: safeName,
    description: desc,
    image: shareImage,
    fallback: { h1: safeName, intro: desc },
    jsonLd: [
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: parentName, path: parentPath },
        { name: safeName, path },
      ]),
      eventSchema({
        name: safeName,
        description: desc,
        url: path,
        image: shareImage,
        location: location && !/^tba|^tbd/i.test(String(location)) ? location : undefined,
        price: price != null ? price : undefined,
        organizerName: organizer && organizer !== 'Unknown College' ? organizer : undefined,
        availabilityUrl: path,
      }),
    ],
  };
}

function buildPage(title, description, image, path, parentName, parentPath, crumbName) {
  const desc = description || `${title} on CrwdCtrl.`;
  const shareImage = image || undefined;
  return {
    title,
    description: desc,
    image: shareImage,
    fallback: { h1: title, intro: desc },
    jsonLd: [
      webPageSchema({ name: title, description: desc, url: path }),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: parentName, path: parentPath },
        { name: crumbName || title, path },
      ]),
    ],
  };
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function middleware(request) {
  try {
    const ua = request.headers.get('user-agent') || '';
    if (!BOT_UA.test(ua)) return next();

    const { pathname, origin } = new URL(request.url);
    const route = ROUTES.find((r) => r.test.test(pathname));
    if (!route) return next();

    const id = pathname.match(route.test)?.[1];
    if (!id) return next();

    // Fetch item data and the built index.html shell in parallel.
    const [json, baseHtml] = await Promise.all([
      fetchJson(`${API_BASE}${route.api(id)}`, 3000),
      fetchText(`${origin}/index.html`, 3000),
    ]);

    const item = json && route.pick(json);
    if (!item || !baseHtml) return next();

    const seo = route.build(item, pathname);
    const html = applySeoToHtml(baseHtml, {
      title: seo.title,
      description: seo.description,
      path: pathname,
      image: seo.image,
      jsonLd: seo.jsonLd,
      fallback: seo.fallback,
      stripExistingJsonLd: true,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Cache crawler responses at the edge; refresh in the background.
        'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
        'x-crwdctrl-prerender': 'bot',
      },
    });
  } catch {
    return next();
  }
}
