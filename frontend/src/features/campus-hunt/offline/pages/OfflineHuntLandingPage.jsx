import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OfflineBundleLoader, { OfflineNavLinks } from '../components/OfflineBundleLoader';
import { loadOfflineBundle } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';

export default function OfflineHuntLandingPage() {
  const navigate = useNavigate();
  const [existing, setExisting] = useState(null);

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

  const onLoaded = () => {
    navigate(CAMPUS_HUNT_PATHS.offlineLogin);
  };

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE]">
          Airplane mode · no Wi‑Fi needed
        </p>
        <h1 className="mt-2 text-2xl font-bold">Offline Campus Hunt</h1>
        <p className="mt-2 text-sm text-white/60">
          Load your team pack once on each phone. After that, play in airplane mode —
          scan campus posters, sync with QR handoffs between teammates.
        </p>

        {existing?.team?.teamCode ? (
          <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <p className="font-semibold text-emerald-200">
              Pack loaded:
              {' '}
              {existing.team.teamCode}
              {' '}
              ·
              {' '}
              {existing.team.teamName}
            </p>
            <button
              type="button"
              onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineLogin)}
              className="mt-2 rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-black"
            >
              Continue to login
            </button>
          </div>
        ) : null}

        <div className="mt-6">
          <OfflineBundleLoader onLoaded={onLoaded} />
        </div>

        <OfflineNavLinks />

        <ol className="mt-8 list-decimal space-y-2 pl-5 text-xs text-white/55">
          <li>Admin exports offline packs from the plant sheet (laptop, before fest).</li>
          <li>AirDrop / USB / share each team JSON to all 4 phones on that team.</li>
          <li>Load file here → enter team password → pick your name.</li>
          <li>Airplane mode at the venue. Leader submits clues; everyone scans posters + proof QRs.</li>
        </ol>
      </div>
    </div>
  );
}
