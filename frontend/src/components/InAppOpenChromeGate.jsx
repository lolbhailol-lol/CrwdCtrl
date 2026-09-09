import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import {
    copyPageLink,
    detectInAppBrowserName,
    getExternalBrowserHandoffHref,
    getExternalBrowserTargetUrl,
    isIosDevice,
    isLikelyInAppBrowser,
} from '../utils/openInExternalBrowser';

const TAP_BTN =
    'relative z-10 pointer-events-auto touch-manipulation select-none [-webkit-tap-highlight-color:rgba(14,204,238,0.35)]';

/**
 * Full-screen Instagram / in-app browser gate.
 * Instagram iOS: native <a href="instagram://extbrowser"> — do not JS-redirect
 * (x-safari-https is blocked and location.assign cancels the tap).
 */
export default function InAppOpenChromeGate({
    open,
    actionLabel = 'register',
    eventName = '',
    isDark = true,
    pageUrl,
    onDismiss,
}) {
    const [copied, setCopied] = useState(false);

    if (!open || typeof document === 'undefined') return null;
    if (!isLikelyInAppBrowser()) return null;

    const appName = detectInAppBrowserName();
    const isIOS = isIosDevice();
    const isInstagramIos = isIOS && appName === 'Instagram';
    const browserName = isIOS ? 'Safari' : 'Chrome';
    const httpsUrl = getExternalBrowserTargetUrl(
        pageUrl || (typeof window !== 'undefined' ? window.location.href : ''),
    );
    const handoffHref = getExternalBrowserHandoffHref(httpsUrl);

    const markCopied = () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
    };

    const handleCopy = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const copy = await copyPageLink(httpsUrl);
        if (copy.ok) markCopied();
    };

    return createPortal(
        <div className="fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center pointer-events-auto">
            <div className="absolute inset-0 bg-black/80 pointer-events-none" aria-hidden />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="inapp-chrome-title"
                className={`relative z-10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl px-5 pt-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-2xl pointer-events-auto ${
                    isDark ? 'bg-[#111213] text-white' : 'bg-white text-gray-900'
                }`}
            >
                <p className="text-center text-xs font-bold tracking-[0.14em] uppercase text-[#0ECCEE]">
                    {appName} browser
                </p>
                <h2 id="inapp-chrome-title" className="mt-2 text-center text-xl font-extrabold leading-snug">
                    Open in {browserName} to {actionLabel}
                </h2>
                {eventName ? (
                    <p className={`mt-2 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {eventName}
                    </p>
                ) : null}

                {isInstagramIos ? (
                    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                        isDark
                            ? 'border-amber-400/30 bg-amber-500/10 text-amber-50'
                            : 'border-amber-200 bg-amber-50 text-amber-950'
                    }`}>
                        iPhone does not allow Instagram to auto-open Safari.
                        Tap <strong>OPEN IN SAFARI</strong> below.
                        If nothing happens: tap <strong>⋯</strong> (top right) → <strong>Open in Safari</strong>.
                    </div>
                ) : (
                    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                        isDark
                            ? 'border-amber-400/30 bg-amber-500/10 text-amber-50'
                            : 'border-amber-200 bg-amber-50 text-amber-950'
                    }`}>
                        Google sign-in and UPI do <strong>not</strong> work inside {appName}.
                        Tap <strong>Open in {browserName}</strong> — this same page opens there.
                    </div>
                )}

                <a
                    href={handoffHref}
                    rel="noopener noreferrer"
                    onClick={() => { copyPageLink(httpsUrl); }}
                    className={`${TAP_BTN} mt-5 w-full min-h-16 rounded-2xl bg-[#0ECCEE] text-black text-lg font-extrabold tracking-wide flex items-center justify-center gap-2 active:scale-[0.99]`}
                >
                    <ExternalLink size={22} strokeWidth={2.5} />
                    OPEN IN {browserName.toUpperCase()}
                </a>

                <button
                    type="button"
                    onClick={handleCopy}
                    className={`${TAP_BTN} mt-3 w-full min-h-14 rounded-2xl border text-base font-bold ${
                        isDark
                            ? 'border-white/20 bg-white/8 text-white'
                            : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                >
                    {copied ? 'Copied — paste in Safari' : 'Copy link'}
                </button>

                {typeof onDismiss === 'function' ? (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className={`${TAP_BTN} mt-3 w-full min-h-12 rounded-xl text-sm font-semibold ${
                            isDark ? 'text-gray-300 bg-white/5' : 'text-gray-600 bg-gray-100'
                        }`}
                    >
                        Not now
                    </button>
                ) : null}
            </div>
        </div>,
        document.body,
    );
}

export function shouldShowInAppChromeGate() {
    return isLikelyInAppBrowser();
}
