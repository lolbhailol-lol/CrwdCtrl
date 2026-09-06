/**
 * SEO / AEO helpers for CrwdCtrl.
 *
 * Centralizes site constants, URL canonicalization, and JSON-LD structured-data
 * builders so every page can emit consistent, machine-readable metadata for
 * search engines (Google) and answer engines (ChatGPT, Perplexity, AI Overviews).
 */

export const SITE_URL = 'https://www.crwdctrl.in';
export const SITE_NAME = 'CrwdCtrl';
export const DEFAULT_DESCRIPTION =
  'CrwdCtrl helps you find college fests, tech and sports events, running clubs, gym communities, treks, and meetups near you.';
export const DEFAULT_IMAGE = `${SITE_URL}/logo-crwdctrl.png`;
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Resolve a path or partial URL to an absolute https URL on the canonical host. */
export function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return SITE_URL;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}

/** Build the document <title>, appending the brand unless asked not to. */
export function buildTitle(title, { withBrand = true } = {}) {
  if (!title) return `${SITE_NAME} — Discover fests, clubs & events`;
  if (!withBrand || title.includes(SITE_NAME)) return title;
  return `${title} | ${SITE_NAME}`;
}

/** Trim/normalize a string for use as a meta description (~160 char sweet spot). */
export function cleanDescription(text, max = 160) {
  if (!text) return DEFAULT_DESCRIPTION;
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

/**
 * BreadcrumbList schema. `items` = [{ name, path }] ordered root → current.
 */
export function breadcrumbSchema(items = []) {
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * Event schema for fests, treks, runs, and competitions. Only emits fields that
 * are present so we never publish empty/placeholder structured data.
 */
export function eventSchema({
  name,
  description,
  url,
  image,
  startDate,
  endDate,
  location,
  isOnline = false,
  price,
  priceCurrency = 'INR',
  organizerName,
  organizerUrl,
  availabilityUrl,
} = {}) {
  if (!name) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    eventAttendanceMode: isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  };

  if (description) schema.description = cleanDescription(description, 300);
  if (url) schema.url = absoluteUrl(url);
  if (image) schema.image = [absoluteUrl(image)];
  if (startDate) schema.startDate = startDate;
  if (endDate) schema.endDate = endDate;

  if (location) {
    schema.location = isOnline
      ? { '@type': 'VirtualLocation', url: absoluteUrl(url) }
      : {
          '@type': 'Place',
          name: location,
          address: { '@type': 'PostalAddress', addressLocality: location, addressCountry: 'IN' },
        };
  }

  if (organizerName) {
    schema.organizer = {
      '@type': 'Organization',
      name: organizerName,
      ...(organizerUrl ? { url: absoluteUrl(organizerUrl) } : {}),
    };
  }

  const numericPrice = parsePrice(price);
  if (price != null) {
    schema.offers = {
      '@type': 'Offer',
      price: numericPrice,
      priceCurrency,
      availability: 'https://schema.org/InStock',
      url: availabilityUrl ? absoluteUrl(availabilityUrl) : absoluteUrl(url),
    };
  }

  return schema;
}

/** Parse "Free", "₹499", 499 → a numeric string Google accepts. */
export function parsePrice(price) {
  if (price == null) return '0';
  if (typeof price === 'number') return String(price);
  const str = String(price).trim();
  if (/free/i.test(str) || str === '') return '0';
  const digits = str.replace(/[^\d.]/g, '');
  return digits || '0';
}

/**
 * FAQPage schema for AEO. `items` = [{ question, answer }].
 * Answer engines surface these directly, so keep answers concise and factual.
 */
export function faqSchema(items = []) {
  const valid = items.filter((i) => i && i.question && i.answer);
  if (!valid.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/**
 * ItemList / CollectionPage schema for hub pages (a list of events/links).
 * `items` = [{ name, url }].
 */
export function itemListSchema({ name, description, url, items = [] } = {}) {
  const valid = items.filter((i) => i && i.name && i.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    ...(description ? { description: cleanDescription(description, 300) } : {}),
    ...(url ? { url: absoluteUrl(url) } : {}),
    ...(valid.length
      ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: valid.length,
            itemListElement: valid.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.name,
              url: absoluteUrl(item.url),
            })),
          },
        }
      : {}),
  };
}

/** Generic WebPage schema, linked to the site's Organization/WebSite nodes. */
export function webPageSchema({ name, description, url } = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    ...(description ? { description: cleanDescription(description, 300) } : {}),
    ...(url ? { url: absoluteUrl(url) } : {}),
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
  };
}
