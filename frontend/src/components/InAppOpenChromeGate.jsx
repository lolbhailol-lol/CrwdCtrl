import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import {
    copyPageLink,
    detectInAppBrowserName,
    getExternalBrowserTargetUrl,
    isIosDevice,
    isLikelyInAppBrowser,
    launchExternalBrowserFromTap,
} from '../utils/openInExternalBrowser';
import { dismissBootOverlays } from '../utils/dismissBootOverlays';
import { signalDetailPageReady } from '../utils/bootSplash';

const TAP_BTN =
    'relative z-10 pointer-events-auto touch-manipulation select-none [-webkit-tap-highlight-color:rgba(14,204,238,0.35)]';

/**
 * Instagram / in-app browser gate.
 * Never navigate this WebView to intent:// or instagram:// — that stuck-loads.
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
    const [opening, setOpening] = useState(false);

    if (!open || typeof document === 'undefined') return null;
    if (!isLikelyInAppBrowser()) return null;

    const appName = detectInAppBrowserName();
    const isIOS = isIosDevice();
    const browserName = isIOS ? 'Safari' : 'Chrome';
    const httpsUrl = getExternalBrowserTargetUrl(
        pageUrl || (typeof window !== 'undefined' ? window.location.href : ''),
    );

    const markCopied = () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
    };

    const handleOpen = (event) => {
        dismissBootOverlays();
        signalDetailPageReady();
        setOpening(true);
        launchExternalBrowserFromTap(httpsUrl, event);
        window.setTimeout(() => setOpening(false), 4000);
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
                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                    isDark
                        ? 'border-amber-400/30 bg-amber-500/10 text-amber-50'
                        : 'border-amber-200 bg-amber-50 text-amber-950'
                }`}>
                    Google sign-in and UPI do <strong>not</strong> work inside {appName}.
                    Tap <strong>Open in {browserName}</strong> — stay on this screen; {browserName} opens on top.
                    {isIOS ? (
                        <> If it does not open: tap <strong>⋯</strong> (top right) → <strong>Open in Safari</strong>.</>
                    ) : (
                        <> If Chrome does not open: tap Instagram <strong>⋮</strong> → <strong>Open in Chrome</strong>.</>
                    )}
                </div>

                {opening ? (
                    <p className={`mt-3 text-center text-sm font-semibold ${isDark ? 'text-[#0ECCEE]' : 'text-cyan-700'}`}>
                        Opening {browserName}… this page stays here.
                    </p>
                ) : null}

                <button
                    type="button"
                    onClick={handleOpen}
                    className={`${TAP_BTN} mt-5 w-full min-h-16 rounded-2xl bg-[#0ECCEE] text-black text-lg font-extrabold tracking-wide flex items-center justify-center gap-2 active:scale-[0.99]`}
                >
                    <ExternalLink size={22} strokeWidth={2.5} />
                    OPEN IN {browserName.toUpperCase()}
                </button>

                <button
                    type="button"
                    onClick={handleCopy}
                    className={`${TAP_BTN} mt-3 w-full min-h-14 rounded-2xl border text-base font-bold ${
                        isDark
                            ? 'border-white/20 bg-white/8 text-white'
                            : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                >
                    {copied ? `Copied — paste in ${browserName}` : 'Copy link'}
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
