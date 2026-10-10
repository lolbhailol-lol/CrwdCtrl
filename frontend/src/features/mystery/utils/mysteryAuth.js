const TOKEN_KEY = 'mystery_player_token';
const META_KEY = 'mystery_player_meta';
const EVENT_NAME = 'mystery-auth-changed';

export function getMysteryAuthEventName() {
  return EVENT_NAME;
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getMysteryClaims(token) {
  return token ? decodeJwtPayload(token) : null;
}

export function isMysteryTokenExpired(token) {
  const claims = getMysteryClaims(token);
  if (!claims?.exp) return true;
  return claims.exp < Math.floor(Date.now() / 1000);
}

export function readMysteryAuth() {
  try {
    const token = localStorage.getItem(TOKEN_KEY) || null;
    const metaRaw = localStorage.getItem(META_KEY);
    const meta = metaRaw ? JSON.parse(metaRaw) : null;
    return { token, meta };
  } catch {
    return { token: null, meta: null };
  }
}

export function readMysteryAuthMeta() {
  return readMysteryAuth().meta;
}

export function resolveMysteryToken() {
  return readMysteryAuth().token;
}

export function persistMysteryAuth(token, meta = {}) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function clearMysteryAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(META_KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function isMysteryAuthenticated() {
  const { token } = readMysteryAuth();
  return Boolean(token) && !isMysteryTokenExpired(token);
}