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
    const stored = localStorage.getItem('crwdctrl_token');
    if (isJwtLike(stored)) candidates.push(stored);

    const legacy = localStorage.getItem('token');
    if (isJwtLike(legacy)) candidates.push(legacy);

    const userRaw = localStorage.getItem('crwdctrl_user');
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
    localStorage.removeItem('crwdctrl_token');
    localStorage.removeItem('crwdctrl_user');
    localStorage.removeItem('token');
  } catch {
    /* ignore */
  }
}
