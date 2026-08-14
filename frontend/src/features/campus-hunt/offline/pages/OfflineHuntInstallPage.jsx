import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchOfflineInstallPack } from '../../services/campusHunt.api';
import { loadOfflineBundle, saveOfflineBundle } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { OfflineStorageBadge } from '../components/OfflineScoreBoard';

export default function OfflineHuntInstallPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [team, setTeam] = useState(null);

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
        if (existing?.team?.teamCode && !navigator.onLine) {
          setTeam(existing.team);
          setStatus('ready');
          return;
        }
        const res = await fetchOfflineInstallPack(token);
        const pack = res.data?.bundle || res.bundle;
        if (!pack?.team?.teamCode) throw new Error('Install pack is empty');
        await saveOfflineBundle(pack);
        if (cancelled) return;
        setTeam(pack.team);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        const existing = await loadOfflineBundle().catch(() => null);
        if (existing?.team?.teamCode) {
          setTeam(existing.team);
          setStatus('ready');
          return;
        }
        setStatus('error');
        setError(
          err.message
          || 'Need Wi‑Fi once to install this team pack. Open this same link at home, then use airplane mode at the fest.',
        );
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE]">
          Offline Event Mode
        </p>
        <h1 className="mt-2 text-2xl font-bold">Install on this phone</h1>
        <p className="mt-2 text-sm text-white/60">
          One link per team. Do this on Wi‑Fi today. The hunt does not start from this link.
          At the fest: airplane mode → home-screen icon → password → name → wait at start until the leader starts Round 1.
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
              <p className="mt-2 text-xs text-emerald-100/80">Pack saved on this phone.</p>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-white/70">
              <li>
                Chrome: menu → <strong className="text-white">Add to Home screen</strong>
                {' '}(iPhone: Share → Add to Home Screen).
              </li>
              <li>All 4 teammates must open this same link on their own phones.</li>
              <li>At the venue: airplane mode → tap the home-screen icon → team password → your name. Wait on the hub. Leader starts Round 1 at the start desk.</li>
            </ol>
            <button
              type="button"
              onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineLogin)}
              className="w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
            >
              Continue to team login
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
