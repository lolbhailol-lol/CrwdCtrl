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
  const [shellReady, setShellReady] = useState(false);

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

        // Offline + same link → reuse pack already on phone (no Survival hub).
        if (!online) {
          if (existing?.team?.teamCode && samePackLink) {
            if (cancelled) return;
            setTeam(existing.team);
            setPackMeta({
              exportBatchId: existing.exportBatchId || '',
              exportedAt: existing.exportedAt || '',
            });
            setPackNote('Pack on this phone — ready offline.');
            setStatus('ready');
            setShellReady(true);
            void warmupOfflineHunt().catch(() => {});
            return;
          }
          if (cancelled) return;
          setStatus('error');
          setError(
            existing?.team?.teamCode
              ? `This phone has a different team pack (${existing.team.teamCode}). Turn Wi‑Fi ON, open THIS new link once, wait for “ready”, then you can go offline.`
              : 'Need Wi‑Fi once to download this team pack.',
          );
          return;
        }

        // Online: activate newest SW once so stale Survival shells cannot stick.
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

        // New link → wipe prior team state so old progress cannot linger.
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
        setPackNote('Pack saved — caching Hunt for airplane mode…');
        try {
          await ackOfflineInstallPack(token, navigator.userAgent || '');
        } catch { /* best-effort */ }
        await warmupOfflineHunt({ timeoutMs: 16000 }).catch(() => {});
        if (!cancelled) {
          setShellReady(true);
          setPackNote('Ready offline. Optional: Add to Home Screen, then turn net off.');
        }
        const sync = await applyServerStartOverIfNeeded(stamped).catch(() => null);
        if (!cancelled && sync?.applied) {
          setPackNote('Ready offline · Start over applied. You can turn net off.');
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
          setShellReady(true);
          setPackNote('Using pack already on this phone.');
          void warmupOfflineHunt().catch(() => {});
          return;
        }
        setStatus('error');
        setError(
          err.message
          || 'Need Wi‑Fi once to download your team pack.',
        );
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Pack + shell ready → enter login (works offline after this).
  useEffect(() => {
    if (status !== 'ready' || !team || !shellReady) return undefined;
    unlockHuntTaps();
    const t = window.setTimeout(() => {
      navigate(CAMPUS_HUNT_PATHS.offlineLogin, { replace: true });
    }, 700);
    return () => window.clearTimeout(t);
  }, [status, team, shellReady, navigate]);

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
      await purgeHuntAppCaches();
      try {
        sessionStorage.removeItem(`ch_hunt_shell_bust_${String(token || '').slice(0, 48)}`);
      } catch { /* ignore */ }
      window.location.reload();
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Could not clear pack');
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
          <p className="mt-8 text-sm text-white/50">Saving team pack…</p>
        ) : null}

        {status === 'error' ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => { void wipeAndRetry(); }}
              className="relative z-20 w-full rounded-xl border border-amber-400/40 bg-amber-500/15 py-3 text-sm font-bold text-amber-100 touch-manipulation"
            >
              Clear pack on this phone &amp; retry
            </button>
            <p className="text-[11px] leading-relaxed text-white/45">
              New pack links need data ON for one download. After that, airplane mode works.
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
              {shellReady ? 'Enter Hunt' : 'Caching… then Enter'}
            </button>

            <button
              type="button"
              onClick={() => { void wipeAndRetry(); }}
              className="relative z-20 w-full text-center text-xs text-white/40 underline hover:text-white/60 touch-manipulation"
            >
              Wrong pack? Clear &amp; reload
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
