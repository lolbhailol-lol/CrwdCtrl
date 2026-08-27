export const CHUNK_RELOAD_SESSION_KEY = 'crwdctrl_chunk_reload';
const STALE_RECOVER_AT_KEY = 'crwdctrl_stale_recover_at';
export const STALE_RECOVER_COOLDOWN_MS = 60_000;

/** gtag.js / Firebase Analytics: config missing, then every fetch throws `undefined.M_ID`. */
export function isGtagMeasurementIdError(error) {
    const message = String(error?.message || error || '');
    return /reading ['"]M_ID['"]/i.test(message);
}

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
export function shouldAttemptStaleRecover(now = Date.now(), lastAt = 0, cooldownMs = STALE_RECOVER_COOLDOWN_MS) {
    return !lastAt || (now - lastAt) >= cooldownMs;
}

export async function recoverFromStaleDeploy() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (typeof window !== 'undefined' && String(window.location?.pathname || '').startsWith('/campus-hunt/offline')) {
        return;
    }
    try {
        const lastAt = Number(sessionStorage.getItem(STALE_RECOVER_AT_KEY) || 0);
        if (!shouldAttemptStaleRecover(Date.now(), lastAt)) return;
        sessionStorage.setItem(STALE_RECOVER_AT_KEY, String(Date.now()));
    } catch {
        /* private mode */
    }
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

    const url = new URL(window.location.href);
    if (url.searchParams.has('_crwd')) return;
    url.searchParams.set('_crwd', String(Date.now()));
    window.location.replace(url.toString());
}

/** Reload once per session when a stale JS chunk fails after deploy */
export function reloadOnceForChunkError() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    if (typeof window !== 'undefined' && String(window.location?.pathname || '').startsWith('/campus-hunt/offline')) {
        return false;
    }
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
        sessionStorage.removeItem(STALE_RECOVER_AT_KEY);
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
        if (isGtagMeasurementIdError(event.reason)) {
            event.preventDefault();
            return;
        }
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

