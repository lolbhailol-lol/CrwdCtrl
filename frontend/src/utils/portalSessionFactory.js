/**
 * Small factory that captures the identical read/write/expiry pattern used by
 * every organizer portal (fest, trek, run-club, event-show).
 *
 * Every variant used to be a copy of the same 60-line module; extracting the
 * factory keeps public exports intact — call sites don't change — and adds a
 * memory fallback so the portal keeps working when localStorage/sessionStorage
 * are blocked (Safari private mode, some Capacitor edge cases).
 */

function readFromStorage(storage, key) {
    try {
        const raw = storage?.getItem?.(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeToStorage(storage, key, session) {
    try {
        storage.setItem(key, JSON.stringify(session));
        return true;
    } catch {
        return false;
    }
}

function removeFromStorage(storage, key) {
    try {
        storage.removeItem(key);
    } catch {
        /* ignore */
    }
}

/**
 * Build a portal session module.
 * @param {object} config
 * @param {string} config.storageKey  localStorage/sessionStorage key.
 * @param {string} [config.memoryKey] window-scoped fallback key for private/blocked storage.
 * @returns {{
 *   get:    () => object | null,
 *   set:    (session: object | null) => void,
 *   clear:  () => void,
 *   token:  () => string,
 *   isExpired: (token?: string) => boolean,
 * }}
 */
export function createPortalSession({ storageKey, memoryKey }) {
    function getMemoryStore() {
        if (!memoryKey || typeof window === 'undefined') return null;
        if (!window[memoryKey]) window[memoryKey] = { value: null };
        return window[memoryKey];
    }

    function get() {
        if (typeof localStorage !== 'undefined') {
            const fromLocal = readFromStorage(localStorage, storageKey);
            if (fromLocal) return fromLocal;
        }
        if (typeof sessionStorage !== 'undefined') {
            const fromSession = readFromStorage(sessionStorage, storageKey);
            if (fromSession) return fromSession;
        }
        return getMemoryStore()?.value || null;
    }

    function set(session) {
        const payload = session || null;
        const mem = getMemoryStore();
        if (mem) mem.value = payload;
        if (!payload) {
            clear();
            return;
        }
        if (typeof localStorage !== 'undefined' && writeToStorage(localStorage, storageKey, payload)) return;
        if (typeof sessionStorage !== 'undefined') writeToStorage(sessionStorage, storageKey, payload);
    }

    function clear() {
        if (typeof localStorage !== 'undefined') removeFromStorage(localStorage, storageKey);
        if (typeof sessionStorage !== 'undefined') removeFromStorage(sessionStorage, storageKey);
        const mem = getMemoryStore();
        if (mem) mem.value = null;
    }

    function token() {
        return get()?.token || '';
    }

    function isExpired(candidate = token()) {
        if (!candidate || typeof candidate !== 'string') return true;
        try {
            const parts = candidate.split('.');
            if (parts.length !== 3) return true;
            const payload = JSON.parse(atob(parts[1]));
            if (!payload?.exp) return false;
            return payload.exp < Math.floor(Date.now() / 1000);
        } catch {
            return true;
        }
    }

    return { get, set, clear, token, isExpired };
}
