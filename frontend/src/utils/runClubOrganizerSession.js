const SESSION_KEY = 'run_club_organizer_session';
const MEMORY_FALLBACK_KEY = '__runClubOrganizerSession';

function getMemoryStore() {
    if (typeof window === 'undefined') return null;
    if (!window[MEMORY_FALLBACK_KEY]) {
        window[MEMORY_FALLBACK_KEY] = { value: null };
    }
    return window[MEMORY_FALLBACK_KEY];
}

function readFromStorage(storage) {
    try {
        const raw = storage?.getItem?.(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeToStorage(storage, session) {
    try {
        storage.setItem(SESSION_KEY, JSON.stringify(session));
        return true;
    } catch {
        return false;
    }
}

function removeFromStorage(storage) {
    try {
        storage.removeItem(SESSION_KEY);
    } catch {
        /* ignore */
    }
}

export function getRunClubOrganizerSession() {
    const fromLocal = typeof localStorage !== 'undefined' ? readFromStorage(localStorage) : null;
    if (fromLocal) return fromLocal;

    const fromSession = typeof sessionStorage !== 'undefined' ? readFromStorage(sessionStorage) : null;
    if (fromSession) return fromSession;

    return getMemoryStore()?.value || null;
}

export function setRunClubOrganizerSession(session) {
    const payload = session || null;
    const mem = getMemoryStore();
    if (mem) mem.value = payload;

    if (!payload) {
        clearRunClubOrganizerSession();
        return;
    }

    if (typeof localStorage !== 'undefined' && writeToStorage(localStorage, payload)) return;
    if (typeof sessionStorage !== 'undefined' && writeToStorage(sessionStorage, payload)) return;
}

export function clearRunClubOrganizerSession() {
    if (typeof localStorage !== 'undefined') removeFromStorage(localStorage);
    if (typeof sessionStorage !== 'undefined') removeFromStorage(sessionStorage);
    const mem = getMemoryStore();
    if (mem) mem.value = null;
}

export function getRunClubOrganizerToken() {
    return getRunClubOrganizerSession()?.token || '';
}

/** True when JWT is missing or past exp (client-side check). */
export function isRunClubOrganizerTokenExpired(token = getRunClubOrganizerToken()) {
    if (!token || typeof token !== 'string') return true;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;
        const payload = JSON.parse(atob(parts[1]));
        if (!payload?.exp) return false;
        return payload.exp < Math.floor(Date.now() / 1000);
    } catch {
        return true;
    }
}
