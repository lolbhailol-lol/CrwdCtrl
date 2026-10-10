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
import { getOfflineDeviceId } from '../offlineBoardSync';
import { dismissBootOverlays } from '../../../../utils/dismissBootOverlays';
import {
  HuntPageHeader,
  HuntPageShell,
  HuntPrimaryButton,
  MissionProgress,
} from '../../components/HuntV2Shell';

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

        const deviceId = getOfflineDeviceId();
        const res = await fetchOfflineInstallPack(token, deviceId);
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
          await ackOfflineInstallPack(token, deviceId, navigator.userAgent || '');
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
    <HuntPageShell>
      <div className="hunt-v2-page relative z-10" style={{ pointerEvents: 'auto' }}>
        <HuntPageHeader title="Offline Pack" backTo={CAMPUS_HUNT_PATHS.offline} />
        <div className="hunt-v2-content">
          <MissionProgress label="Offline kit" step={6} />

          {status === 'loading' ? (
            <section className="hunt-v2-card hunt-v2-card-accent hunt-v2-pack-hero">
              <img src="/campus-hunt/v2/pack-hero.svg" alt="" />
              <h1>Saving team pack…</h1>
              <p>KEEP THIS SCREEN OPEN</p>
            </section>
          ) : null}

          {status === 'error' ? (
            <section className="hunt-v2-card p-4">
              <p className="hunt-v2-error">{error}</p>
              <button type="button" onClick={() => void wipeAndRetry()} className="hunt-v2-secondary mt-4">Clear pack &amp; retry</button>
              <p className="mt-3 text-xs text-[color:var(--hunt-muted)]">New pack links need data once. After download, airplane mode works.</p>
            </section>
          ) : null}

          {status === 'ready' && team ? (
            <div className="grid gap-3">
              <section className="hunt-v2-card hunt-v2-card-accent hunt-v2-pack-hero">
                <img src="/campus-hunt/v2/pack-hero.svg" alt="" />
                <h1>Ready for game day</h1>
                <p>DOWNLOADED • {team.teamCode}</p>
                <div className="hunt-v2-pack-metrics">
                  <div><strong>Saved</strong><small>Pack</small></div>
                  <div><strong>8 stops</strong><small>Route</small></div>
                  <div><strong>Auto</strong><small>Sync</small></div>
                </div>
                <div className="mt-3 w-full text-left text-[9px] font-bold text-[color:var(--hunt-muted)]">KIT READINESS <span className="float-right text-[#00a16a]">100%</span></div>
                <div className="hunt-v2-track mt-1 w-full"><span style={{ width: '100%' }} /></div>
              </section>

              <div className="hunt-v2-note p-4 text-sm"><strong className="block text-[color:var(--hunt-ink)]">Auto-sync enabled</strong>Leaderboard refreshes whenever internet returns.</div>
              <div className="hunt-v2-note p-4 text-sm"><strong className="block text-[color:var(--hunt-ink)]">Clues stay locked</strong>Organizer start code unlocks the hunt.</div>

              {!appInstalled || updateWaiting ? (
                <OfflineHuntInstallHelp
                  packReady
                  forceInstall={!appInstalled}
                  teamCode={team.teamCode}
                  updateWaiting={updateWaiting}
                  packNote={packNote}
                  onInstalled={() => setAppInstalled(true)}
                />
              ) : null}

              {updateWaiting ? <button type="button" onClick={() => void applyWaitingHuntUpdate()} className="hunt-v2-secondary">Update &amp; reload Hunt</button> : null}
              <HuntPrimaryButton disabled={!shellReady} onClick={goLogin}>{shellReady ? 'Continue' : 'Caching…'}</HuntPrimaryButton>
              <button type="button" onClick={() => void wipeAndRetry()} className="text-xs text-[color:var(--hunt-muted)] underline">Wrong pack? Clear &amp; reload</button>
              {packMeta?.exportedAt ? <p className="text-[10px] text-[color:var(--hunt-muted)]">Pack export · {new Date(packMeta.exportedAt).toLocaleString()}</p> : null}
            </div>
          ) : status === 'loading' ? null : !team ? <OfflineHuntInstallHelp packReady={false} forceInstall /> : null}
        </div>
      </div>
    </HuntPageShell>
  );
}
