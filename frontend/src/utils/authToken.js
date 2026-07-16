import { storage } from './storage';
import { AUTH_CONFIG } from '../config/env';

const USER_KEY = 'crwdctrl_user';

/** Resolve a usable backend JWT for API calls (skips expired / firebase fallback tokens). */

function isJwtLike(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('firebase_')) return false;
  return value.split('.').length === 3;
}

export function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload?.exp) return false;
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

/**
 * Best available JWT — context first, then localStorage, then token embedded in user JSON.
 * Prefers non-expired tokens; falls back to the best available JWT so the server can decide.
 */
export function resolveAuthToken(contextToken = null) {
  const candidates = [];

  if (isJwtLike(contextToken)) candidates.push(contextToken);

  try {
    const stored = storage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (isJwtLike(stored)) candidates.push(stored);

    const legacy = storage.getItem('token');
    if (isJwtLike(legacy)) candidates.push(legacy);

    const userRaw = storage.getItem(USER_KEY);
    if (userRaw) {
      const user = JSON.parse(userRaw);
      if (isJwtLike(user?.token)) candidates.push(user.token);
    }
  } catch {
    /* ignore storage errors */
  }

  const seen = new Set();
  let expiredFallback = null;
  for (const token of candidates) {
    if (seen.has(token)) continue;
    seen.add(token);
    if (!isTokenExpired(token)) return token;
    if (!expiredFallback) expiredFallback = token;
  }

  return expiredFallback;
}

export function hasUsableAuthToken(contextToken = null) {
  const token = resolveAuthToken(contextToken);
  return !!token && !isTokenExpired(token);
}

export function getBearerAuthHeaders(contextToken = null) {
  const token = resolveAuthToken(contextToken);
  if (!token) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function clearStoredAuthSession() {
  try {
    storage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    storage.removeItem(USER_KEY);
    storage.removeItem('token');
  } catch {
    /* ignore */
  }
}
