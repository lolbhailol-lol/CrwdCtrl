/**
 * Build-time SEO prerendering for CrwdCtrl (dependency-free).
 *
 * The app is a client-rendered SPA, so non-JS crawlers (social link scrapers,
 * some answer engines) only see `index.html` — the homepage head — for every
 * route. This script post-processes the Vite build to emit a static
 * `dist/<route>/index.html` for each stable public route, with that route's
 * <title>, description, canonical, Open Graph/Twitter tags and JSON-LD baked
 * into the head. The SPA still boots and renders normally on top of it.
 *
 * On Vercel, filesystem files take precedence over the SPA rewrite, so these
 * prerendered files are served to crawlers while users get the live app.
 *
 * Runs automatically after `npm run build` via the `postbuild` script.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  SITE_NAME,
  breadcrumbSchema,
  faqSchema,
  itemListSchema,
  webPageSchema,
} from '../src/utils/seo.js';
import { DEFAULT_EXPLORE_LINKS, DEFAULT_CORE_SECTIONS, applySeoToHtml } from '../src/utils/seoHtml.js';
import {
  HOME_FAQ,
  ABOUT_FAQ,
  FESTS_FAQ,
  TREKS_FAQ,
  SPORTS_FAQ,
  EVENTS_FAQ,
} from '../src/constants/faqs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const INDEX_HTML = join(DIST, 'index.html');

const HOME_DESCRIPTION =
  'Find and register for college fests, tech and sports events, running clubs, gym communities, treks, and meetups near you.';
const FESTS_DESCRIPTION =
  'Browse and register for college fests near you — cultural, technical and sports festivals. Find upcoming and ongoing fests, competitions and events on CrwdCtrl.';
const TREKS_DESCRIPTION =
  'Discover treks, hiking trips and adventure communities near you. Browse upcoming treks, join trekking communities and book your next outdoor adventure on CrwdCtrl.';
const SPORTS_DESCRIPTION =
  'Discover sports events, running clubs and gym communities near you. Find runs, tournaments and sports fests, and join active communities on CrwdCtrl.';
const EVENTS_DESCRIPTION =
  'Discover events, shows and meetups near you — concerts, stand-up comedy, workshops and more. Find and book tickets to events around you on CrwdCtrl.';
const ABOUT_DESCRIPTION =
  "CrwdCtrl is India's platform for discovering, exploring and registering for college fests, competitions, treks, running clubs and events — all in one place.";
const LIST_FEST_DESCRIPTION =
  'List your college fest, competition, trek or event on CrwdCtrl. Reach thousands of students, manage registrations, and grow your audience for free.';

/** Build a hub crumb + collection schema, with an optional FAQ block. */
function hubJsonLd(name, description, path, crumbs, faq) {
  return [
    breadcrumbSchema(crumbs),
    itemListSchema({ name, description, url: path }),
    faq ? faqSchema(faq) : null,
  ].filter(Boolean);
}

/** Compose a crawlable no-JS fallback spec for a route. */
function fb(h1, intro, faq) {
  return { h1, intro, links: DEFAULT_EXPLORE_LINKS, faq };
}

/** Simple WebPage + breadcrumb schema for info/legal routes. */
function pageJsonLd(name, description, path) {
  return [
    webPageSchema({ name, description, url: path }),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name, path },
    ]),
  ].filter(Boolean);
}

const ROUTES = [
  {
    path: '/',
    title: `${SITE_NAME} — Discover fests, clubs & events`,
    withBrand: false,
    description: HOME_DESCRIPTION,
    fallback: {
      h1: 'CrwdCtrl — Discover college fests, clubs & events near you',
      intro:
        'CrwdCtrl is an Indian community and event discovery platform where you can find and register for college fests, competitions, tech and sports events, running clubs, gym communities, treks, and local meetups near you. Browsing is free — some events charge their own registration or ticket fee, always shown before you register.',
      sections: DEFAULT_CORE_SECTIONS,
      links: DEFAULT_EXPLORE_LINKS,
      faq: HOME_FAQ,
    },
    jsonLd: [
      webPageSchema({ name: `${SITE_NAME} — Discover fests, clubs & events`, description: HOME_DESCRIPTION, url: '/' }),
      itemListSchema({
        name: 'Browse on CrwdCtrl',
        description: 'Categories of events and communities you can discover on CrwdCtrl.',
        url: '/',
        items: [
          { name: 'College Fests', url: '/fests' },
          { name: 'Treks & Adventure', url: '/treks' },
          { name: 'Sports & Running Clubs', url: '/sports' },
          { name: 'Events & Meetups', url: '/events' },
        ],
      }),
      faqSchema(HOME_FAQ),
    ].filter(Boolean),
  },
  {
    path: '/fests',
    title: 'College Fests',
    description: FESTS_DESCRIPTION,
    fallback: fb('College Fests on CrwdCtrl', FESTS_DESCRIPTION, FESTS_FAQ),
    jsonLd: hubJsonLd('College Fests on CrwdCtrl', FESTS_DESCRIPTION, '/fests', [
      { name: 'Home', path: '/' },
      { name: 'Fests', path: '/fests' },
    ], FESTS_FAQ),
  },
  {
    path: '/cultural-fest',
    title: 'Cultural Fests',
    description:
      'Discover and register for cultural college fests near you — music, dance, drama, art and more. Browse upcoming and ongoing cultural festivals on CrwdCtrl.',
    jsonLd: hubJsonLd('Cultural Fests', 'Discover and register for cultural college fests near you on CrwdCtrl.', '/cultural-fest', [
      { name: 'Home', path: '/' },
      { name: 'Fests', path: '/fests' },
      { name: 'Cultural Fests', path: '/cultural-fest' },
    ]),
  },
  {
    path: '/tech-fest',
    title: 'Tech Fests',
    description:
      'Discover and register for technical college fests, hackathons, coding competitions and tech events near you on CrwdCtrl.',
    jsonLd: hubJsonLd('Tech Fests', 'Discover and register for technical college fests near you on CrwdCtrl.', '/tech-fest', [
      { name: 'Home', path: '/' },
      { name: 'Fests', path: '/fests' },
      { name: 'Tech Fests', path: '/tech-fest' },
    ]),
  },
  {
    path: '/sports-fest',
    title: 'Sports Fests',
    description: 'Discover and register for sports college fests, tournaments and athletic events near you on CrwdCtrl.',
    jsonLd: hubJsonLd('Sports Fests', 'Discover and register for sports college fests near you on CrwdCtrl.', '/sports-fest', [
      { name: 'Home', path: '/' },
      { name: 'Fests', path: '/fests' },
      { name: 'Sports Fests', path: '/sports-fest' },
    ]),
  },
  {
    path: '/treks',
    title: 'Treks & Adventure Communities',
    description: TREKS_DESCRIPTION,
    fallback: fb('Treks & Adventure Communities on CrwdCtrl', TREKS_DESCRIPTION, TREKS_FAQ),
    jsonLd: hubJsonLd('Treks & Adventure on CrwdCtrl', TREKS_DESCRIPTION, '/treks', [
      { name: 'Home', path: '/' },
      { name: 'Treks', path: '/treks' },
    ], TREKS_FAQ),
  },
  {
    path: '/sports',
    title: 'Sports, Running Clubs & Gym Communities',
    description: SPORTS_DESCRIPTION,
    fallback: fb('Sports, Running Clubs & Gym Communities on CrwdCtrl', SPORTS_DESCRIPTION, SPORTS_FAQ),
    jsonLd: hubJsonLd('Sports & Running Clubs on CrwdCtrl', SPORTS_DESCRIPTION, '/sports', [
      { name: 'Home', path: '/' },
      { name: 'Sports', path: '/sports' },
    ], SPORTS_FAQ),
  },
  {
    path: '/events',
    title: 'Events & Shows',
    description: EVENTS_DESCRIPTION,
    fallback: fb('Events, Shows & Meetups on CrwdCtrl', EVENTS_DESCRIPTION, EVENTS_FAQ),
    jsonLd: hubJsonLd('Events & Shows on CrwdCtrl', EVENTS_DESCRIPTION, '/events', [
      { name: 'Home', path: '/' },
      { name: 'Events', path: '/events' },
    ], EVENTS_FAQ),
  },
  {
    path: '/about',
    title: 'About CrwdCtrl',
    description: ABOUT_DESCRIPTION,
    fallback: fb('About CrwdCtrl', ABOUT_DESCRIPTION, ABOUT_FAQ),
    jsonLd: [
      webPageSchema({ name: 'About CrwdCtrl', description: ABOUT_DESCRIPTION, url: '/about' }),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'About', path: '/about' },
      ]),
      faqSchema(ABOUT_FAQ),
    ].filter(Boolean),
  },
  {
    path: '/contact-us',
    title: 'Contact Us',
    description:
      'Get in touch with the CrwdCtrl team. Contact us for support, partnerships, listing your fest or event, or any questions about the platform.',
    jsonLd: pageJsonLd('Contact CrwdCtrl', 'Get in touch with the CrwdCtrl team.', '/contact-us'),
  },
  {
    path: '/help-center',
    title: 'Help Center',
    description:
      'Find answers to common questions about CrwdCtrl — getting started, registering for events, managing your account, payments, and contacting support.',
    jsonLd: pageJsonLd('CrwdCtrl Help Center', 'Help and support for using CrwdCtrl.', '/help-center'),
  },
  {
    path: '/list-your-fest',
    title: 'List Your Fest or Event',
    description: LIST_FEST_DESCRIPTION,
    jsonLd: pageJsonLd('List Your Fest on CrwdCtrl', LIST_FEST_DESCRIPTION, '/list-your-fest'),
  },
  {
    path: '/products-and-services',
    title: 'Products & Services',
    description:
      'Explore the products and services offered by CrwdCtrl — event discovery and registration for college fests, competitions, treks, runs and more.',
    jsonLd: pageJsonLd('CrwdCtrl Products & Services', '', '/products-and-services'),
  },
  {
    path: '/terms-and-conditions',
    title: 'Terms & Conditions',
    description:
      'Read the Terms & Conditions governing access to and use of the CrwdCtrl website, platform and services.',
    jsonLd: pageJsonLd('CrwdCtrl Terms & Conditions', '', '/terms-and-conditions'),
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy',
    description:
      'Learn how CrwdCtrl collects, uses, stores and protects your personal information when you use our platform and services.',
    jsonLd: pageJsonLd('CrwdCtrl Privacy Policy', '', '/privacy-policy'),
  },
  {
    path: '/refunds-and-cancellations',
    title: 'Refunds & Cancellations',
    description:
      "Read CrwdCtrl's refunds and cancellations policy for event registrations, tickets and bookings made through the platform.",
    jsonLd: pageJsonLd('CrwdCtrl Refunds & Cancellations', '', '/refunds-and-cancellations'),
  },
  {
    path: '/delete-account',
    title: 'Delete Your Account',
    description:
      'Learn how to request deletion of your CrwdCtrl account and associated personal data, what is removed, what is retained, and how long it takes.',
    jsonLd: pageJsonLd('Delete Your CrwdCtrl Account', '', '/delete-account'),
  },
];

function buildRouteHtml(baseHtml, route) {
  return applySeoToHtml(baseHtml, {
    title: route.title,
    withBrand: route.withBrand,
    description: route.description,
    path: route.path,
    image: route.image,
    jsonLd: route.jsonLd,
    fallback: route.fallback || fb(route.title, route.description),
  });
}

function main() {
  let baseHtml;
  try {
    baseHtml = readFileSync(INDEX_HTML, 'utf8');
  } catch {
    console.error('[prerender-seo] dist/index.html not found — run `vite build` first.');
    process.exit(1);
  }

  let written = 0;
  for (const route of ROUTES) {
    const html = buildRouteHtml(baseHtml, route);
    if (route.path === '/') {
      writeFileSync(INDEX_HTML, html, 'utf8');
    } else {
      const dir = join(DIST, route.path.replace(/^\//, ''));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'index.html'), html, 'utf8');
    }
    written += 1;
  }

  console.log(`[prerender-seo] Prerendered ${written} route(s) with per-page SEO + JSON-LD.`);
}

main();
