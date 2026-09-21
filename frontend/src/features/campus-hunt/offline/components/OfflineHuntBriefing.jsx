import { useEffect, useState } from 'react';
import HuntScoringGuide from '../../components/HuntScoringGuide';
import { getHuntStartGate } from '../offlineEngine';

/** Briefing — type organizer start code → hunt begins. */
export default function OfflineHuntBriefing({
  bundle,
  session,
  onStartHunt,
  starting = false,
  error = '',
  onBackToRounds,
}) {
  const isLeader = session?.role === 'leader';
  const startName = bundle?.team?.startingPoint?.name;
  const startingScore = Number(bundle?.event?.startingScore) > 0
    ? Number(bundle.event.startingScore)
    : (Number(bundle?.event?.scoringConfig?.startingScore) || 100);
  const expectsGo = Boolean(String(bundle?.event?.organizerStartCode || 'GO').trim());

  const [goCode, setGoCode] = useState('');
  const [gate, setGate] = useState(() => getHuntStartGate(bundle, new Date(), { goCode: '' }));

  useEffect(() => {
    setGate(getHuntStartGate(bundle, new Date(), { goCode }));
  }, [bundle, goCode]);

  const canStart = isLeader && gate.open && !starting;

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md space-y-5">
        {onBackToRounds ? (
          <button
            type="button"
            onClick={onBackToRounds}
            className="text-xs text-white/40"
          >
            ← Home
          </button>
        ) : null}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE]">
            CrwdCtrl Hunt
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {bundle?.team?.teamCode}
          </h1>
          {startName ? (
            <p className="mt-2 text-sm text-white/55">Meet at {startName}</p>
          ) : null}
        </div>

        {expectsGo ? (
          <div className="rounded-2xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-4">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
              Start code
            </p>
            <p className="mt-2 text-center text-sm text-white/70">
              Wait at the gather point. When the organizer tells everyone the code, type it below — then Start.
            </p>
            <label className="mt-4 block text-xs uppercase tracking-wide text-white/45">
              Code
              <input
                value={goCode}
                onChange={(e) => setGoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
                placeholder="Organizer will tell you"
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center font-mono text-xl tracking-[0.2em] outline-none focus:border-[#0ECCEE]"
                autoComplete="off"
                autoCapitalize="characters"
              />
            </label>
            {goCode && !gate.open ? (
              <p className="mt-2 text-center text-xs text-rose-300">Not the right code yet</p>
            ) : null}
          </div>
        ) : null}

        <HuntScoringGuide startingScore={startingScore} />

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {isLeader ? (
          <button
            type="button"
            disabled={!canStart}
            onClick={() => onStartHunt?.(goCode)}
            className="w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black disabled:opacity-40"
          >
            {starting
              ? 'Starting…'
              : gate.open
                ? 'Start the hunt'
                : 'Enter start code…'}
          </button>
        ) : (
          <p className="text-center text-sm text-white/50">
            Use the leader phone to start.
          </p>
        )}
      </div>
    </div>
  );
}
