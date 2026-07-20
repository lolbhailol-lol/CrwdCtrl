/** Canonical production API — used by native builds and when VITE_API_BASE_URL is unset. */
export const PRODUCTION_API_BASE_URL =
  'https://crwdctrl-production-9c58.up.railway.app/api';

export const LOCAL_DEV_API_BASE_URL = 'http://localhost:8080/api';

const WEB_HOSTS = new Set(['crwdctrl.in', 'www.crwdctrl.in']);

/**
 * Same-origin `/api` on the production web domain (Vercel → Railway rewrite).
 * Used as a fallback candidate — never as the only primary until the rewrite is live.
 */
export function getSameOriginApiBase() {
  if (typeof window === 'undefined') return null;
  const { hostname, origin, protocol } = window.location;
  if (!WEB_HOSTS.has(hostname)) return null;
  if (protocol === 'file:' || protocol === 'capacitor:' || protocol === 'ionic:') return null;
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

/** Ordered bases for resilient public fetches: Railway first, then same-origin proxy. */
export function getApiBaseCandidates() {
  const primary = getApiBaseUrl();
  const sameOrigin = getSameOriginApiBase();
  const bases = [primary];
  if (sameOrigin && sameOrigin !== primary) bases.push(sameOrigin);
  if (primary !== PRODUCTION_API_BASE_URL && !bases.includes(PRODUCTION_API_BASE_URL)) {
    bases.push(PRODUCTION_API_BASE_URL);
  }
  return bases;
}

export function isLocalApiUrl(url = getApiBaseUrl()) {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(url);
}
