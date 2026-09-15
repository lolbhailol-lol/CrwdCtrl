const PROMPT_ATTEMPTED_KEY = 'crwdctrl_notif_prompt_attempted';
const FRESH_LOGIN_KEY = 'crwdctrl_fresh_login';

/** Call when the user actively signs in (not on session restore). */
export function markFreshLogin() {
    try {
        sessionStorage.setItem(FRESH_LOGIN_KEY, '1');
        window.dispatchEvent(new Event('crwdctrl:user-login'));
    } catch {
        /* storage unavailable */
    }
}

function consumeFreshLogin() {
    try {
        const isFresh = sessionStorage.getItem(FRESH_LOGIN_KEY) === '1';
        sessionStorage.removeItem(FRESH_LOGIN_KEY);
        return isFresh;
    } catch {
        return false;
    }
}

export function hasAttemptedNotificationPrompt() {
    try {
        return localStorage.getItem(PROMPT_ATTEMPTED_KEY) === '1';
    } catch {
        return false;
    }
}

export function markNotificationPromptAttempted() {
    try {
        localStorage.setItem(PROMPT_ATTEMPTED_KEY, '1');
    } catch {
        /* storage unavailable */
    }
}

export function canOfferBrowserNotifications() {
    try {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
        return Notification.permission === 'default';
    } catch {
        return false;
    }
}

/** True only once — on the first login when we have not asked before. */
export function shouldPromptForNotifications() {
    if (hasAttemptedNotificationPrompt()) return false;
    return consumeFreshLogin();
}
