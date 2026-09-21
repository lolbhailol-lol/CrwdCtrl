import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchOfflineInstallPack, ackOfflineInstallPack } from '../../services/campusHunt.api';
import { loadOfflineBundle, saveOfflineBundle, clearOfflineSession } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';
import OfflineHuntInstallHelp from '../components/OfflineHuntInstallHelp';
import { warmupOfflineHunt } from '../warmupOfflineHunt';
import { refreshHuntAppShell, applyWaitingHuntUpdate } from '../refreshHuntAppShell';
import { rememberInstallToken, applyServerStartOverIfNeeded } from '../startOverHunt';

/**
 * Shared install link — save pack, refresh app shell, install Hunt, then login.
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

        if (existing?.team?.teamCode && !online) {
          if (cancelled) return;
          setTeam(existing.team);
          setPackMeta({
            exportBatchId: existing.exportBatchId || '',
            exportedAt: existing.exportedAt || '',
          });
          setPackNote('Pack ready on this phone (offline).');
          setStatus('ready');
          void warmupOfflineHunt().catch(() => {});
          return;
        }

        if (online) {
          const shell = await refreshHuntAppShell().catch(() => ({ waiting: false }));
          // New install links must not keep a stale Hunt shell (old rounds hub).
          if (!cancelled && shell?.waiting) {
            setUpdateWaiting(true);
            await applyWaitingHuntUpdate();
            return;
          }

          const res = await fetchOfflineInstallPack(token);
          const pack = res.data?.bundle || res.bundle;
          if (!pack?.team?.teamCode) throw new Error('Install pack is empty');

          const stamped = { ...pack, installToken: token };
          await saveOfflineBundle(stamped);
          try {
            await clearOfflineSession();
          } catch { /* ignore */ }
          rememberInstallToken(token);
          if (cancelled) return;
          setTeam(stamped.team);
          setPackMeta({
            exportBatchId: stamped.exportBatchId || res.data?.exportBatchId || '',
            exportedAt: stamped.exportedAt || '',
          });
          setStatus('ready');
          setPackNote('Latest team pack saved.');
          try {
            await ackOfflineInstallPack(token, navigator.userAgent || '');
          } catch { /* best-effort */ }
          await warmupOfflineHunt().catch(() => {});
          const sync = await applyServerStartOverIfNeeded(stamped).catch(() => null);
          if (!cancelled && sync?.applied) {
            setPackNote('Latest team pack saved. Admin Start over applied.');
          }
          return;
        }

        throw new Error('Need Wi‑Fi once to download your team pack.');
      } catch (err) {
        if (cancelled) return;
        const existing = await loadOfflineBundle().catch(() => null);
        if (existing?.team?.teamCode) {
          setTeam(existing.team);
          setPackMeta({
            exportBatchId: existing.exportBatchId || '',
            exportedAt: existing.exportedAt || '',
          });
          setStatus('ready');
          setPackNote('Using pack already on this phone.');
          void warmupOfflineHunt().catch(() => {});
          return;
        }
        setStatus('error');
        setError(err.message || 'Need Wi‑Fi once to download your team pack.');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const goLogin = () => navigate(CAMPUS_HUNT_PATHS.offlineLogin);

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
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
          <p className="mt-8 text-sm text-red-300">{error}</p>
        ) : null}

        {status === 'ready' && team ? (
          <div className="mt-6 space-y-4">
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
                className="w-full rounded-xl border border-amber-400/40 bg-amber-500/15 py-3 text-sm font-bold text-amber-100"
              >
                Update ready — reload Hunt
              </button>
            ) : null}

            <button
              type="button"
              onClick={goLogin}
              className="w-full rounded-xl bg-[#0ECCEE] py-4 text-sm font-bold text-black"
            >
              {appInstalled ? 'Continue' : 'Continue to login'}
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
