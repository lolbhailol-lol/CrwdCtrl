import { storage } from '../../../utils/storage';
import { AUTH_CONFIG } from '../../../config/env';
import {
  decodeJwtPayload,
  getHuntJwtClaims,
  isHuntEnrollmentJwt,
  isJwtLike,
} from '../../../utils/authToken';

const TOKEN_KEY = 'campus_hunt_player_token';
const META_KEY = 'campus_hunt_player_meta';
const AUTH_EVENT = 'campus-hunt:auth-changed';

function broadcastAuthChanged() {
  try {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT));
  } catch {
    /* ignore */
  }
}

export function isHuntTokenExpired(token) {
  if (!isJwtLike(token) || !isHuntEnrollmentJwt(token)) return true;
  try {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return false;
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

/** Move legacy hunt JWT out of platform storage (pre-split sessions). */
export function migrateLegacyHuntTokenFromPlatform() {
  if (typeof window === 'undefined') return;
  try {
    if (storage.getItem(TOKEN_KEY)) return;

    const platformKey = AUTH_CONFIG.TOKEN_KEY || 'crwdctrl_token';
    const legacy = storage.getItem(platformKey) || storage.getItem('token');
    if (!legacy || !isHuntEnrollmentJwt(legacy)) return;

    storage.setItem(TOKEN_KEY, legacy);
    storage.removeItem(platformKey);
    storage.removeItem('token');

    const userRaw = storage.getItem('crwdctrl_user');
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user?.token === legacy || user?.huntRole) {
          storage.setItem(META_KEY, JSON.stringify({
            slug: '',
            teamCode: '',
            myName: user.name || '',
            role: user.huntRole || '',
          }));
          storage.removeItem('crwdctrl_user');
        }
      } catch {
        /* ignore */
      }
    }
    broadcastAuthChanged();
  } catch {
    /* ignore */
  }
}

export function readHuntAuthMeta() {
  migrateLegacyHuntTokenFromPlatform();
  try {
    const raw = storage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readHuntAuthToken() {
  migrateLegacyHuntTokenFromPlatform();
  const token = storage.getItem(TOKEN_KEY);
  if (!token || !isHuntEnrollmentJwt(token)) return null;
  if (isHuntTokenExpired(token)) {
    clearHuntAuth();
    return null;
  }
  return token;
}

export function readHuntAuth() {
  const token = readHuntAuthToken();
  const meta = readHuntAuthMeta();
  if (!token) return { token: null, meta: null };
  return { token, meta };
}

export function persistHuntAuth(token, meta = {}) {
  if (!token || !isHuntEnrollmentJwt(token)) return;
  storage.setItem(TOKEN_KEY, token);
  if (meta && Object.keys(meta).length > 0) {
    storage.setItem(META_KEY, JSON.stringify(meta));
  }
  broadcastAuthChanged();
}

export function clearHuntAuth() {
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(META_KEY);
  broadcastAuthChanged();
}

export function resolveHuntToken() {
  return readHuntAuthToken();
}

export function getHuntClaims(token = resolveHuntToken()) {
  if (!token) return null;
  return getHuntJwtClaims(token);
}

export function isHuntAuthenticated() {
  return !!resolveHuntToken();
}

export function getHuntAuthEventName() {
  return AUTH_EVENT;
}
