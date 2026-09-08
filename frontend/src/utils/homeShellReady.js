/** Home hub shell — hide footer / bottom nav until Dashboard finishes first paint. */
let homeShellReady = false;

export function isHomeShellReady() {
    return homeShellReady;
}

export function setHomeShellReady(next) {
    homeShellReady = Boolean(next);
    if (typeof document !== 'undefined') {
        if (homeShellReady) {
            delete document.documentElement.dataset.homeHubLoading;
            document.body.classList.remove('page-content-loading');
        } else {
            document.documentElement.dataset.homeHubLoading = '1';
            document.body.classList.add('page-content-loading');
        }
    }
    if (homeShellReady) {
        try {
            window.dispatchEvent(new Event('crwdctrl:home-ready'));
        } catch {
            /* ignore */
        }
    }
}

/** Clear home-hub loading chrome when leaving `/` or `/dashboard`. */
export function resetHomeShellReady() {
    homeShellReady = false;
    if (typeof document !== 'undefined') {
        // Leaving mid-boot used to leave this stuck → whole app looked like endless loading
        delete document.documentElement.dataset.homeHubLoading;
    }
}

export function isHomeHubPath(pathname = '') {
    const path = String(pathname || '');
    return path === '/' || path === '/dashboard';
}
