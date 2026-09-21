import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadOfflineBundle, loadOfflineSession } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { armOfflineNetworkGuard } from '../offlineNetworkGuard';
import OfflineHuntInstallHelp from '../components/OfflineHuntInstallHelp';
import { startOverHunt, applyServerStartOverIfNeeded } from '../startOverHunt';

/** One welcome screen — pack on phone → login or play. */
export default function OfflineHuntLandingPage() {
  const navigate = useNavigate();
  const [existing, setExisting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => armOfflineNetworkGuard(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let bundle = await loadOfflineBundle().catch(() => null);
      if (bundle?.team?.teamCode) {
        const sync = await applyServerStartOverIfNeeded(bundle).catch(() => null);
        if (sync?.applied) {
          bundle = sync.bundle || bundle;
          if (!cancelled && sync.message) setNote(sync.message);
        }
      }
      const session = await loadOfflineSession().catch(() => null);
      if (cancelled) return;
      setExisting(bundle);
      if (bundle?.team?.teamCode && session?.teamCode === bundle.team.teamCode && session?.memberKey) {
        navigate(CAMPUS_HUNT_PATHS.offlinePlay, { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const hasPack = Boolean(existing?.team?.teamCode);

  const onStartOver = async () => {
    if (!window.confirm('Start over? Clears progress on this phone.')) return;
    setBusy(true);
    setNote('');
    try {
      const result = await startOverHunt({ teamCode: existing?.team?.teamCode });
      setNote(result.message);
      if (result.bundle) setExisting(result.bundle);
      navigate(CAMPUS_HUNT_PATHS.offlineLogin, { replace: true });
    } catch (err) {
      setNote(err.message || 'Could not start over');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0ECCEE]">
          CrwdCtrl Hunt
        </p>

        {hasPack ? (
          <>
            <h1 className="mt-3 text-3xl font-black tracking-tight">
              {existing.team.teamCode}
            </h1>
            {existing.team.teamName ? (
              <p className="mt-1 text-sm text-white/50">{existing.team.teamName}</p>
            ) : null}

            <button
              type="button"
              onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineLogin)}
              className="mt-8 w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black"
            >
              Enter Hunt
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onStartOver}
              className="mt-3 w-full py-2 text-xs text-white/40 disabled:opacity-50"
            >
              {busy ? 'Updating…' : 'Start over'}
            </button>
            {note ? <p className="mt-2 text-center text-xs text-white/45">{note}</p> : null}
          </>
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Install Hunt</h1>
            <p className="mt-2 text-sm text-white/55">
              Open your team install link on Wi‑Fi first.
            </p>
            <div className="mt-6">
              <OfflineHuntInstallHelp packReady={false} forceInstall />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
