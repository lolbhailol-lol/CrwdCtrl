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

  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = replaceMeta(html, 'name', 'twitter:title', title);
  html = replaceMeta(html, 'name', 'twitter:description', description);
  html = replaceMeta(html, 'name', 'twitter:image', image);

  html = injectJsonLd(html, seo.jsonLd);
  return html;
}
