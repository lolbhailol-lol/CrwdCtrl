/** Canonical production API — used by native builds and when VITE_API_BASE_URL is unset. */
export const PRODUCTION_API_BASE_URL =
  'https://crwdctrl-production-9c58.up.railway.app/api';

export const LOCAL_DEV_API_BASE_URL = 'http://localhost:8080/api';

const WEB_HOSTS = new Set(['crwdctrl.in', 'www.crwdctrl.in']);
const WWW_API_BASE = 'https://www.crwdctrl.in/api';

/**
 * Instagram / Facebook / WhatsApp / Line / Telegram in-app browsers.
 * These often block or mishandle cross-origin XHR to railway.app.
 */
export function isInAppBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const s = String(ua || '');
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\/|WhatsApp|Telegram|Twitter|LinkedInApp|Snapchat|Pinterest|TikTok|BytedanceWebview|MicroMessenger/i.test(s);
}

/**
 * Apex crwdctrl.in 307-redirects at the CDN. Do NOT hard-navigate in JS —
 * Instagram / FB WebViews often fail location.replace and leave a black shell
 * (bottom nav only). Keep this as a no-op so the app always mounts.
 */
export function forceWwwHost() {
  return false;
}

/**
 * Preferred API base for the marketing site.
 * - www → same-origin `/api` (Vercel→Railway rewrite; Instagram-safe)
 * - apex → www `/api` (apex `/api` 307s and drops POST bodies)
 */
export function getSameOriginApiBase() {
  if (typeof window === 'undefined') return null;
  const { hostname, protocol, origin } = window.location;
  if (!WEB_HOSTS.has(hostname)) return null;
  if (protocol === 'file:' || protocol === 'capacitor:' || protocol === 'ionic:') return null;
  // Apex POST /api is 307'd to www — never use apex origin for API
  if (hostname === 'crwdctrl.in') return WWW_API_BASE;
  return `${origin}/api`;
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
 * Prefer www `/api` (or same-origin on www), then Railway.
 */
export function getApiBaseCandidates() {
  const primary = getApiBaseUrl();
  const siteApi = getSameOriginApiBase();
  const bases = [];

  if (siteApi) bases.push(siteApi);
  // On apex, also try relative /api only after www — usually 307 fails for POST
  if (typeof window !== 'undefined' && window.location.hostname === 'www.crwdctrl.in') {
    // already covered by siteApi
  } else if (siteApi === WWW_API_BASE && !bases.includes(WWW_API_BASE)) {
    bases.push(WWW_API_BASE);
  }

  if (!bases.includes(primary)) bases.push(primary);
  if (primary !== PRODUCTION_API_BASE_URL && !bases.includes(PRODUCTION_API_BASE_URL)) {
    bases.push(PRODUCTION_API_BASE_URL);
  }

  return [...new Set(bases.filter(Boolean))];
}

export function isLocalApiUrl(url = getApiBaseUrl()) {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(url);
}
