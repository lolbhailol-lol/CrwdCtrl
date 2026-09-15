/** Helpers for Instagram / Facebook / WhatsApp in-app browsers. */

export function detectInAppBrowserName(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
    const s = String(ua || '');
    if (/Barcelona/i.test(s)) return 'Threads';
    if (/Instagram/i.test(s)) return 'Instagram';
    if (/FBAN|FBAV|FB_IAB|Messenger/i.test(s)) return 'Facebook';
    if (/WhatsApp/i.test(s)) return 'WhatsApp';
    if (/TikTok|BytedanceWebview/i.test(s)) return 'TikTok';
    if (/Telegram/i.test(s)) return 'Telegram';
    if (/LinkedInApp/i.test(s)) return 'LinkedIn';
    if (/Twitter/i.test(s)) return 'X';
    if (/Snapchat/i.test(s)) return 'Snapchat';
    return 'this app';
}

export function isLikelyInAppBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
    return detectInAppBrowserName(ua) !== 'this app'
        || /Line\/|MicroMessenger|Pinterest/i.test(String(ua || ''));
}

export function isIosDevice(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
    if (/iPad|iPhone|iPod/i.test(String(ua || ''))) return true;
    if (typeof navigator === 'undefined') return false;
    return navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints) > 1;
}

export function getExternalBrowserTargetUrl(href = typeof window !== 'undefined' ? window.location.href : '') {
    try {
        const u = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://www.crwdctrl.in');
        if (u.hostname === 'crwdctrl.in') {
            u.hostname = 'www.crwdctrl.in';
        }
        return `${u.origin}${u.pathname}${u.search}${u.hash}`;
    } catch {
        return href || 'https://www.crwdctrl.in';
    }
}

export function getIosSafariHandoffUrl(href = typeof window !== 'undefined' ? window.location.href : '') {
    const url = getExternalBrowserTargetUrl(href);
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return url;
        return `x-safari-https://${u.host}${u.pathname}${u.search}${u.hash}`;
    } catch {
        return url;
    }
}

/** No browser_fallback_url — Instagram treats the fallback as a page reload and stuck-loads. */
function getAndroidChromeIntentUrl(href) {
    const url = getExternalBrowserTargetUrl(href);
    const withoutScheme = url.replace(/^https?:\/\//i, '');
    return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
}

function getAndroidChromeSchemeUrl(href) {
    const url = getExternalBrowserTargetUrl(href);
    return `googlechromes://${url.replace(/^https:\/\//i, '')}`;
}

const ALLOWED_HANDOFF_HOSTS = new Set(['www.crwdctrl.in', 'crwdctrl.in', 'localhost', '127.0.0.1']);

export function sanitizeHandoffTarget(raw) {
    try {
        const url = getExternalBrowserTargetUrl(String(raw || ''));
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        const allowed = ALLOWED_HANDOFF_HOSTS.has(parsed.hostname)
            || host === 'crwdctrl.in'
            || parsed.hostname === 'localhost'
            || parsed.hostname === '127.0.0.1';
        if (!allowed || (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1')) {
            return 'https://www.crwdctrl.in';
        }
        if (parsed.pathname.startsWith('/open-browser')) {
            return `${parsed.origin}/`;
        }
        return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return 'https://www.crwdctrl.in';
    }
}

export function getOpenBrowserHelperUrl(href) {
    const url = sanitizeHandoffTarget(href);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.crwdctrl.in';
    return `${origin}/open-browser?to=${encodeURIComponent(url)}`;
}

export function getExternalBrowserHandoffHref(href = typeof window !== 'undefined' ? window.location.href : '') {
    const url = getExternalBrowserTargetUrl(href);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    if (/Android/i.test(ua)) return getAndroidChromeIntentUrl(url);
    if (!isIosDevice(ua)) return url;

    if (/Barcelona/i.test(ua)) {
        return `barcelona://extbrowser/?url=${encodeURIComponent(url)}`;
    }
    if (/Instagram/i.test(ua)) {
        return `instagram://extbrowser/?url=${encodeURIComponent(url)}`;
    }
    return getIosSafariHandoffUrl(url);
}

function fireHiddenIframe(src) {
    if (typeof document === 'undefined' || !src) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', src);
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;pointer-events:none';
    document.body.appendChild(iframe);
    window.setTimeout(() => {
        try { iframe.remove(); } catch { /* ignore */ }
    }, 2000);
}

function fireHiddenAnchor(href) {
    if (typeof document === 'undefined' || !href) return;
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener noreferrer';
    a.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
        try { a.remove(); } catch { /* ignore */ }
    }, 0);
}

/**
 * Open Chrome/Safari from Instagram without navigating this WebView.
 * <a href="intent://…"> unloads the event page and Instagram spins "loading" forever.
 */
export function launchExternalBrowserFromTap(href, event, { stay = false } = {}) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const url = sanitizeHandoffTarget(href);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const android = /Android/i.test(ua);
    const schemes = android
        ? [getAndroidChromeIntentUrl(url), getAndroidChromeSchemeUrl(url)]
        : [getExternalBrowserHandoffHref(url)];

    schemes.forEach((scheme) => {
        fireHiddenIframe(scheme);
        fireHiddenAnchor(scheme);
    });

    try {
        window.open(schemes[0], '_blank');
    } catch {
        /* ignore */
    }

    copyPageLink(url);

    if (!stay && typeof window !== 'undefined') {
        window.setTimeout(() => {
            if (document.hidden) return;
            if (window.location.pathname === '/open-browser') return;
            window.location.assign(getOpenBrowserHelperUrl(url));
        }, 450);
    }

    return { ok: true, url };
}

/** @deprecated use launchExternalBrowserFromTap — must not location.assign custom schemes */
export function openInExternalBrowser(href = typeof window !== 'undefined' ? window.location.href : '') {
    return launchExternalBrowserFromTap(href);
}

export async function copyPageLink(href = typeof window !== 'undefined' ? window.location.href : '') {
    const url = getExternalBrowserTargetUrl(href);
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
            return { ok: true, url };
        }
    } catch {
        /* fall through */
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '0';
        ta.style.top = '0';
        ta.style.opacity = '1';
        ta.style.zIndex = '2147483647';
        ta.style.fontSize = '16px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, url.length);
        document.execCommand('copy');
        document.body.removeChild(ta);
        return { ok: true, url };
    } catch {
        return { ok: false, url };
    }
}
