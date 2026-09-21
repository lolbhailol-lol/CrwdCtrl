import { Link, Navigate, useNavigate } from 'react-router-dom';
import ScoreChip from '../../components/ScoreChip';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { useOfflineHuntSession } from '../useOfflineHuntSession';

export default function OfflineHuntTeamPage() {
  const navigate = useNavigate();
  const { bundle, session, state, loading } = useOfflineHuntSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white/60">
        Loading team…
      </div>
    );
  }

  if (!bundle || !session) {
    return <Navigate to={CAMPUS_HUNT_PATHS.offlineLogin} replace />;
  }

  const startName = bundle.team?.startingPoint?.name;

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
          Offline pack
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.35rem] font-semibold">
              {bundle.team.teamCode}
            </h1>
            {bundle.team.teamName ? (
              <p className="mt-0.5 text-sm text-white/50">{bundle.team.teamName}</p>
            ) : null}
            <p className="mt-1 text-sm text-white/55">
              Leader · {session.name}
            </p>
            {startName ? (
              <p className="mt-1 text-sm text-white/45">Start: {startName}</p>
            ) : null}
          </div>
          <ScoreChip score={state?.score} label="Score" />
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <p>One phone. Solve clues, scan posters, finish at Mindspark Lobby.</p>
        </section>

        <button
          type="button"
          onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineRounds)}
          className="mt-6 w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
        >
          Continue
        </button>
        <Link
          to={CAMPUS_HUNT_PATHS.offlineLogin}
          className="mt-3 block text-center text-xs text-white/40"
        >
          Switch pack / re-login
        </Link>
      </div>
    </div>
  );
}
