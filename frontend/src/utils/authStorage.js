import { storage } from './storage';
import { AUTH_CONFIG } from '../config/env';

const USER_KEY = 'crwdctrl_user';

/** Sync restore — uses unified storage (localStorage → sessionStorage → memory). */
export function restoreSessionFromStorage() {
    try {
        const savedUser = storage.getItem(USER_KEY);
        const savedToken = storage.getItem(AUTH_CONFIG.TOKEN_KEY);
        if (!savedUser || !savedToken || savedToken.startsWith('firebase_')) return null;
        return { user: JSON.parse(savedUser), token: savedToken };
    } catch {
        return null;
    }
}

export function persistAuthSession(user, token) {
    if (!user || !token) return;
    try {
        storage.setItem(USER_KEY, JSON.stringify(user));
        storage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
    } catch {
        /* ignore */
    }
}

export function clearAuthSession() {
    try {
        storage.removeItem(USER_KEY);
        storage.removeItem(AUTH_CONFIG.TOKEN_KEY);
        storage.removeItem('token');
    } catch {
        /* ignore */
    }
}
