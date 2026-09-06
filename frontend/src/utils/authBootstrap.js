/** True when returning from mobile OAuth redirect (needs Firebase redirect handling). */
export function hasPendingOAuthRedirect() {
    try {
        const redirectType = sessionStorage.getItem('auth_redirect_type');
        const redirectTimestamp = sessionStorage.getItem('auth_redirect_timestamp');
        if (!redirectType || !redirectTimestamp) return false;
        return Date.now() - parseInt(redirectTimestamp, 10) < 300000;
    } catch {
        return false;
    }
}

/**
 * Clear OAuth progress markers.
 * Keep auth_redirect_url by default so post-login can return to the booking form.
 */
export function clearOAuthRedirectMarkers({ keepReturnUrl = true } = {}) {
    try {
        sessionStorage.removeItem('auth_redirect_type');
        sessionStorage.removeItem('auth_redirect_timestamp');
        sessionStorage.removeItem('auth_in_app_browser');
        if (!keepReturnUrl) {
            sessionStorage.removeItem('auth_redirect_url');
        }
    } catch {
        /* ignore */
    }
}

export { restoreSessionFromStorage, persistAuthSession, clearAuthSession } from './authStorage';
