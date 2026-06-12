export const CHUNK_RELOAD_SESSION_KEY = 'crwdctrl_chunk_reload';

export function isChunkLoadError(error) {
    if (!error) return false;
    const message = String(error.message || error);
    return (
        error.name === 'ChunkLoadError'
        || message.includes('Failed to fetch dynamically imported module')
        || message.includes('Importing a module script failed')
        || message.includes('error loading dynamically imported module')
        || message.includes('Loading chunk')
    );
}

/** Reload once per session when a stale JS chunk fails after deploy */
export function reloadOnceForChunkError() {
    try {
        if (sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) return false;
        sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
        window.location.reload();
        return true;
    } catch {
        window.location.reload();
        return true;
    }
}

export function clearChunkReloadFlag() {
    try {
        sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
        sessionStorage.removeItem('crwdctrl_sw_reload');
    } catch {
        // ignore storage errors
    }
}

export function initGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('unhandledrejection', (event) => {
        if (!isChunkLoadError(event.reason)) return;
        event.preventDefault();
        reloadOnceForChunkError();
    });

    window.addEventListener('error', (event) => {
        if (!isChunkLoadError(event.error || event.message)) return;
        event.preventDefault();
        reloadOnceForChunkError();
    });
}
