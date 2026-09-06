import { useEffect } from 'react';
import {
  SITE_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
  absoluteUrl,
  buildTitle,
  cleanDescription,
} from '../utils/seo';

/**
 * <Seo> — per-route document metadata for a client-rendered SPA.
 *
 * Updates the single existing <title>, description, canonical, robots, Open Graph
 * and Twitter tags in place (no duplicates), and injects page-specific JSON-LD.
 * Googlebot renders the app and reads these, so each route gets unique, accurate
 * metadata instead of the homepage defaults baked into index.html.
 *
 * Props:
 *  - title:        page title (brand is appended automatically)
 *  - description:  meta description (trimmed to ~160 chars)
 *  - canonical:    path or absolute URL (defaults to current location)
 *  - image:        social share image (path or absolute URL)
 *  - type:         og:type (default "website")
 *  - noindex:      true → robots: noindex,nofollow (private/transactional pages)
 *  - keywords:     optional comma-separated keywords
 *  - jsonLd:       object or array of structured-data objects
 *  - withBrand:    append " | CrwdCtrl" to the title (default true)
 */
export default function Seo({
  title,
  description,
  canonical,
  image,
  type = 'website',
  noindex = false,
  keywords,
  jsonLd,
  withBrand = true,
}) {
  const resolvedTitle = buildTitle(title, { withBrand });
  const resolvedDescription = cleanDescription(description || DEFAULT_DESCRIPTION);
  const resolvedImage = image ? absoluteUrl(image) : DEFAULT_IMAGE;
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const canonicalUrl =
      canonical != null
        ? absoluteUrl(canonical)
        : typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : undefined;

    document.title = resolvedTitle;

    setMeta('name', 'description', resolvedDescription);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1');
    if (keywords) setMeta('name', 'keywords', keywords);

    if (canonicalUrl) setLink('canonical', canonicalUrl);

    setMeta('property', 'og:title', resolvedTitle);
    setMeta('property', 'og:description', resolvedDescription);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:image', resolvedImage);
    setMeta('property', 'og:site_name', SITE_NAME);
    if (canonicalUrl) setMeta('property', 'og:url', canonicalUrl);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', resolvedTitle);
    setMeta('name', 'twitter:description', resolvedDescription);
    setMeta('name', 'twitter:image', resolvedImage);

    // Remove any pre-existing structured data (e.g. build-time prerendered
    // JSON-LD, or a previous route's) so there is exactly one set per page.
    document.head
      .querySelectorAll('script[data-seo-jsonld]')
      .forEach((el) => el.remove());

    const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    const injected = schemas
      .filter(Boolean)
      .map((schema) => {
        const el = document.createElement('script');
        el.type = 'application/ld+json';
        el.setAttribute('data-seo-jsonld', 'true');
        el.textContent = JSON.stringify(schema);
        document.head.appendChild(el);
        return el;
      });

    return () => {
      injected.forEach((el) => el.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTitle, resolvedDescription, resolvedImage, canonical, type, noindex, keywords, jsonLdKey]);

  return null;
}

/** Upsert a <meta> tag identified by attr/value (name|property). */
function setMeta(attr, value, content) {
  if (content == null || content === '') return;
  let el = document.head.querySelector(`meta[${attr}="${value}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Upsert a <link rel="..."> tag. */
function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}
