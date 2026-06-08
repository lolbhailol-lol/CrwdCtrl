/** Brief branded splash on hard refresh — skipped during OAuth/email flows */
export function shouldShowRefreshSplash() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (
            urlParams.has('apiKey') ||
            urlParams.has('oobCode') ||
            window.location.hash.includes('access_token') ||
            urlParams.has('state') ||
            urlParams.has('code')
        ) {
            return false;
        }

        const [nav] = performance.getEntriesByType?.('navigation') ?? [];
        if (nav?.type === 'reload') return true;
        if (performance.navigation?.type === 1) return true;

        return false;
    } catch {
        return false;
    }
}

/** Long enough to read the logo; short enough to feel snappy */
export const REFRESH_SPLASH_MS = 450;
