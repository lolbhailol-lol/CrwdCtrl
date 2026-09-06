import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import {
    detectInAppBrowserName,
    isLikelyInAppBrowser,
    openInExternalBrowser,
    copyPageLink,
    getExternalBrowserTargetUrl,
} from '../utils/openInExternalBrowser';

/**
 * Full-screen Instagram / in-app browser gate.
 * Google login + UPI payment cannot work inside Instagram — guide to Safari/Chrome.
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
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent);
    const browserName = isIOS ? 'Safari' : 'Chrome';
    const url = getExternalBrowserTargetUrl(
        pageUrl || (typeof window !== 'undefined' ? window.location.href : ''),
    );

    const handleOpen = async () => {
        const result = openInExternalBrowser(url);
        if (result.ok) return;
        const copy = await copyPageLink(url);
        if (copy.ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
        }
    };

    const handleCopy = async () => {
        const copy = await copyPageLink(url);
        if (copy.ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100080] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/75" aria-hidden />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="inapp-chrome-title"
                className={`relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl ${
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
                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                    isDark
                        ? 'border-amber-400/30 bg-amber-500/10 text-amber-50'
                        : 'border-amber-200 bg-amber-50 text-amber-950'
                }`}>
                    {isIOS ? (
                        <>
                            Google sign-in and UPI payment do <strong>not</strong> work inside {appName}.
                            Tap <strong>⋯</strong> (top right) → <strong>Open in {browserName}</strong>, then {actionLabel}.
                        </>
                    ) : (
                        <>
                            Google sign-in and UPI payment do <strong>not</strong> work inside {appName}.
                            Tap the button below — this same page opens in {browserName} so you can {actionLabel}.
                        </>
                    )}
                </div>

                {isIOS ? (
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="mt-5 w-full min-h-14 rounded-2xl bg-[#0ECCEE] text-black text-base font-extrabold tracking-wide flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99]"
                    >
                        {copied ? 'Link copied — paste in Safari' : `Copy link for ${browserName}`}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleOpen}
                        className="mt-5 w-full min-h-14 rounded-2xl bg-[#0ECCEE] text-black text-base font-extrabold tracking-wide flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99]"
                    >
                        <ExternalLink size={20} strokeWidth={2.5} />
                        OPEN IN {browserName.toUpperCase()}
                    </button>
                )}

                {isIOS ? (
                    <button
                        type="button"
                        onClick={handleOpen}
                        className={`mt-3 w-full text-center text-xs font-medium py-2 ${
                            isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        Or try opening {browserName} directly
                    </button>
                ) : null}

                {typeof onDismiss === 'function' ? (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className={`mt-1 w-full text-center text-xs font-medium py-2 ${
                            isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
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
