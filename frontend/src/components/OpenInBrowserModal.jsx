import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import {
    detectInAppBrowserName,
    getExternalBrowserTargetUrl,
    openInExternalBrowser,
} from '../utils/openInExternalBrowser';

/**
 * “Open in Chrome / Safari” sheet for Instagram & other in-app browsers.
 * Tap-only — auto-open via intent:// often bounces Instagram WebViews back.
 */
export default function OpenInBrowserModal({
    open,
    onClose,
    appName: appNameProp,
    pageUrl,
    isDark = true,
}) {
    const appName = appNameProp || detectInAppBrowserName();
    const url = getExternalBrowserTargetUrl(pageUrl || (typeof window !== 'undefined' ? window.location.href : ''));
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent);
    const browserName = isIOS ? 'Safari' : 'Chrome';

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/60"
                onClick={onClose}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="open-browser-title"
                className={`relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${
                    isDark ? 'bg-[#151617] text-white' : 'bg-white text-gray-900'
                }`}
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="open-browser-title" className="text-lg font-bold leading-snug pr-2">
                        Open in {browserName} to continue
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`shrink-0 p-2 rounded-full ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                        aria-label="Dismiss"
                    >
                        <X size={18} />
                    </button>
                </div>

                <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {isIOS ? (
                        <>
                            Google login doesn&apos;t work inside {appName}. Tap <strong>⋯</strong> →{' '}
                            <strong>Open in {browserName}</strong>, then sign in.
                        </>
                    ) : (
                        <>
                            Google login doesn&apos;t work inside {appName}. Tap below to open {browserName} on this same page.
                        </>
                    )}
                </p>

                <button
                    type="button"
                    onClick={() => openInExternalBrowser(url)}
                    className="mt-5 w-full min-h-12 rounded-2xl bg-[#0ECCEE] text-black font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90"
                >
                    <ExternalLink size={18} />
                    Open in {browserName}
                </button>
            </div>
        </div>,
        document.body,
    );
}
