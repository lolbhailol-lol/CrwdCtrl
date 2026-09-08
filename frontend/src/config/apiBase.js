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
 * Preferred API base for the marketing site (Instagram-safe when Caddy proxies /api).
 * - www → same-origin `/api` (Caddy → Railway backend)
 * - apex → www `/api` (avoid apex DNS/TLS gaps dropping POSTs)
 */
export function getSameOriginApiBase() {
  if (typeof window === 'undefined') return null;
  const { hostname, protocol, origin } = window.location;
  if (!WEB_HOSTS.has(hostname)) return null;
  if (protocol === 'file:' || protocol === 'capacitor:' || protocol === 'ionic:') return null;
  // Apex may lack a valid cert / DNS — always prefer www for API
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
 * WhatsApp / Instagram: prefer same-origin `/api` (Caddy proxy) — direct Railway
 * CORS often hangs those WebViews on the event “Loading…” screen.
 */
export function getApiBaseUrl() {
  const sameOrigin = getSameOriginApiBase();
  if (sameOrigin) return sameOrigin;

  const fromEnv = envApiBase();
  if (fromEnv) return fromEnv;

  if (import.meta.env.PROD) {
    return PRODUCTION_API_BASE_URL;
  }
  return LOCAL_DEV_API_BASE_URL;
}

/**
 * Ordered bases for resilient fetches (login / public / organizer / payments).
 * www / apex: same-origin `/api` first — Google Chrome and in-app browsers abort
 * cross-origin Railway calls when a boot reload is in flight.
 */
export function getApiBaseCandidates() {
  const primary = getApiBaseUrl();
  const siteApi = getSameOriginApiBase();
  const fromEnv = envApiBase();
  const wwwApi = typeof window !== 'undefined' && window.location.hostname === 'www.crwdctrl.in'
    ? `${window.location.origin}/api`
    : null;

  if (siteApi) {
    return [...new Set([
      siteApi,
      wwwApi,
      fromEnv,
      primary,
      PRODUCTION_API_BASE_URL,
    ].filter(Boolean))];
  }

  if (typeof window !== 'undefined' && isInAppBrowser()) {
    return [...new Set([
      siteApi,
      wwwApi,
      fromEnv,
      primary,
      PRODUCTION_API_BASE_URL,
    ].filter(Boolean))];
  }

  const bases = [];
  if (fromEnv) bases.push(fromEnv);
  if (primary && !bases.includes(primary)) bases.push(primary);
  if (!bases.includes(PRODUCTION_API_BASE_URL)) bases.push(PRODUCTION_API_BASE_URL);
  if (wwwApi && !bases.includes(wwwApi)) bases.push(wwwApi);

  return [...new Set(bases.filter(Boolean))];
}

export function isLocalApiUrl(url = getApiBaseUrl()) {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(url);
}
