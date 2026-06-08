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

/** Sync restore from localStorage — safe for initial paint when not on OAuth return. */
export function restoreSessionFromStorage() {
    try {
        const savedUser = localStorage.getItem('crwdctrl_user');
        const savedToken = localStorage.getItem('crwdctrl_token');
        if (!savedUser || !savedToken || savedToken.startsWith('firebase_')) return null;
        return { user: JSON.parse(savedUser), token: savedToken };
    } catch {
        return null;
    }
}
