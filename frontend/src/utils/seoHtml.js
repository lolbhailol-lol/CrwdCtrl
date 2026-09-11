/**
 * Pure-string helpers to rewrite the <head> of a built index.html with
 * route-specific SEO tags + JSON-LD.
 *
 * Shared by the build-time prerender script (`scripts/prerender-seo.mjs`) and
 * the Vercel Edge Middleware (`middleware.js`) so the head-injection logic
 * lives in exactly one place. No DOM, no Node-only APIs — safe in the Edge
 * runtime and in plain Node.
 */
import { DEFAULT_IMAGE, absoluteUrl, buildTitle, cleanDescription } from './seo.js';

export function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Serialize one JSON-LD object into a script tag safe for HTML embedding. */
export function jsonLdScript(schema) {
  const json = JSON.stringify(schema).replace(/</g, '\\u003c');
  return `<script type="application/ld+json" data-seo-jsonld>${json}</script>`;
}

export function replaceTitle(html, title) {
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`);
  }
  return html.replace(/<\/head>/i, `  <title>${escapeAttr(title)}</title>\n</head>`);
}

export function replaceMeta(html, attr, key, content) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, 'i');
  if (re.test(html)) return html.replace(re, `$1${escapeAttr(content)}$2`);
  const tag = `  <meta ${attr}="${key}" content="${escapeAttr(content)}" />\n`;
  return html.replace(/<\/head>/i, `${tag}</head>`);
}

export function replaceCanonical(html, href) {
  const re = /(<link\s+rel="canonical"\s+href=")[^"]*(")/i;
  if (re.test(html)) return html.replace(re, `$1${escapeAttr(href)}$2`);
  return html.replace(/<\/head>/i, `  <link rel="canonical" href="${escapeAttr(href)}" />\n</head>`);
}

/** Remove any previously-injected route JSON-LD (keeps static Organization/WebSite). */
export function stripJsonLd(html) {
  return html.replace(
    /\s*<script\s+type="application\/ld\+json"\s+data-seo-jsonld>[\s\S]*?<\/script>/gi,
    '',
  );
}

export function injectJsonLd(html, schemas) {
  const valid = (schemas || []).filter(Boolean);
  if (!valid.length) return html;
  const scripts = valid.map(jsonLdScript).join('\n  ');
  return html.replace(/<\/head>/i, `  ${scripts}\n</head>`);
}

/** Internal links shown in every route's crawlable no-JS fallback. */
export const DEFAULT_EXPLORE_LINKS = [
  { label: 'College Fests — cultural, technical & sports', href: '/fests' },
  { label: 'Treks & Adventure Communities', href: '/treks' },
  { label: 'Sports, Running Clubs & Gym Communities', href: '/sports' },
  { label: 'Events, Shows & Meetups', href: '/events' },
  { label: 'List your fest or event', href: '/list-your-fest' },
  { label: 'About CrwdCtrl', href: '/about' },
  { label: 'Contact us', href: '/contact-us' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms & Conditions', href: '/terms-and-conditions' },
  { label: 'Refunds & Cancellations', href: '/refunds-and-cancellations' },
  { label: 'Shipping Policy', href: '/shipping-policy' },
];

/** Descriptive section per core offering — used on the home fallback (SEO/AEO). */
export const DEFAULT_CORE_SECTIONS = [
  {
    heading: 'College Fests',
    text: 'Discover and register for college fests across India — cultural fests (music, dance, drama, fashion and art), technical fests (hackathons, coding and robotics competitions) and sports fests (tournaments and athletic meets).',
    href: '/fests',
    linkLabel: 'Browse college fests',
  },
  {
    heading: 'Treks & Adventure Communities',
    text: 'Find day hikes, weekend treks, backpacking trips and camping outings run by verified trekking communities, with difficulty level and duration shown on every listing.',
    href: '/treks',
    linkLabel: 'Browse treks & communities',
  },
  {
    heading: 'Sports, Running Clubs & Gym Communities',
    text: 'Join running clubs, runs and marathons, gym communities and sports events near you. Many running clubs are beginner friendly and list their upcoming sessions.',
    href: '/sports',
    linkLabel: 'Browse sports & clubs',
  },
  {
    heading: 'Events, Shows & Meetups',
    text: 'Browse concerts, stand-up comedy, workshops and community meetups happening near you, and book tickets in a tap.',
    href: '/events',
    linkLabel: 'Browse events & shows',
  },
];

/**
 * Build crawlable, no-JS fallback markup for a route.
 *
 * Rendered inside #root (which React clears on mount) so non-JS crawlers and
 * raw-text SEO auditors get a real <h1>, descriptive copy, internal links and
 * FAQ instead of the boot splash. Real users never see it — it is display:none
 * and covered by the boot splash until React replaces #root.
 *
 * @param {object} spec
 * @param {string} spec.h1
 * @param {string} [spec.intro]
 * @param {Array<{heading:string,text:string,href?:string,linkLabel?:string}>} [spec.sections]
 * @param {Array<{label:string,href:string}>} [spec.links]
 * @param {Array<{question:string,answer:string}>} [spec.faq]
 */
export function buildFallbackHtml({
  h1,
  intro,
  sections = [],
  links = DEFAULT_EXPLORE_LINKS,
  faq = [],
} = {}) {
  const parts = [`<h1>${escapeAttr(h1 || 'CrwdCtrl')}</h1>`];
  if (intro) parts.push(`<p>${escapeAttr(intro)}</p>`);
  for (const s of sections) {
    const link = s.href
      ? `<p><a href="${escapeAttr(s.href)}">${escapeAttr(s.linkLabel || `Explore ${s.heading}`)}</a></p>`
      : '';
    parts.push(`<section><h2>${escapeAttr(s.heading)}</h2><p>${escapeAttr(s.text)}</p>${link}</section>`);
  }
  if (links.length) {
    const lis = links
      .map((l) => `<li><a href="${escapeAttr(l.href)}">${escapeAttr(l.label)}</a></li>`)
      .join('');
    parts.push(`<nav aria-label="Explore CrwdCtrl"><h2>Explore CrwdCtrl</h2><ul>${lis}</ul></nav>`);
  }
  if (faq.length) {
    const items = faq
      .map((f) => `<h3>${escapeAttr(f.question)}</h3><p>${escapeAttr(f.answer)}</p>`)
      .join('');
    parts.push(`<section><h2>Frequently asked questions</h2>${items}</section>`);
  }
  return `<div id="seo-fallback">${parts.join('')}</div>`;
}

/**
 * Replace the marked no-JS fallback block inside #root with new markup.
 * Returns the html unchanged if the markers are absent.
 */
export function replaceFallbackContent(html, innerHtml) {
  const re = /(<!--seo-fallback-->)[\s\S]*?(<!--\/seo-fallback-->)/i;
  if (!re.test(html)) return html;
  return html.replace(re, `$1${innerHtml}$2`);
}

/**
 * Apply a full SEO head to a built index.html string.
 *
 * @param {string} baseHtml          built index.html contents
 * @param {object} seo
 * @param {string} seo.title         page title
 * @param {boolean} [seo.withBrand]  append " | CrwdCtrl" (default true)
 * @param {string} seo.description   meta description
 * @param {string} seo.path          route path used for canonical/og:url
 * @param {string} [seo.image]       social image (path or absolute URL)
 * @param {Array}  [seo.jsonLd]      structured-data objects
 * @param {boolean} [seo.stripExistingJsonLd] drop prior route JSON-LD first
 * @param {object} [seo.fallback]    spec for crawlable no-JS #root content
 */
export function applySeoToHtml(baseHtml, seo) {
  const title = buildTitle(seo.title, { withBrand: seo.withBrand !== false });
  const description = cleanDescription(seo.description);
  const canonical = absoluteUrl(seo.path);
  const image = seo.image ? absoluteUrl(seo.image) : DEFAULT_IMAGE;

  let html = baseHtml;
  if (seo.stripExistingJsonLd) html = stripJsonLd(html);

  html = replaceTitle(html, title);
  html = replaceMeta(html, 'name', 'description', description);
  html = replaceCanonical(html, canonical);

  html = replaceMeta(html, 'property', 'og:title', title);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:image', image);
  html = replaceMeta(
    html,
    'property',
    'og:image:alt',
    seo.image ? (seo.title || title) : 'CrwdCtrl logo',
  );

  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = replaceMeta(html, 'name', 'twitter:title', title);
  html = replaceMeta(html, 'name', 'twitter:description', description);
  html = replaceMeta(html, 'name', 'twitter:image', image);

  html = injectJsonLd(html, seo.jsonLd);

  if (seo.fallback) {
    html = replaceFallbackContent(html, buildFallbackHtml(seo.fallback));
  }
  return html;
}
