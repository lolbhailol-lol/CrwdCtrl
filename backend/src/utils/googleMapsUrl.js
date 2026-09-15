/**
 * Normalize Google Maps share / place / short links into embed + open URLs.
 */

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function isGoogleMapsShortLink(value) {
  try {
    const u = new URL(String(value || '').trim());
    return /(^|\.)(goo\.gl|maps\.app\.goo\.gl)$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function isGoogleMapsHost(hostname = '') {
  return /(^|\.)google\./i.test(hostname) || /(^|\.)goo\.gl$/i.test(hostname) || /maps\.app\.goo\.gl/i.test(hostname);
}

/** Extract lat,lng from paths like /@18.53,73.88,17z */
function extractCoords(urlString) {
  const s = String(urlString || '');
  const at = s.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const qll = s.match(/[?&](?:q|query)=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (qll) return { lat: Number(qll[1]), lng: Number(qll[2]) };
  const ll = s.match(/[?&]ll=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (ll) return { lat: Number(ll[1]), lng: Number(ll[2]) };
  return null;
}

function extractQueryParam(urlString, names = ['q', 'query', 'destination']) {
  try {
    const u = new URL(urlString);
    for (const name of names) {
      const v = u.searchParams.get(name);
      if (v && v.trim()) return v.trim();
    }
  } catch {
    /* ignore */
  }
  return '';
}

function extractPlaceName(urlString) {
  try {
    const u = new URL(urlString);
    const m = u.pathname.match(/\/maps\/place\/([^/]+)/i);
    if (m?.[1]) return decodeURIComponent(m[1].replace(/\+/g, ' '));
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * Build a reliable iframe embed URL. Never puts a raw https short-link into q=.
 */
function buildMapsEmbedSrc({ mapUrl = '', query = '', resolvedUrl = '' } = {}) {
  const link = String(resolvedUrl || mapUrl || '').trim();
  const fallback = String(query || '').trim();

  if (link && /output=embed/i.test(link)) return link;
  if (link && /\/maps\/embed/i.test(link)) return link;

  if (link && isHttpUrl(link) && !isGoogleMapsShortLink(link)) {
    const coords = extractCoords(link);
    if (coords) {
      return `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`;
    }
    const qParam = extractQueryParam(link);
    if (qParam) {
      return `https://www.google.com/maps?q=${encodeURIComponent(qParam)}&z=15&output=embed`;
    }
    const place = extractPlaceName(link);
    if (place) {
      return `https://www.google.com/maps?q=${encodeURIComponent(place)}&z=15&output=embed`;
    }
  }

  // Short links / unparsable maps URLs: use human venue query for embed
  if (fallback && !isHttpUrl(fallback)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(fallback)}&z=15&output=embed`;
  }
  if (fallback && isHttpUrl(fallback) && !isGoogleMapsShortLink(fallback)) {
    return buildMapsEmbedSrc({ mapUrl: fallback, query: '' });
  }

  return '';
}

function buildMapsOpenHref({ mapUrl = '', query = '', resolvedUrl = '' } = {}) {
  const link = String(resolvedUrl || mapUrl || '').trim();
  if (link && isHttpUrl(link)) return link;
  const q = String(query || '').trim();
  if (!q) return '';
  if (isHttpUrl(q)) return q;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Follow Google Maps short-link redirects (server-side).
 */
async function resolveGoogleMapsUrl(rawUrl, { timeoutMs = 8000 } = {}) {
  const input = String(rawUrl || '').trim();
  if (!input || !isHttpUrl(input)) {
    return { ok: false, input, resolvedUrl: '', error: 'Invalid URL' };
  }

  if (!isGoogleMapsShortLink(input) && isGoogleMapsHost(new URL(input).hostname)) {
    return { ok: true, input, resolvedUrl: input, expanded: false };
  }

  if (!isGoogleMapsShortLink(input)) {
    return { ok: true, input, resolvedUrl: input, expanded: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrwdCtrlMaps/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const resolvedUrl = res.url || input;
    return { ok: true, input, resolvedUrl, expanded: resolvedUrl !== input };
  } catch (err) {
    return { ok: false, input, resolvedUrl: '', error: err.message || 'Resolve failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveMapsEmbed({ mapUrl = '', query = '' } = {}) {
  const raw = String(mapUrl || '').trim();
  let resolvedUrl = raw;
  let expanded = false;

  if (raw && isGoogleMapsShortLink(raw)) {
    const result = await resolveGoogleMapsUrl(raw);
    if (result.ok && result.resolvedUrl) {
      resolvedUrl = result.resolvedUrl;
      expanded = Boolean(result.expanded);
    }
  }

  const embedSrc = buildMapsEmbedSrc({ mapUrl: raw, query, resolvedUrl });
  const openHref = buildMapsOpenHref({ mapUrl: raw, query, resolvedUrl });

  return {
    embedSrc,
    openHref,
    resolvedUrl,
    expanded,
    query: String(query || '').trim(),
  };
}

module.exports = {
  isHttpUrl,
  isGoogleMapsShortLink,
  extractCoords,
  buildMapsEmbedSrc,
  buildMapsOpenHref,
  resolveGoogleMapsUrl,
  resolveMapsEmbed,
};
