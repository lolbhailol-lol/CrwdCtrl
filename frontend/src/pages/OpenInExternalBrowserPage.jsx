import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import {
    copyPageLink,
    detectInAppBrowserName,
    isIosDevice,
    isLikelyInAppBrowser,
    launchExternalBrowserFromTap,
    sanitizeHandoffTarget,
} from '../utils/openInExternalBrowser';
import { dismissBootOverlays } from '../utils/dismissBootOverlays';
import { signalDetailPageReady } from '../utils/bootSplash';

/**
 * Lightweight Instagram → Chrome/Safari handoff.
 * If Chrome already opened this page, jump straight to the event (no loaders).
 */
export default function OpenInExternalBrowserPage() {
    const { isDark } = useDarkMode();
    const [params] = useSearchParams();
    const [copied, setCopied] = useState(false);
    const target = useMemo(
        () => sanitizeHandoffTarget(params.get('to') || ''),
        [params],
    );
    const inApp = isLikelyInAppBrowser();
    const isIOS = isIosDevice();
    const browserName = isIOS ? 'Safari' : 'Chrome';
    const appName = detectInAppBrowserName();

    useEffect(() => {
        dismissBootOverlays();
        signalDetailPageReady();
        document.body.classList.remove('page-content-loading');
        if (!inApp) {
            window.location.replace(target);
            return undefined;
        }
        launchExternalBrowserFromTap(target, undefined, { stay: true });
        return undefined;
    }, [inApp, target]);

    const handleOpen = (event) => {
        launchExternalBrowserFromTap(target, event, { stay: true });
    };

    const handleCopy = async () => {
        const copy = await copyPageLink(target);
        if (copy.ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
        }
    };

    return (
        <div className={`min-h-dvh flex items-center justify-center px-5 ${isDark ? 'bg-[#0D0E10] text-white' : 'bg-white text-gray-900'}`}>
            <div className="w-full max-w-sm text-center">
                <p className="text-xs font-bold tracking-[0.14em] uppercase text-[#0ECCEE]">
                    {inApp ? `${appName} browser` : 'Opening event'}
                </p>
                <h1 className="mt-2 text-2xl font-extrabold">
                    {inApp ? `Open in ${browserName}` : 'Opening event…'}
                </h1>
                <p className={`mt-3 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {inApp
                        ? `Tap below to open this event in ${browserName}. Google sign-in and payment work there.`
                        : 'Taking you to the event now.'}
                </p>
                {inApp ? (
                    <>
                        <button
                            type="button"
                            onClick={handleOpen}
                            className="mt-6 w-full min-h-14 rounded-2xl bg-[#0ECCEE] text-black text-base font-extrabold flex items-center justify-center gap-2"
                        >
                            <ExternalLink size={18} />
                            OPEN IN {browserName.toUpperCase()}
                        </button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`mt-3 w-full min-h-12 rounded-2xl border text-sm font-bold ${
                                isDark ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-50'
                            }`}
                        >
                            {copied ? `Copied — paste in ${browserName}` : 'Copy event link'}
                        </button>
                        <a
                            href={target}
                            className="mt-4 inline-block text-sm font-semibold text-[#0ECCEE]"
                        >
                            Continue on this page
                        </a>
                    </>
                ) : null}
            </div>
        </div>
    );
}
