import { useEffect, useState, useRef } from 'react';
import { isInAppBrowser } from '../../../../config/apiBase';
import { applyOfflineHuntManifest } from '../offlineHuntManifest';
import { launchExternalBrowserFromTap, copyPageLink } from '../../../../utils/openInExternalBrowser';
import { applyWaitingHuntUpdate } from '../refreshHuntAppShell';

function openInBrowser(event) {
  launchExternalBrowserFromTap(window.location.href, event, { stay: true });
}

/**
 * Minimal install sheet — one action, clear “installed” state, iOS + Android.
 */
export default function OfflineHuntInstallHelp({
  packReady = false,
  teamCode = '',
  updateWaiting = false,
  packNote = '',
  forceInstall = false,
  onInstalled,
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => {
    try {
      return sessionStorage.getItem('ch_hunt_installed') === '1';
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);
  const [iosDone, setIosDone] = useState(false);
  const inApp = isInAppBrowser();
  const standalone = typeof window !== 'undefined'
    && window.matchMedia('(display-mode: standalone)').matches;
  const ios = typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const onInstalledRef = useRef(onInstalled);
  onInstalledRef.current = onInstalled;

  useEffect(() => {
    applyOfflineHuntManifest();
    const onPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      onInstalledRef.current?.();
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const markInstalled = () => {
    setInstalled(true);
    try {
      sessionStorage.setItem('ch_hunt_installed', '1');
    } catch { /* ignore */ }
    onInstalledRef.current?.();
  };

  const addHunt = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') markInstalled();
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

  const done = standalone || installed || iosDone;

  if (done && !forceInstall) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-4 text-center">
          <p className="text-base font-bold text-emerald-100">
            Hunt app downloaded
            {teamCode ? ` · ${teamCode}` : ''}
          </p>
          <p className="mt-1 text-xs text-white/55">
            Pack is on this phone. Add to Home Screen (optional), then airplane mode works.
          </p>
        </div>
        {updateWaiting ? (
          <button
            type="button"
            onClick={() => { void applyWaitingHuntUpdate(); }}
            className="w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
          >
            Update ready — reload
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {done ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-4 text-center">
          <p className="text-base font-bold text-emerald-100">Hunt app downloaded</p>
          <p className="mt-1 text-xs text-white/55">Use the home-screen icon next time.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/10 p-4">
          <p className="text-sm font-bold text-white">Install Hunt on this phone</p>
          <p className="mt-1 text-xs text-white/55">Leader phone only · works offline</p>

          {inApp ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-amber-100">Open in Chrome or Safari first</p>
              <button
                type="button"
                onClick={openInBrowser}
                className="w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black"
              >
                Open in browser
              </button>
              <button
                type="button"
                onClick={onCopy}
                className="w-full rounded-xl border border-white/20 py-2.5 text-xs font-semibold text-white"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          ) : deferredPrompt ? (
            <button
              type="button"
              onClick={addHunt}
              className="mt-4 w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black"
            >
              Install Hunt
            </button>
          ) : ios ? (
            <div className="mt-4 space-y-3">
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-white/75">
                <li>Tap Share <span className="text-white/40">(□↑)</span></li>
                <li>Add to Home Screen</li>
                <li>Name it <strong className="text-white">Hunt</strong></li>
              </ol>
              <button
                type="button"
                onClick={() => {
                  setIosDone(true);
                  markInstalled();
                }}
                className="w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black"
              >
                Done — Hunt is on my home screen
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-white/70">
                Chrome menu (⋮) → <strong className="text-white">Install app</strong>
              </p>
              <button
                type="button"
                onClick={markInstalled}
                className="w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black"
              >
                Done — Hunt is installed
              </button>
            </div>
          )}
        </div>
      )}

      {packReady && packNote ? (
        <p className="text-center text-xs text-white/45">{packNote}</p>
      ) : null}

      {updateWaiting ? (
        <button
          type="button"
          onClick={() => { void applyWaitingHuntUpdate(); }}
          className="w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
        >
          Update ready — reload
        </button>
      ) : null}
    </div>
  );
}
