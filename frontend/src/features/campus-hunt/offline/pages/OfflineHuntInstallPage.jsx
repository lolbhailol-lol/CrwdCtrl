import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchOfflineInstallPack, ackOfflineInstallPack } from '../../services/campusHunt.api';
import {
  loadOfflineBundle,
  saveOfflineBundle,
  clearOfflineSession,
  clearOfflineBundle,
  clearOfflineTeamState,
} from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';
import OfflineHuntInstallHelp from '../components/OfflineHuntInstallHelp';
import { warmupOfflineHunt } from '../warmupOfflineHunt';
import {
  refreshHuntAppShell,
  applyWaitingHuntUpdate,
  bustStaleHuntShellOnce,
  purgeHuntAppCaches,
} from '../refreshHuntAppShell';
import { rememberInstallToken, applyServerStartOverIfNeeded } from '../startOverHunt';
import { dismissBootOverlays } from '../../../../utils/dismissBootOverlays';

/** Kill invisible layers that steal taps (One Tap iframe, boot splash, inert). */
function unlockHuntTaps() {
  dismissBootOverlays();
  try {
    document.body.classList.remove('page-content-loading', 'page-transition-active', 'detail-page-loading');
    document.documentElement.removeAttribute('data-home-hub-loading');
    document.documentElement.classList.add('skip-boot-splash');
  } catch { /* ignore */ }
  try {
    window.google?.accounts?.id?.cancel?.();
  } catch { /* ignore */ }
  try {
    document.querySelectorAll(
      '#credential_picker_container, iframe[src*="accounts.google"], div[id^="gsi_"]',
    ).forEach((el) => {
      el.style.pointerEvents = 'none';
      el.remove();
    });
  } catch { /* ignore */ }
  try {
    document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
  } catch { /* ignore */ }
}

/**
 * Shared install link — save pack, refresh app shell, install Hunt, then login.
 * Never reuse an old pack when this URL token is different (even offline).
 */
export default function OfflineHuntInstallPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [team, setTeam] = useState(null);
  const [packNote, setPackNote] = useState('');
  const [packMeta, setPackMeta] = useState(null);
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const [appInstalled, setAppInstalled] = useState(() => {
    try {
      return sessionStorage.getItem('ch_hunt_installed') === '1'
        || window.matchMedia('(display-mode: standalone)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    unlockHuntTaps();
    const t = window.setInterval(unlockHuntTaps, 1500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setStatus('error');
        setError('Missing install link');
        return;
      }
      try {
        const existing = await loadOfflineBundle();
        const online = typeof navigator === 'undefined' || navigator.onLine !== false;
        const urlToken = String(token || '').trim();
        const savedToken = String(existing?.installToken || '').trim();
        const samePackLink = Boolean(savedToken && savedToken === urlToken);

        // Offline + different / unknown link → do NOT reopen old Round 1/Survival/Finale pack.
        if (!online) {
          if (existing?.team?.teamCode && samePackLink) {
            if (cancelled) return;
            setTeam(existing.team);
            setPackMeta({
              exportBatchId: existing.exportBatchId || '',
              exportedAt: existing.exportedAt || '',
            });
            setPackNote('Same pack already on this phone (offline).');
            setStatus('ready');
            void warmupOfflineHunt().catch(() => {});
            return;
          }
          if (cancelled) return;
          setStatus('error');
          setError(
            existing?.team?.teamCode
              ? `This phone still has an OLD hunt pack (${existing.team.teamCode}). Turn Wi‑Fi / mobile data ON once, reopen THIS new link, and wait until it says “Latest team pack saved.” Then you can go offline.`
              : 'Need Wi‑Fi or mobile data once to download this team pack. Airplane mode will not load a new link.',
          );
          return;
        }

        // Online: bust stale PWA shell once so old rounds hub JS cannot stick.
        const bust = await bustStaleHuntShellOnce(urlToken).catch(() => ({ reloaded: false }));
        if (bust?.reloaded) return;

        const shell = await refreshHuntAppShell().catch(() => ({ waiting: false }));
        if (!cancelled && shell?.waiting) {
          setUpdateWaiting(true);
          await applyWaitingHuntUpdate();
          return;
        }

        const res = await fetchOfflineInstallPack(token);
        const pack = res.data?.bundle || res.bundle;
        if (!pack?.team?.teamCode) throw new Error('Install pack is empty');

        // New link → wipe prior team state so old progress / rounds UI cannot linger.
        if (existing?.team?.teamCode
          && (!samePackLink
            || String(existing.exportBatchId || '') !== String(pack.exportBatchId || ''))) {
          await clearOfflineTeamState(existing.team.teamCode).catch(() => {});
          await clearOfflineSession().catch(() => {});
        }

        const stamped = { ...pack, installToken: urlToken };
        await saveOfflineBundle(stamped);
        try {
          await clearOfflineSession();
        } catch { /* ignore */ }
        rememberInstallToken(urlToken);
        if (cancelled) return;
        setTeam(stamped.team);
        setPackMeta({
          exportBatchId: stamped.exportBatchId || res.data?.exportBatchId || '',
          exportedAt: stamped.exportedAt || '',
        });
        setStatus('ready');
        setPackNote('Latest team pack saved. Keep Wi‑Fi on ~10s while Hunt caches, then Add to Home Screen — after that airplane mode works.');
        try {
          await ackOfflineInstallPack(token, navigator.userAgent || '');
        } catch { /* best-effort */ }
        await warmupOfflineHunt({ timeoutMs: 14000 }).catch(() => {});
        if (!cancelled) {
          setPackNote('Pack + offline shell ready. Add to Home Screen, then you can turn net off.');
        }
        const sync = await applyServerStartOverIfNeeded(stamped).catch(() => null);
        if (!cancelled && sync?.applied) {
          setPackNote('Pack ready · Admin Start over applied. Add to Home Screen, then net off is OK.');
        }
      } catch (err) {
        if (cancelled) return;
        const existing = await loadOfflineBundle().catch(() => null);
        const urlToken = String(token || '').trim();
        const savedToken = String(existing?.installToken || '').trim();
        if (existing?.team?.teamCode && savedToken && savedToken === urlToken) {
          setTeam(existing.team);
          setPackMeta({
            exportBatchId: existing.exportBatchId || '',
            exportedAt: existing.exportedAt || '',
          });
          setStatus('ready');
          setPackNote('Using pack already on this phone (same link).');
          void warmupOfflineHunt().catch(() => {});
          return;
        }
        setStatus('error');
        setError(
          err.message
          || 'Need Wi‑Fi once to download your team pack. Do not open a new link in airplane mode.',
        );
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Pack ready + already marked installed → go to login (no dead Continue taps).
  useEffect(() => {
    if (status !== 'ready' || !team || !appInstalled) return undefined;
    unlockHuntTaps();
    const t = window.setTimeout(() => {
      navigate(CAMPUS_HUNT_PATHS.offlineLogin, { replace: true });
    }, 600);
    return () => window.clearTimeout(t);
  }, [status, team, appInstalled, navigate]);

  const goLogin = () => {
    unlockHuntTaps();
    navigate(CAMPUS_HUNT_PATHS.offlineLogin);
  };

  const wipeAndRetry = async () => {
    unlockHuntTaps();
    setStatus('loading');
    setError('');
    try {
      const existing = await loadOfflineBundle().catch(() => null);
      if (existing?.team?.teamCode) {
        await clearOfflineTeamState(existing.team.teamCode).catch(() => {});
      }
      await clearOfflineSession().catch(() => {});
      await clearOfflineBundle().catch(() => {});
      // Soft API cache only — keep SW precache so airplane mode still works after reload.
      await purgeHuntAppCaches();
      try {
        sessionStorage.removeItem(`ch_hunt_shell_bust_${String(token || '').slice(0, 48)}`);
      } catch { /* ignore */ }
      window.location.reload();
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Could not clear old pack');
    }
  };

  return (
    <div className="relative z-10 min-h-screen bg-[#0b0c0d] px-4 py-10 text-white" style={{ pointerEvents: 'auto' }}>
      <div className="relative z-10 mx-auto max-w-md" style={{ pointerEvents: 'auto' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE]">
          CrwdCtrl Hunt
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          {team?.teamCode || 'Install'}
        </h1>
        {team?.teamName ? (
          <p className="mt-1 text-sm text-white/50">{team.teamName}</p>
        ) : null}
        {packMeta?.exportedAt ? (
          <p className="mt-2 text-[11px] text-white/40">
            Pack export · {new Date(packMeta.exportedAt).toLocaleString()}
          </p>
        ) : null}

        {status === 'loading' ? (
          <p className="mt-8 text-sm text-white/50">Saving latest team pack…</p>
        ) : null}

        {status === 'error' ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => { void wipeAndRetry(); }}
              className="relative z-20 w-full rounded-xl border border-amber-400/40 bg-amber-500/15 py-3 text-sm font-bold text-amber-100 touch-manipulation"
            >
              Clear old pack on this phone &amp; retry
            </button>
            <p className="text-[11px] leading-relaxed text-white/45">
              New pack links need data ON for one download. Opening the home-screen Hunt icon
              while offline only shows whatever was saved last time (often the old 3-round screen).
            </p>
          </div>
        ) : null}

        {status === 'ready' && team ? (
          <div className="relative z-20 mt-6 space-y-4" style={{ pointerEvents: 'auto' }}>
            <OfflineHuntInstallHelp
              packReady
              forceInstall={!appInstalled}
              teamCode={team.teamCode}
              updateWaiting={updateWaiting}
              packNote={packNote}
              onInstalled={() => setAppInstalled(true)}
            />

            {updateWaiting ? (
              <button
                type="button"
                onClick={() => { void applyWaitingHuntUpdate(); }}
                className="relative z-20 w-full rounded-xl border border-amber-400/40 bg-amber-500/15 py-3 text-sm font-bold text-amber-100 touch-manipulation"
              >
                Update ready — reload Hunt
              </button>
            ) : null}

            <button
              type="button"
              onClick={goLogin}
              className="relative z-20 w-full rounded-xl bg-[#0ECCEE] py-4 text-sm font-bold text-black touch-manipulation active:scale-[0.98]"
            >
              {appInstalled ? 'Continue' : 'Continue to login'}
            </button>

            <button
              type="button"
              onClick={() => { void wipeAndRetry(); }}
              className="relative z-20 w-full text-center text-xs text-white/40 underline hover:text-white/60 touch-manipulation"
            >
              Still see old Round 1 / Survival / Finale? Clear pack &amp; reload
            </button>
          </div>
        ) : status === 'loading' ? null : (
          <div className="mt-6">
            <OfflineHuntInstallHelp packReady={false} forceInstall />
          </div>
        )}
      </div>
    </div>
  );
}
