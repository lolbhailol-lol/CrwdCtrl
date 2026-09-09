import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import {
    copyPageLink,
    detectInAppBrowserName,
    getExternalBrowserHandoffHref,
    getExternalBrowserTargetUrl,
    isIosDevice,
} from '../utils/openInExternalBrowser';

/**
 * Instagram iOS: native instagram://extbrowser link — no JS redirect.
 */
export default function OpenInBrowserModal({
    open,
    onClose,
    appName: appNameProp,
    pageUrl,
    isDark = true,
}) {
    const appName = appNameProp || detectInAppBrowserName();
    const httpsUrl = getExternalBrowserTargetUrl(pageUrl || (typeof window !== 'undefined' ? window.location.href : ''));
    const handoffHref = getExternalBrowserHandoffHref(httpsUrl);
    const isIOS = isIosDevice();
    const browserName = isIOS ? 'Safari' : 'Chrome';

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[2147483000] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
            <div className="absolute inset-0 bg-black/60 pointer-events-none" aria-hidden />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="open-browser-title"
                className={`relative z-10 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pointer-events-auto ${
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
                        className={`shrink-0 min-h-11 min-w-11 p-2 rounded-full pointer-events-auto touch-manipulation ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                        aria-label="Dismiss"
                    >
                        <X size={18} />
                    </button>
                </div>

                <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Google login doesn&apos;t work inside {appName}. Tap <strong>Open in {browserName}</strong>.
                    {isIOS ? (
                        <> If it does not open, tap <strong>⋯</strong> → <strong>Open in Safari</strong>.</>
                    ) : null}
                </p>

                <a
                    href={handoffHref}
                    rel="noopener noreferrer"
                    onClick={() => { copyPageLink(httpsUrl); }}
                    className="mt-5 w-full min-h-14 rounded-2xl bg-[#0ECCEE] text-black font-extrabold text-base flex items-center justify-center gap-2 pointer-events-auto touch-manipulation"
                >
                    <ExternalLink size={18} />
                    Open in {browserName}
                </a>
            </div>
        </div>,
        document.body,
    );
}
