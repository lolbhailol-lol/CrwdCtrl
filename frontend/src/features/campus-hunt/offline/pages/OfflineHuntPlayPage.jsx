import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  loadOfflineBundle,
  loadOfflineSession,
  loadOfflineTeamState,
} from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';

function stageLabel(stage) {
  const map = {
    CLUE1_ACTIVE: 'Clue 1',
    CLUE2_ACTIVE: 'Clue 2',
    CLUE3_ACTIVE: 'Clue 3',
    CLUE4_ACTIVE: 'Prop hunt',
    CLUE5_ACTIVE: 'Final word',
    COMPLETED: 'Finished',
  };
  return map[stage] || stage || 'Starting';
}

export default function OfflineHuntPlayPage() {
  const [bundle, setBundle] = useState(null);
  const [session, setSession] = useState(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pack, sess] = await Promise.all([
          loadOfflineBundle(),
          loadOfflineSession(),
        ]);
        if (cancelled) return;
        if (!pack || !sess) {
          setLoading(false);
          return;
        }
        const teamState = await loadOfflineTeamState(sess.teamCode);
        if (cancelled) return;
        setBundle(pack);
        setSession(sess);
        setState(teamState);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white/60">
        Loading hunt…
      </div>
    );
  }

  if (!bundle || !session) {
    return <Navigate to={CAMPUS_HUNT_PATHS.offlineLogin} replace />;
  }

  const isLeader = session.role === 'leader';
  const currentClue = bundle.clues?.clue1;

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-6 text-white">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0ECCEE]">
            Offline · airplane mode OK
          </p>
          <h1 className="mt-1 text-lg font-bold">{bundle.team.teamName}</h1>
          <p className="text-xs text-white/50">
            {session.name}
            {' · '}
            {isLeader ? 'Leader' : 'Member'}
            {' · '}
            Score
            {' '}
            {state?.score ?? bundle.event.startingScore}
          </p>
          <p className="mt-2 text-xs text-white/45">
            Stage:
            {' '}
            <strong className="text-white">{stageLabel(state?.currentStage)}</strong>
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Now</p>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            {currentClue?.prompt || 'Solve clues in order. Scan campus poster QRs when prompted.'}
          </p>
          <p className="mt-3 text-[11px] text-white/45">
            Full play engine coming next — member proof QR, leader collect, and team sync QR.
          </p>
        </section>

        <section className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-xs text-amber-100">
          <p className="font-semibold">Sync without Wi‑Fi</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-100/90">
            <li>Each member scans poster → shows Member Scan Proof QR.</li>
            <li>Leader scans member QRs + enters team code to advance.</li>
            <li>Leader shows Team State QR → members scan to refresh.</li>
          </ul>
        </section>

        <div className="flex flex-wrap gap-3 text-xs">
          <Link to={CAMPUS_HUNT_PATHS.offlineLogin} className="text-white/45 underline">
            Switch person
          </Link>
          <Link to={CAMPUS_HUNT_PATHS.offline} className="text-white/45 underline">
            Pack info
          </Link>
        </div>
      </div>
    </div>
  );
}
