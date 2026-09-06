import { useEffect, useState } from 'react';
import { isInAppBrowser } from '../../../../config/apiBase';
import { applyOfflineHuntManifest } from '../offlineHuntManifest';

function openInChrome() {
  const href = window.location.href;
  const withoutScheme = href.replace(/^https?:\/\//i, '');
  window.location.href = `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
}

function copyLink() {
  return navigator.clipboard?.writeText(window.location.href);
}

/**
 * WhatsApp/Instagram cannot install a PWA. Chrome "Install CrwdCtrl" would
 * pin the main website. This block forces Chrome + Hunt shortcut.
 */
export default function OfflineHuntInstallHelp({ packReady = false, teamCode = '' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const inApp = isInAppBrowser();
  const standalone = typeof window !== 'undefined'
    && window.matchMedia('(display-mode: standalone)').matches;
  const ios = typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    applyOfflineHuntManifest();
    const onPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const addHunt = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  const onCopy = async () => {
    try {
      await copyLink();
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (standalone) {
    return (
      <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
        Hunt is installed on this phone
        {teamCode ? ` · ${teamCode}` : ''}. Airplane mode is OK at the fest.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {inApp ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/15 p-4">
          <p className="text-sm font-bold text-amber-100">You are inside WhatsApp</p>
          <p className="mt-1 text-xs text-white/70">
            Adding a shortcut here pins the main CrwdCtrl website. Open this same link in Chrome first.
          </p>
          <button
            type="button"
            onClick={openInChrome}
            className="mt-3 w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
          >
            Open in Chrome
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="mt-2 w-full rounded-xl border border-white/20 py-2 text-xs font-semibold text-white"
          >
            {copied ? 'Link copied — paste in Chrome' : 'Copy link for Chrome / Safari'}
          </button>
          {ios ? (
            <p className="mt-2 text-[11px] text-white/50">
              iPhone: tap Share → Open in Safari → then Share → Add to Home Screen.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 p-4">
          <p className="text-sm font-bold text-white">Add Hunt — not the main website</p>
          <p className="mt-1 text-xs text-white/65">
            Stay on this page until it says airplane-mode pages are saved. Then add
            {' '}
            <strong className="text-white">Hunt</strong>
            , not CrwdCtrl. Do not turn data off until after that.
          </p>
          {packReady && deferredPrompt ? (
            <button
              type="button"
              onClick={addHunt}
              className="mt-3 w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
            >
              Add Campus Hunt
            </button>
          ) : null}
          {installed ? (
            <p className="mt-2 text-xs text-emerald-200">Hunt icon added. Use that at the fest.</p>
          ) : (
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-white/70">
              {ios ? (
                <>
                  <li>Safari Share → <strong className="text-white">Add to Home Screen</strong></li>
                  <li>Name it Hunt if asked. Do not open crwdctrl.in home first.</li>
                </>
              ) : (
                <>
                  <li>Chrome menu (⋮) → <strong className="text-white">Install app</strong> or Add to Home screen</li>
                  <li>If it says CrwdCtrl, cancel. You must be on this Hunt page in Chrome.</li>
                </>
              )}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
