/** Canonical production API — used when VITE_API_BASE_URL is unset in prod builds. */
export const PRODUCTION_API_BASE_URL =
  'https://crwdctrl-production-9c58.up.railway.app/api';

export const LOCAL_DEV_API_BASE_URL = 'http://localhost:8080/api';

/**
 * Single source of truth for API base URL.
 * Production Android builds must embed Railway via .env.production (not .env.production.local).
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '');
  }
  return import.meta.env.PROD ? PRODUCTION_API_BASE_URL : LOCAL_DEV_API_BASE_URL;
}

export function isLocalApiUrl(url = getApiBaseUrl()) {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(url);
}
