import { useEffect, useState } from 'react';
import { isInAppBrowser } from '../../../../config/apiBase';
import { applyOfflineHuntManifest } from '../offlineHuntManifest';
import { launchExternalBrowserFromTap, copyPageLink } from '../../../../utils/openInExternalBrowser';
import { applyWaitingHuntUpdate } from '../refreshHuntAppShell';

function openInChrome(event) {
  launchExternalBrowserFromTap(window.location.href, event, { stay: true });
}

/**
 * Install CrwdCtrl Hunt guidance for shared / landing pages.
 * Always shows install steps in a normal browser — even before a pack is saved.
 * forceInstall: keep Install CTA even inside an already-installed Hunt icon.
 */
export default function OfflineHuntInstallHelp({
  packReady = false,
  teamCode = '',
  updateWaiting = false,
  packNote = '',
  forceInstall = false,
}) {
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
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    document.getElementById('hunt-install-steps')?.scrollIntoView({ behavior: 'smooth' });
  };

  const onCopy = async () => {
    try {
      await copyPageLink(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // Already running as Hunt home-screen app — short status (unless forced install).
  if (standalone && !forceInstall) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm font-bold text-emerald-100">
            CrwdCtrl Hunt is installed
            {teamCode ? ` · ${teamCode}` : ''}
          </p>
          <p className="mt-1 text-xs text-white/65">
            {packReady
              ? 'Open your install link on Wi‑Fi anytime for the latest pack + updates.'
              : 'Open your team’s shared install link on Wi‑Fi to load the pack.'}
          </p>
          {packNote ? (
            <p className="mt-2 text-xs text-emerald-200/90">{packNote}</p>
          ) : null}
        </div>
        {updateWaiting ? (
          <button
            type="button"
            onClick={() => { void applyWaitingHuntUpdate(); }}
            className="w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
          >
            App update ready — tap to reload
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl border border-[#0ECCEE]/45 bg-linear-to-b from-[#0ECCEE]/20 to-[#0a1218] p-5 shadow-[0_0_40px_rgba(14,204,238,0.12)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0ECCEE]">
          Download app
        </p>
        <h2 className="mt-2 text-xl font-black text-white">
          Install CrwdCtrl Hunt
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          {packReady
            ? 'Add Hunt to your home screen — not the main CrwdCtrl website. Re-open your install link on Wi‑Fi anytime for updates.'
            : 'Open your team’s shared install link on Wi‑Fi first, then add Hunt to your home screen (not the main CrwdCtrl website).'}
        </p>

        {inApp ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-amber-100">
              You are inside WhatsApp — open in Chrome first
            </p>
            <button
              type="button"
              onClick={openInChrome}
              className="w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black"
            >
              Open in Chrome → Install
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="w-full rounded-xl border border-white/20 py-2.5 text-xs font-semibold text-white"
            >
              {copied ? 'Link copied — paste in Chrome' : 'Copy link for Chrome / Safari'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={addHunt}
            className="mt-4 w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black"
          >
            Install CrwdCtrl Hunt
          </button>
        )}

        {installed ? (
          <p className="mt-3 text-xs text-emerald-200">Hunt icon added. Open it at the fest.</p>
        ) : (
          <div
            id="hunt-install-steps"
            className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/70"
          >
            {ios ? (
              <ol className="list-decimal space-y-1 pl-4">
                <li>Safari Share → <strong className="text-white">Add to Home Screen</strong></li>
                <li>Name it <strong className="text-white">Hunt</strong></li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-1 pl-4">
                <li>Chrome menu (⋮) → <strong className="text-white">Install app</strong></li>
                <li>If it says CrwdCtrl, cancel — stay on this Hunt page</li>
              </ol>
            )}
          </div>
        )}
      </div>

      {packNote ? (
        <p className="rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs text-white/60">
          {packNote}
        </p>
      ) : null}

      {updateWaiting ? (
        <button
          type="button"
          onClick={() => { void applyWaitingHuntUpdate(); }}
          className="w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
        >
          App update ready — tap to reload
        </button>
      ) : null}
    </div>
  );
}
