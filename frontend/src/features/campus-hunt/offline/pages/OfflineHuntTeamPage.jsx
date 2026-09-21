import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import ScoreChip from '../../components/ScoreChip';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { useOfflineHuntSession } from '../useOfflineHuntSession';
import { startOverHunt } from '../startOverHunt';
import { applyWaitingHuntUpdate } from '../refreshHuntAppShell';

export default function OfflineHuntTeamPage() {
  const navigate = useNavigate();
  const { bundle, session, state, loading } = useOfflineHuntSession();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [updateWaiting, setUpdateWaiting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white/60">
        Loading…
      </div>
    );
  }

  if (!bundle || !session) {
    return <Navigate to={CAMPUS_HUNT_PATHS.offlineLogin} replace />;
  }

  const startName = bundle.team?.startingPoint?.name;
  const waiting = String(state?.currentStage || '') === 'WAITING';

  const onStartOver = async () => {
    if (!window.confirm('Start over? Clears progress and pulls the latest pack when online.')) {
      return;
    }
    setBusy(true);
    setNote('');
    try {
      const result = await startOverHunt({ teamCode: bundle.team.teamCode });
      setNote(result.message);
      setUpdateWaiting(Boolean(result.updateWaiting));
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE]">
          CrwdCtrl Hunt
        </p>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              {bundle.team.teamCode}
            </h1>
            {bundle.team.teamName ? (
              <p className="mt-1 text-sm text-white/50">{bundle.team.teamName}</p>
            ) : null}
            {startName ? (
              <p className="mt-2 text-sm text-white/60">Meet at {startName}</p>
            ) : null}
          </div>
          <ScoreChip score={state?.score} label="Score" />
        </div>

        <section className="mt-8 rounded-3xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 p-5">
          <p className="text-sm font-semibold text-white">
            {waiting ? 'Ready when you are' : 'Continue the hunt'}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            One phone. Walk together. Type clues, scan posters, finish at Mindspark Lobby.
          </p>
        </section>

        <button
          type="button"
          onClick={() => navigate(CAMPUS_HUNT_PATHS.offlineRounds)}
          className="mt-6 w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black"
        >
          {waiting ? 'Go to The Hunt' : 'Continue'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onStartOver}
          className="mt-3 w-full rounded-2xl border border-white/12 py-3 text-xs font-semibold text-white/55 disabled:opacity-50"
        >
          {busy ? 'Updating…' : 'Start over · get latest'}
        </button>

        {note ? <p className="mt-2 text-center text-xs text-white/45">{note}</p> : null}
        {updateWaiting ? (
          <button
            type="button"
            onClick={() => { void applyWaitingHuntUpdate(); }}
            className="mt-2 w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold text-[#0ECCEE]"
          >
            App update ready — tap to reload
          </button>
        ) : null}

        <Link
          to={CAMPUS_HUNT_PATHS.offline}
          className="mt-6 block text-center text-xs text-white/35"
        >
          Hunt home
        </Link>
      </div>
    </div>
  );
}
