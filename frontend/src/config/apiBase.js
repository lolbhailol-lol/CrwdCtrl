/** Canonical production API — used by native builds and as fallback when same-origin proxy fails. */
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

function envApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '');
  }
  return '';
}

/**
 * Single source of truth for API base URL.
 * On www/apex production web: prefer same-origin `/api` so login never depends on
 * cross-origin Railway (CORS / cold-start "Failed to fetch"). Railway stays as fallback.
 */
export function getApiBaseUrl() {
  if (import.meta.env.PROD) {
    const sameOrigin = getSameOriginApiBase();
    if (sameOrigin) return sameOrigin;
  }

  const fromEnv = envApiBase();
  if (fromEnv) return fromEnv;

  if (import.meta.env.PROD) {
    return PRODUCTION_API_BASE_URL;
  }
  return LOCAL_DEV_API_BASE_URL;
}

/**
 * Ordered bases for resilient fetches (login / public / organizer).
 * Prefer www `/api`, then Railway direct.
 */
export function getApiBaseCandidates() {
  const primary = getApiBaseUrl();
  const siteApi = getSameOriginApiBase();
  const fromEnv = envApiBase();
  const bases = [];

  if (siteApi) bases.push(siteApi);
  if (primary && !bases.includes(primary)) bases.push(primary);
  if (fromEnv && !bases.includes(fromEnv)) bases.push(fromEnv);
  if (!bases.includes(PRODUCTION_API_BASE_URL)) bases.push(PRODUCTION_API_BASE_URL);
  if (typeof window !== 'undefined' && window.location.hostname === 'www.crwdctrl.in') {
    if (!bases.includes(`${window.location.origin}/api`)) {
      bases.unshift(`${window.location.origin}/api`);
    }
  }

  return [...new Set(bases.filter(Boolean))];
}

export function isLocalApiUrl(url = getApiBaseUrl()) {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(url);
}
