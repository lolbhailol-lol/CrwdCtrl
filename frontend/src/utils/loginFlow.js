const LOGIN_CONTEXT_KEY = 'crwdctrl_login_context';
const LOGIN_MODAL_OPEN_KEY = 'crwdctrl_login_modal_open';

/** Save intent before opening the login modal. */
export function prepareLogin({
    fromProfile = false,
    stayInProfile = false,
    returnPath: explicitReturnPath,
} = {}) {
    const returnPath =
        explicitReturnPath
        || `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
        sessionStorage.setItem(
            LOGIN_CONTEXT_KEY,
            JSON.stringify({
                fromProfile: Boolean(fromProfile),
                stayInProfile: Boolean(stayInProfile),
                returnPath,
            }),
        );
    } catch {
        /* storage unavailable */
    }
}

/** Call before setShowLogin(true) on booking/register pages. */
export function openLoginSheet({ returnPath, fromProfile = false } = {}) {
    prepareLogin({
        fromProfile,
        returnPath: returnPath || currentAppPath(),
    });
}

export function markLoginModalOpen(isOpen) {
    try {
        if (isOpen) sessionStorage.setItem(LOGIN_MODAL_OPEN_KEY, '1');
        else sessionStorage.removeItem(LOGIN_MODAL_OPEN_KEY);
    } catch {
        /* ignore */
    }
}

export function isLoginModalOpen() {
    try {
        return sessionStorage.getItem(LOGIN_MODAL_OPEN_KEY) === '1';
    } catch {
        return false;
    }
}

function pathFromUrl(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return url.startsWith('/') ? url : '/';
    }
}

/**
 * Resolve where to send the user after a fresh login.
 * Returns null when the user should stay on the current page.
 */
export function resolvePostLoginRedirect() {
    try {
        const oauthReturn = sessionStorage.getItem('auth_redirect_url');
        if (oauthReturn) {
            sessionStorage.removeItem('auth_redirect_url');
            return pathFromUrl(oauthReturn);
        }
    } catch {
        /* ignore */
    }

    try {
        const raw = sessionStorage.getItem(LOGIN_CONTEXT_KEY);
        sessionStorage.removeItem(LOGIN_CONTEXT_KEY);
        if (!raw) return null;

        const { returnPath, stayInProfile } = JSON.parse(raw);
        if (stayInProfile) return null;
        if (!returnPath || returnPath === '/profile') return '/';
        return returnPath;
    } catch {
        return null;
    }
}

export function currentAppPath() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
