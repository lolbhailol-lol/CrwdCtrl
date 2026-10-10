import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadOfflineBundle, loadOfflineSession } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { armOfflineNetworkGuard } from '../offlineNetworkGuard';
import OfflineHuntInstallHelp from '../components/OfflineHuntInstallHelp';
import { startOverHunt, applyServerStartOverIfNeeded } from '../startOverHunt';
import {
  HuntPageHeader,
  HuntPageShell,
  HuntPrimaryButton,
  MissionProgress,
} from '../../components/HuntV2Shell';

/** Pack hub — brand first, then enter hunt. */
export default function OfflineHuntLandingPage() {
  const navigate = useNavigate();
  const [existing, setExisting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    const cleanup = armOfflineNetworkGuard();
    return cleanup;
  }, []);

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
    <HuntPageShell>
      <div className="hunt-v2-page">
        <HuntPageHeader title="Offline Pack" backTo={CAMPUS_HUNT_PATHS.profileLogin} />
        <div className="hunt-v2-content">
          <MissionProgress label="Offline kit" step={6} />
          <section className="hunt-v2-card hunt-v2-card-accent hunt-v2-pack-hero">
            <img src="/campus-hunt/v2/pack-hero.svg" alt="" />
            <h1>{hasPack ? 'Ready for game day' : 'Install your team pack'}</h1>
            <p>{hasPack ? `DOWNLOADED • ${existing.team.teamCode}` : 'WI-FI NEEDED ONCE'}</p>
            {hasPack ? (
              <div className="hunt-v2-pack-metrics">
                <div><strong>Saved</strong><small>Pack</small></div>
                <div><strong>8 stops</strong><small>Route</small></div>
                <div><strong>Auto</strong><small>Sync</small></div>
              </div>
            ) : null}
          </section>

          {hasPack ? (
            <div className="mt-3 grid gap-3">
              <div className="hunt-v2-note p-4 text-sm"><strong className="block text-[color:var(--hunt-ink)]">Auto-sync enabled</strong>Leaderboard updates when internet returns.</div>
              <div className="hunt-v2-note p-4 text-sm"><strong className="block text-[color:var(--hunt-ink)]">Clues stay locked</strong>Organizer start code unlocks the hunt.</div>
              <HuntPrimaryButton onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineLogin)}>Continue</HuntPrimaryButton>
              <button type="button" disabled={busy} onClick={onStartOver} className="text-xs text-[color:var(--hunt-muted)] disabled:opacity-50">{busy ? 'Updating…' : 'Start over'}</button>
              {note ? <p className="text-center text-xs text-[color:var(--hunt-muted)]">{note}</p> : null}
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-4 text-sm text-[color:var(--hunt-muted)]">Open the private install link shared by your organizer while connected once.</p>
              <OfflineHuntInstallHelp packReady={false} forceInstall />
            </div>
          )}
        </div>
      </div>
    </HuntPageShell>
  );
}
