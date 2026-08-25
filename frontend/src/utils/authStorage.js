import { storage } from './storage.js';
import { decodeJwtPayload, isBackendUserJwt } from './authToken.js';

const USER_KEY = 'crwdctrl_user';
const TOKEN_KEY = 'crwdctrl_token';

function readDurable(key) {
    try {
        const fromLocal = localStorage.getItem(key);
        if (fromLocal) return fromLocal;
    } catch {
        /* private mode */
    }
    try {
        const fromSession = sessionStorage.getItem(key);
        if (fromSession) return fromSession;
    } catch {
        /* ignore */
    }
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function writeDurable(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* quota / private mode */
    }
    try {
        sessionStorage.setItem(key, value);
    } catch {
        /* ignore */
    }
    try {
        storage.setItem(key, value);
    } catch {
        /* ignore */
    }
}

function removeDurable(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
    try {
        sessionStorage.removeItem(key);
    } catch {
        /* ignore */
    }
    try {
        storage.removeItem(key);
    } catch {
        /* ignore */
    }
}

function userFromToken(token) {
    const payload = decodeJwtPayload(token);
    if (!payload?.userId) return null;
    return {
        _id: payload.userId,
        id: payload.userId,
        email: payload.email || '',
        name: payload.name || '',
    };
}

/** Restore the last Google/email session so they stay signed in on later visits. */
export function restoreSessionFromStorage() {
    try {
        const savedToken = readDurable(TOKEN_KEY) || readDurable('token');
        if (!savedToken || savedToken.startsWith('firebase_')) return null;
        if (!isBackendUserJwt(savedToken)) return null;

        let user = null;
        const savedUser = readDurable(USER_KEY);
        if (savedUser) {
            try {
                user = JSON.parse(savedUser);
            } catch {
                user = null;
            }
        }
        if (!user || typeof user !== 'object') {
            user = userFromToken(savedToken);
        }
        if (!user) return null;
        return { user, token: savedToken };
    } catch {
        return null;
    }
}

export function persistAuthSession(user, token) {
    if (!user || !token) return;
    try {
        writeDurable(USER_KEY, JSON.stringify(user));
        writeDurable(TOKEN_KEY, token);
        writeDurable('token', token);
    } catch {
        /* ignore */
    }
}

export function clearAuthSession() {
    removeDurable(USER_KEY);
    removeDurable(TOKEN_KEY);
    removeDurable('token');
}
