import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchOfflineInstallPack, ackOfflineInstallPack } from '../../services/campusHunt.api';
import { loadOfflineBundle, saveOfflineBundle } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';
import OfflineHuntInstallHelp from '../components/OfflineHuntInstallHelp';
import { warmupOfflineHunt } from '../warmupOfflineHunt';
import { refreshHuntAppShell } from '../refreshHuntAppShell';
import { rememberInstallToken, applyServerStartOverIfNeeded } from '../startOverHunt';

/**
 * Shared install link — save pack, install Hunt, then enter password.
 */
export default function OfflineHuntInstallPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [team, setTeam] = useState(null);
  const [packNote, setPackNote] = useState('');
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
          setPackNote('Pack ready on this phone.');
          setStatus('ready');
          void warmupOfflineHunt().catch(() => {});
          return;
        }

        if (existing?.team?.teamCode) {
          if (cancelled) return;
          setTeam(existing.team);
          setStatus('ready');
        }

        if (online) {
          const shell = await refreshHuntAppShell().catch(() => ({ waiting: false }));
          if (!cancelled && shell?.waiting) setUpdateWaiting(true);

          const res = await fetchOfflineInstallPack(token);
          const pack = res.data?.bundle || res.bundle;
          if (!pack?.team?.teamCode) throw new Error('Install pack is empty');

          const stamped = { ...pack, installToken: token };
          await saveOfflineBundle(stamped);
          rememberInstallToken(token);
          if (cancelled) return;
          setTeam(stamped.team);
          setStatus('ready');
          setPackNote('Team pack saved.');
          try {
            await ackOfflineInstallPack(token, navigator.userAgent || '');
          } catch { /* best-effort */ }
          await warmupOfflineHunt().catch(() => {});
          const sync = await applyServerStartOverIfNeeded(stamped).catch(() => null);
          if (!cancelled && sync?.applied) {
            setPackNote('Team pack saved. Admin Start over applied.');
          }
          return;
        }

        throw new Error('Need Wi‑Fi once to download your team pack.');
      } catch (err) {
        if (cancelled) return;
        const existing = await loadOfflineBundle().catch(() => null);
        if (existing?.team?.teamCode) {
          setTeam(existing.team);
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

        {status === 'loading' ? (
          <p className="mt-8 text-sm text-white/50">Saving team pack…</p>
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
