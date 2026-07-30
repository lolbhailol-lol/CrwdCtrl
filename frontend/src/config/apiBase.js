/** Canonical production API — used by native builds and when VITE_API_BASE_URL is unset. */
export const PRODUCTION_API_BASE_URL =
  'https://crwdctrl-production-9c58.up.railway.app/api';

export const LOCAL_DEV_API_BASE_URL = 'http://localhost:8080/api';

const WEB_HOSTS = new Set(['crwdctrl.in', 'www.crwdctrl.in']);

/**
 * Instagram / Facebook / WhatsApp / Line / Telegram in-app browsers.
 * These often block or mishandle cross-origin XHR to railway.app.
 */
export function isInAppBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const s = String(ua || '');
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\/|WhatsApp|Telegram|Twitter|LinkedInApp|Snapchat|Pinterest|TikTok|BytedanceWebview|MicroMessenger/i.test(s);
}

/**
 * Apex crwdctrl.in 307-redirects every request (including POST /api) to www,
 * which drops POST bodies in many WebViews. Call once at boot on web.
 */
export function forceWwwHost() {
  if (typeof window === 'undefined') return false;
  try {
    const { hostname, protocol, pathname, search, hash } = window.location;
    if (hostname !== 'crwdctrl.in') return false;
    if (protocol === 'file:' || protocol === 'capacitor:' || protocol === 'ionic:') return false;
    window.location.replace(`https://www.crwdctrl.in${pathname}${search}${hash}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Same-origin `/api` on the production web domain (Vercel → Railway rewrite).
 * Uses the current origin (relative) so Instagram WebViews never cross-origin
 * for the primary path. Prefer www via forceWwwHost() before calling APIs.
 */
export function getSameOriginApiBase() {
  if (typeof window === 'undefined') return null;
  const { hostname, protocol, origin } = window.location;
  if (!WEB_HOSTS.has(hostname)) return null;
  if (protocol === 'file:' || protocol === 'capacitor:' || protocol === 'ionic:') return null;
  // Relative `/api` stays on the exact host the page loaded — no apex→www hop mid-POST
  if (hostname === 'www.crwdctrl.in' || hostname === 'crwdctrl.in') {
    return `${origin}/api`;
  }
  return null;
}

/**
 * Single source of truth for API base URL.
 * Prefer VITE_API_BASE_URL (Railway) so admin/organizer creates keep working even if
 * the Vercel `/api` proxy rewrite is missing or returning the SPA HTML shell.
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '');
  }
  if (import.meta.env.PROD) {
    return getSameOriginApiBase() || PRODUCTION_API_BASE_URL;
  }
  return LOCAL_DEV_API_BASE_URL;
}

/**
 * Ordered bases for resilient public fetches.
 * On crwdctrl.in / www, prefer same-origin `/api` first —
 * Instagram / WhatsApp / FB in-app browsers often block direct railway.app XHR
 * (and Helmet CORP used to make that fail even when CORS allowed it).
 * Then Railway direct as fallback.
 */
export function getApiBaseCandidates() {
  const primary = getApiBaseUrl();
  const sameOrigin = getSameOriginApiBase();
  const bases = [];

  // Always try true same-origin first on the marketing site (Instagram-safe)
  if (sameOrigin) bases.push(sameOrigin);

  // In-app browsers: skip putting Railway early when same-origin exists —
  // only use it as last resort after same-origin fails.
  if (!bases.includes(primary)) bases.push(primary);
  if (primary !== PRODUCTION_API_BASE_URL && !bases.includes(PRODUCTION_API_BASE_URL)) {
    bases.push(PRODUCTION_API_BASE_URL);
  }

  // Dedupe while preserving order
  return [...new Set(bases.filter(Boolean))];
}

export function isLocalApiUrl(url = getApiBaseUrl()) {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(url);
}
