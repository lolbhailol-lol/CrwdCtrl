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
        // Always hand off to www — apex 307 + in-app cookies break login/payment in Safari.
        if (u.hostname === 'crwdctrl.in') {
            u.hostname = 'www.crwdctrl.in';
        }
        return `${u.origin}${u.pathname}${u.search}${u.hash}`;
    } catch {
        return href || 'https://www.crwdctrl.in';
    }
}

/** iOS Safari URL scheme — works in TikTok/WhatsApp/etc. Instagram blocks this. */
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

function getAndroidChromeIntentUrl(href) {
    const url = getExternalBrowserTargetUrl(href);
    const withoutScheme = url.replace(/^https?:\/\//i, '');
    return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

/**
 * Native <a href> for a real user tap.
 * Instagram iOS blocks x-safari-https; use instagram://extbrowser instead.
 */
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

function navigateTo(url) {
    if (typeof window === 'undefined' || !url) return false;
    try {
        window.location.assign(url);
        return true;
    } catch {
        try {
            window.location.href = url;
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * JS fallback only. Instagram iOS must use a native <a href> tap —
 * location.assign(x-safari) is blocked and can cancel the real handoff.
 */
export function openInExternalBrowser(href = typeof window !== 'undefined' ? window.location.href : '') {
    const url = getExternalBrowserTargetUrl(href);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const handoff = getExternalBrowserHandoffHref(url);

    try {
        if (navigateTo(handoff)) {
            return { ok: true, method: 'handoff-href', url: handoff };
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        return { ok: true, method: 'window-open', url };
    } catch {
        return { ok: false, method: 'failed', url };
    }
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
