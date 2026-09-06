/** Helpers for Instagram / Facebook / WhatsApp in-app browsers. */

export function detectInAppBrowserName(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
    const s = String(ua || '');
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

/** Try to hand off to Chrome / Safari; fall back to copy instructions. */
export function openInExternalBrowser(href = typeof window !== 'undefined' ? window.location.href : '') {
    const url = getExternalBrowserTargetUrl(href);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    try {
        if (isAndroid) {
            const withoutScheme = url.replace(/^https?:\/\//i, '');
            const intent = `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
            window.location.href = intent;
            return { ok: true, method: 'android-chrome-intent' };
        }
        if (isIOS) {
            // Instagram iOS blocks window.open → Safari; copy + manual ⋯ menu is reliable.
            return { ok: false, method: 'ios-manual-safari', url };
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        return { ok: true, method: 'window-open' };
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
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return { ok: true, url };
    } catch {
        return { ok: false, url };
    }
}
