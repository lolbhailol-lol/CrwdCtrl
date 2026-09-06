import { storage } from './storage.js';
import { AUTH_CONFIG } from '../config/env.js';

const USER_KEY = 'crwdctrl_user';

/** Resolve a usable backend JWT for API calls (skips expired / firebase fallback tokens). */

export function isJwtLike(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('firebase_')) return false;
  return value.split('.').length === 3;
}

/** Hunt team enrollment JWT — must not be used as platform session. */
export function isHuntEnrollmentJwt(token) {
  if (!isJwtLike(token)) return false;
  const payload = decodeJwtPayload(token);
  if (!payload?.userId) return false;
  if (payload.tokenType === 'hunt' || payload.aud === 'campus-hunt') return true;
  return !!(payload.huntEventId && payload.huntTeamId);
}

export function decodeJwtPayload(token) {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/** Hunt player JWT claims (team login) — used to skip the event-slug waterfall. */
export function getHuntJwtClaims(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.userId || !payload?.huntEventId) return null;
  return {
    userId: String(payload.userId),
    huntEventId: String(payload.huntEventId),
    huntTeamId: payload.huntTeamId ? String(payload.huntTeamId) : '',
    huntRole: payload.huntRole || '',
  };
}

/** CrwdCtrl user session JWT — must carry userId (not hunt enrollment or special tokens). */
export function isBackendUserJwt(token) {
  if (!isJwtLike(token)) return false;
  if (isHuntEnrollmentJwt(token)) return false;
  const payload = decodeJwtPayload(token);
  return !!payload?.userId;
}

export function isTokenExpired(token) {
  if (!isBackendUserJwt(token)) return true;
  try {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return false;
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

function collectUserJwtCandidates(contextToken = null) {
  const candidates = [];

  if (isBackendUserJwt(contextToken)) candidates.push(contextToken);

  try {
    const durable = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (isBackendUserJwt(durable)) candidates.push(durable);
  } catch {
    /* private mode */
  }

  try {
    const stored = storage.getItem(AUTH_CONFIG.TOKEN_KEY);
    if (isBackendUserJwt(stored)) candidates.push(stored);

    const legacy = storage.getItem('token');
    if (isBackendUserJwt(legacy)) candidates.push(legacy);

    const userRaw = storage.getItem(USER_KEY);
    if (userRaw) {
      const user = JSON.parse(userRaw);
      if (isBackendUserJwt(user?.token)) candidates.push(user.token);
    }
  } catch {
    /* ignore storage errors */
  }

  return candidates;
}

/**
 * Best available platform user JWT — context first, then storage.
 * Prefers non-expired tokens; falls back to expired user JWT for silent refresh.
 * Hunt enrollment tokens are excluded — use huntAuth.resolveHuntToken() for hunt APIs.
 */
export function resolveAuthToken(contextToken = null) {
  const seen = new Set();
  let expiredFallback = null;

  for (const token of collectUserJwtCandidates(contextToken)) {
    if (seen.has(token)) continue;
    seen.add(token);
    if (isHuntEnrollmentJwt(token)) continue;
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

export function isAuthFailureMessage(message = '') {
  const text = String(message).toLowerCase();
  return (
    text.includes('invalid token')
    || text.includes('token has expired')
    || text.includes('session expired')
    || text.includes('access token is required')
    || text.includes('authentication failed')
    || text.includes('please log in')
    || text.includes('user no longer exists')
  );
}
