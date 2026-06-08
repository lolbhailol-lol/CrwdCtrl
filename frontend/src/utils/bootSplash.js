/** Skip splash during OAuth / email verification returns */
function hasAuthCallbackParams() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        return (
            urlParams.has('apiKey') ||
            urlParams.has('oobCode') ||
            window.location.hash.includes('access_token') ||
            urlParams.has('state') ||
            urlParams.has('code')
        );
    } catch {
        return false;
    }
}

/**
 * Show branded splash on first open (navigate) and refresh — not on back/forward.
 */
export function shouldShowBootSplash() {
    try {
        if (hasAuthCallbackParams()) return false;

        const [nav] = performance.getEntriesByType?.('navigation') ?? [];
        if (nav?.type === 'reload' || nav?.type === 'navigate') return true;
        if (nav?.type === 'back_forward') return false;

        // Legacy Navigation Timing API
        const legacyType = performance.navigation?.type;
        if (legacyType === 0 || legacyType === 1) return true;

        return true;
    } catch {
        return true;
    }
}

export function removeHtmlBootSplash() {
    document.getElementById('boot-splash')?.remove();
}

/** Long enough to read the logo; short enough to feel snappy */
export const BOOT_SPLASH_MS = 450;
