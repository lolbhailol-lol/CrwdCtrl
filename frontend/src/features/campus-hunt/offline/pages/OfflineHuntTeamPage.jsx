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
  const isLeader = session.role === 'leader';

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
          Your team
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.35rem] font-semibold">
              {bundle.team.teamCode}
              {bundle.team.teamName ? (
                <span className="font-normal text-white/50">
                  {' '}
                  ·
                  {' '}
                  {bundle.team.teamName}
                </span>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-white/55">
              {isLeader ? 'Leader' : 'Player'}
              {' · '}
              {session.name}
            </p>
            {startName ? (
              <p className="mt-1 text-sm text-white/45">Start desk: {startName}</p>
            ) : null}
          </div>
          <ScoreChip score={state?.score} label="Score" />
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            How to play
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/80">
            <li>Stay together at your start desk.</li>
            <li>Leader types answers. Everyone else helps read.</li>
            <li>All 4 scan the color poster (orange → green → blue → purple).</li>
            <li>Members show proof QR. Leader collects, then types the team code.</li>
            <li>Leader shows Team QR so every phone stays in sync.</li>
          </ol>
        </section>

        <p className="mt-4 text-sm text-white/55">
          The hunt does not start on this page. Next you pick Round 1.
        </p>

        <button
          type="button"
          onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineRounds)}
          className="mt-6 w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black"
        >
          Continue to rounds
        </button>
        <Link
          to={CAMPUS_HUNT_PATHS.offlineLogin}
          className="mt-4 block w-full py-2 text-center text-xs text-white/35"
        >
          Not you? Switch person
        </Link>
      </div>
    </div>
  );
}
