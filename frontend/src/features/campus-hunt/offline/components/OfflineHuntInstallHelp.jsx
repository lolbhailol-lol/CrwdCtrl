import { useEffect, useState } from 'react';
import { isInAppBrowser } from '../../../../config/apiBase';
import { applyOfflineHuntManifest } from '../offlineHuntManifest';
import { launchExternalBrowserFromTap, copyPageLink } from '../../../../utils/openInExternalBrowser';
import { applyWaitingHuntUpdate } from '../refreshHuntAppShell';

function openInChrome(event) {
  launchExternalBrowserFromTap(window.location.href, event, { stay: true });
}

/**
 * Big “Download CrwdCtrl Hunt” sheet so shared-link openers understand
 * this is a separate offline app — not the main CrwdCtrl website.
 */
export default function OfflineHuntInstallHelp({
  packReady = false,
  teamCode = '',
  updateWaiting = false,
  packNote = '',
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
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
      await copyPageLink(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (standalone) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm font-bold text-emerald-100">
            CrwdCtrl Hunt is installed
            {teamCode ? ` · ${teamCode}` : ''}
          </p>
          <p className="mt-1 text-xs text-white/65">
            Open this same link anytime on Wi‑Fi to pull the latest pack + app updates.
            Airplane mode is OK at the fest.
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

  const showPromo = !dismissed && packReady;

  return (
    <div className="space-y-3">
      {showPromo ? (
        <div className="relative overflow-hidden rounded-3xl border border-[#0ECCEE]/45 bg-linear-to-b from-[#0ECCEE]/20 to-[#0a1218] p-5 shadow-[0_0_40px_rgba(14,204,238,0.12)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0ECCEE]">
            Download app
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Install CrwdCtrl Hunt
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            This is your team&apos;s offline hunt app — not the main CrwdCtrl website.
            Add it to your home screen once. Re-open this link later to get updates automatically.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-white/55">
            <li>· Leader phone only · whole team walks with you</li>
            <li>· Works offline / airplane mode at the fest</li>
            <li>· Same link = latest pack whenever you open it on Wi‑Fi</li>
          </ul>

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
                Open in Chrome → install Hunt
              </button>
              <button
                type="button"
                onClick={onCopy}
                className="w-full rounded-xl border border-white/20 py-2.5 text-xs font-semibold text-white"
              >
                {copied ? 'Link copied — paste in Chrome' : 'Copy link for Chrome / Safari'}
              </button>
            </div>
          ) : deferredPrompt ? (
            <button
              type="button"
              onClick={addHunt}
              className="mt-4 w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black"
            >
              Download CrwdCtrl Hunt
            </button>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/70">
              {ios ? (
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Safari Share → <strong className="text-white">Add to Home Screen</strong></li>
                  <li>Name it <strong className="text-white">Hunt</strong> (not CrwdCtrl)</li>
                </ol>
              ) : (
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Chrome menu (⋮) → <strong className="text-white">Install app</strong></li>
                  <li>If it says CrwdCtrl, cancel — stay on this Hunt page</li>
                </ol>
              )}
            </div>
          )}

          {installed ? (
            <p className="mt-3 text-xs text-emerald-200">Hunt icon added. Use that at the fest.</p>
          ) : null}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="mt-3 w-full py-1 text-center text-[11px] text-white/40 underline"
          >
            Continue without installing yet
          </button>
        </div>
      ) : null}

      {inApp && !showPromo ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/15 p-4">
          <p className="text-sm font-bold text-amber-100">Open in Chrome to install Hunt</p>
          <button
            type="button"
            onClick={openInChrome}
            className="mt-3 w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
          >
            Open in Chrome
          </button>
        </div>
      ) : null}

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
