export const CHUNK_RELOAD_SESSION_KEY = 'crwdctrl_chunk_reload';

export function isChunkLoadError(error) {
    if (!error) return false;
    const message = String(error.message || error);
    const filename = String(error.filename || error.target?.src || '');

    // Vercel SPA rewrite can serve index.html (200) for missing /assets/*.js after deploy
    const isAssetScriptFailure = filename.includes('/assets/')
        && (
            message.includes("Unexpected token '<'")
            || message.includes('Unexpected token \'<\'')
            || message.includes('text/html')
            || message.includes('MIME type')
        );

    return (
        error.name === 'ChunkLoadError'
        || isAssetScriptFailure
        || message.includes('Failed to fetch dynamically imported module')
        || message.includes('Importing a module script failed')
        || message.includes('error loading dynamically imported module')
        || message.includes('Loading chunk')
        || message.includes('Unable to preload CSS')
        || message.includes("Unexpected token '<'")
        || message.includes('Unexpected token \'<\'')
    );
}

/** Hard recovery after deploy — drop stale service worker caches and reload fresh HTML */
export async function recoverFromStaleDeploy() {
    try {
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        }
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
        }
    } catch {
        /* ignore cleanup errors */
    }

    try {
        sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
        sessionStorage.removeItem('crwdctrl_sw_reload');
        sessionStorage.removeItem('crwdctrl_boot_recover');
    } catch {
        /* ignore */
    }

    const url = new URL(window.location.href);
    url.searchParams.set('_crwd', String(Date.now()));
    window.location.replace(url.toString());
}

/** Reload once per session when a stale JS chunk fails after deploy */
export function reloadOnceForChunkError() {
    try {
        if (sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) {
            void recoverFromStaleDeploy();
            return false;
        }
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
        sessionStorage.removeItem('crwdctrl_boot_recover');
    } catch {
        // ignore storage errors
    }
}

function handleScriptLoadFailure(event) {
    const target = event?.target;
    if (!target || target.tagName !== 'SCRIPT') return false;
    const src = target.src || '';
    if (!src.includes('/assets/') && !src.endsWith('.js')) return false;
    reloadOnceForChunkError();
    return true;
}

export function initGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('unhandledrejection', (event) => {
        if (!isChunkLoadError(event.reason)) return;
        event.preventDefault();
        reloadOnceForChunkError();
    });

    window.addEventListener('error', (event) => {
        if (handleScriptLoadFailure(event)) {
            event.preventDefault();
            return;
        }
        if (!isChunkLoadError(event.error || event.message)) return;
        event.preventDefault();
        reloadOnceForChunkError();
    }, true);
}

