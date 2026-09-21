import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadOfflineBundle } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { OfflineStorageBadge } from '../components/OfflineScoreBoard';
import { armOfflineNetworkGuard } from '../offlineNetworkGuard';
import OfflineHuntInstallHelp from '../components/OfflineHuntInstallHelp';
import OfflineBundleLoader from '../components/OfflineBundleLoader';
import { startOverHunt } from '../startOverHunt';
import { applyWaitingHuntUpdate } from '../refreshHuntAppShell';

/**
 * Lean Hunt welcome — pack already on phone → one clear path in.
 */
export default function OfflineHuntLandingPage() {
  const navigate = useNavigate();
  const [existing, setExisting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const [showTools, setShowTools] = useState(false);

  useEffect(() => armOfflineNetworkGuard(), []);

  useEffect(() => {
    let cancelled = false;
    loadOfflineBundle()
      .then((bundle) => {
        if (!cancelled) setExisting(bundle);
      })
      .catch(() => {
        if (!cancelled) setExisting(null);
      });
    return () => { cancelled = true; };
  }, []);

  const hasPack = Boolean(existing?.team?.teamCode);
  const startName = existing?.team?.startingPoint?.name;

  const onStartOver = async () => {
    if (!window.confirm('Start over? Clears hunt progress on this phone and pulls the latest pack when online.')) {
      return;
    }
    setBusy(true);
    setNote('');
    try {
      const result = await startOverHunt({
        teamCode: existing?.team?.teamCode,
      });
      setNote(result.message);
      setUpdateWaiting(Boolean(result.updateWaiting));
      if (result.bundle) setExisting(result.bundle);
      navigate(CAMPUS_HUNT_PATHS.offlineLogin);
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
            <h1 className="mt-3 text-3xl font-black tracking-tight">Welcome</h1>
            <p className="mt-2 text-sm text-white/60">
              Leader phone for
              {' '}
              <span className="font-mono text-[#0ECCEE]">{existing.team.teamCode}</span>
              {existing.team.teamName ? ` · ${existing.team.teamName}` : ''}
            </p>
            {startName ? (
              <p className="mt-1 text-sm text-white/45">Meet at {startName}</p>
            ) : null}

            <OfflineStorageBadge />

            <button
              type="button"
              onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineLogin)}
              className="mt-8 w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black"
            >
              Continue
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onStartOver}
              className="mt-3 w-full rounded-2xl border border-white/15 py-3 text-sm font-semibold text-white/75 disabled:opacity-50"
            >
              {busy ? 'Updating…' : 'Start over · get latest'}
            </button>

            {note ? (
              <p className="mt-3 text-center text-xs text-white/50">{note}</p>
            ) : null}

            {updateWaiting ? (
              <button
                type="button"
                onClick={() => { void applyWaitingHuntUpdate(); }}
                className="mt-3 w-full rounded-xl bg-white/10 py-3 text-xs font-bold text-[#0ECCEE]"
              >
                App update ready — tap to reload
              </button>
            ) : null}

            <p className="mt-8 text-center text-[11px] text-white/35">
              Airplane mode OK at the fest · re-open your install link on Wi‑Fi for updates
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Install Hunt</h1>
            <p className="mt-2 text-sm text-white/60">
              Open your team&apos;s shared install link on Wi‑Fi once, then add Hunt to your home screen.
            </p>
            <OfflineStorageBadge />
            <div className="mt-6">
              <OfflineHuntInstallHelp packReady={false} />
            </div>
          </>
        )}

        <details
          className="mt-10"
          open={showTools}
          onToggle={(e) => setShowTools(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-xs text-white/35">
            Advanced · load JSON pack
          </summary>
          <div className="mt-3">
            <OfflineBundleLoader
              onLoaded={(bundle) => {
                setExisting(bundle);
                navigate(CAMPUS_HUNT_PATHS.offlineLogin);
              }}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
