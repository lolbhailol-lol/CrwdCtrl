import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchOfflineInstallPack, ackOfflineInstallPack } from '../../services/campusHunt.api';
import { loadOfflineBundle, saveOfflineBundle } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { OfflineStorageBadge } from '../components/OfflineScoreBoard';
import OfflineHuntInstallHelp from '../components/OfflineHuntInstallHelp';
import { warmupOfflineHunt } from '../warmupOfflineHunt';
import { refreshHuntAppShell } from '../refreshHuntAppShell';
import { rememberInstallToken } from '../startOverHunt';

export default function OfflineHuntInstallPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [team, setTeam] = useState(null);
  const [packNote, setPackNote] = useState('');
  const [updateWaiting, setUpdateWaiting] = useState(false);

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

        // Offline with a pack already saved — play with what you have.
        if (existing?.team?.teamCode && !online) {
          if (cancelled) return;
          setTeam(existing.team);
          setPackNote('Using pack already on this phone (offline).');
          setStatus('ready');
          void warmupOfflineHunt().catch(() => {});
          return;
        }

        if (existing?.team?.teamCode) {
          if (cancelled) return;
          setTeam(existing.team);
          setStatus('ready');
          setPackNote('Checking for the latest pack + Hunt app…');
        }

        // Always try fresh pack + app shell when online so shared links stay current.
        if (online) {
          const shell = await refreshHuntAppShell().catch(() => ({ waiting: false }));
          if (!cancelled && shell?.waiting) setUpdateWaiting(true);

          const res = await fetchOfflineInstallPack(token);
          const pack = res.data?.bundle || res.bundle;
          if (!pack?.team?.teamCode) throw new Error('Install pack is empty');

          const prevBatch = String(existing?.exportBatchId || '');
          const nextBatch = String(pack.exportBatchId || '');
          const wasUpdate = Boolean(existing?.team?.teamCode);
          const stamped = { ...pack, installToken: token };
          await saveOfflineBundle(stamped);
          rememberInstallToken(token);
          if (cancelled) return;
          setTeam(stamped.team);
          setStatus('ready');
          if (!wasUpdate) {
            setPackNote('Latest pack saved on this phone.');
          } else if (prevBatch && nextBatch && prevBatch !== nextBatch) {
            setPackNote('Pack updated to the latest export.');
          } else {
            setPackNote('Pack is up to date. Re-open this link anytime for updates.');
          }
          try {
            await ackOfflineInstallPack(token, navigator.userAgent || '');
          } catch { /* best-effort */ }
          setPackNote((note) => `${note} Caching Hunt pages…`);
          await warmupOfflineHunt().catch(() => {});
          if (cancelled) return;
          setPackNote((note) => note.replace(' Caching Hunt pages…', ' Ready for airplane mode.'));
          return;
        }

        // Offline and no pack — cannot install.
        throw new Error(
          'Need Wi‑Fi once to install this team pack. Open this same link in Chrome, then use airplane mode at the fest.',
        );
      } catch (err) {
        if (cancelled) return;
        const existing = await loadOfflineBundle().catch(() => null);
        if (existing?.team?.teamCode) {
          setTeam(existing.team);
          setStatus('ready');
          setPackNote('Could not refresh online — using the pack already on this phone.');
          void warmupOfflineHunt().catch(() => {});
          return;
        }
        setStatus('error');
        setError(
          err.message
          || 'Need Wi‑Fi once to install this team pack. Open this same link in Chrome at home, then use airplane mode at the fest.',
        );
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE]">
          CrwdCtrl Hunt · Offline
        </p>
        <h1 className="mt-2 text-2xl font-bold">Your team pack link</h1>
        <p className="mt-2 text-sm text-white/60">
          Install <span className="text-white">CrwdCtrl Hunt</span> on this phone (leader only).
          Open this link again on Wi‑Fi anytime — pack + app updates download automatically.
        </p>
        <OfflineStorageBadge />

        {status === 'loading' ? (
          <p className="mt-8 text-sm text-white/50">Saving your team pack on this phone…</p>
        ) : null}

        {status === 'error' ? (
          <p className="mt-8 text-sm text-red-300">{error}</p>
        ) : null}

        {status === 'ready' && team ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <p className="font-mono text-lg font-bold text-emerald-200">{team.teamCode}</p>
              <p className="text-sm text-white/70">{team.teamName}</p>
            </div>
            <OfflineHuntInstallHelp
              packReady
              forceInstall
              teamCode={team.teamCode}
              updateWaiting={updateWaiting}
              packNote={packNote}
            />
            <button
              type="button"
              onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineLogin)}
              className="w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black"
            >
              Continue to team login
            </button>
            <button
              type="button"
              onClick={() => navigate(CAMPUS_HUNT_PATHS.offline)}
              className="w-full rounded-xl border border-white/15 py-2.5 text-xs font-semibold text-white/70"
            >
              Open Hunt home
            </button>
          </div>
        ) : status === 'loading' ? null : (
          <div className="mt-8">
            <OfflineHuntInstallHelp packReady={false} forceInstall />
          </div>
        )}
      </div>
    </div>
  );
}
