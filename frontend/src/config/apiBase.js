/** Canonical production API — used by native builds and when VITE_API_BASE_URL is unset. */
export const PRODUCTION_API_BASE_URL =
  'https://crwdctrl-production-9c58.up.railway.app/api';

export const LOCAL_DEV_API_BASE_URL = 'http://localhost:8080/api';

const WEB_HOSTS = new Set(['crwdctrl.in', 'www.crwdctrl.in']);

/**
 * Prefer same-origin `/api` on the production web domain so browsers never depend
 * on Railway DNS/CORS (Instagram WebView, flaky mobile resolvers, etc.).
 * Vercel rewrites `/api/*` → Railway (see vercel.json).
 */
function getSameOriginApiBase() {
  if (typeof window === 'undefined') return null;
  const { hostname, origin, protocol } = window.location;
  if (!WEB_HOSTS.has(hostname)) return null;
  // Capacitor / file origins must keep the absolute Railway URL
  if (protocol === 'file:' || protocol === 'capacitor:' || protocol === 'ionic:') return null;
  return `${origin}/api`;
}

/**
 * Single source of truth for API base URL.
 * Production Android builds must embed Railway via .env.production (not .env.production.local).
 */
export function getApiBaseUrl() {
  const sameOrigin = getSameOriginApiBase();
  if (sameOrigin) return sameOrigin;

  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '');
  }
  return import.meta.env.PROD ? PRODUCTION_API_BASE_URL : LOCAL_DEV_API_BASE_URL;
}

export function isLocalApiUrl(url = getApiBaseUrl()) {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(url);
}
