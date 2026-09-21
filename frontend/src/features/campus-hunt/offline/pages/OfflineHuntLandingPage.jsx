import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadOfflineBundle, loadOfflineSession } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { armOfflineNetworkGuard } from '../offlineNetworkGuard';
import OfflineHuntInstallHelp from '../components/OfflineHuntInstallHelp';
import { startOverHunt, applyServerStartOverIfNeeded } from '../startOverHunt';

/** Pack hub — brand first, then enter hunt. */
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
    <div className="relative min-h-screen overflow-hidden text-white">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700&display=swap"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(14,204,238,0.22), transparent 55%),'
            + 'linear-gradient(165deg, #07090b 0%, #0b1218 50%, #0a0c0e 100%)',
        }}
      />

      <div
        className="relative mx-auto max-w-md px-5 py-10"
        style={{ fontFamily: 'Outfit, Poppins, sans-serif' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]/90">
          CrwdCtrl × Mindspark
        </p>
        <h1
          className="mt-3 text-[3.1rem] leading-[0.9] tracking-wide text-white"
          style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}
        >
          Campus Hunt
        </h1>
        <p
          className="mt-1 text-xl tracking-[0.08em] text-[#0ECCEE]"
          style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}
        >
          Challenge
        </p>
        <p className="mt-3 text-sm text-white/50">
          Powered by CrwdCtrl · Mindspark COEP Fest collaboration
        </p>

        {hasPack ? (
          <>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="font-mono text-xl font-bold tracking-wide">
                {existing.team.teamCode}
              </p>
              {existing.team.teamName ? (
                <p className="mt-1 text-sm text-white/50">{existing.team.teamName}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineLogin)}
              className="mt-6 w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black"
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
            <h2 className="mt-8 text-lg font-semibold text-white">Install Hunt</h2>
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
