import ScoreChip from '../../components/ScoreChip';

export default function OfflineHuntBriefing({
  bundle,
  session,
  state,
  onStartHunt,
  starting = false,
  error = '',
  onBackToRounds,
}) {
  const isLeader = session?.role === 'leader';
  const startName = bundle?.team?.startingPoint?.name || 'your start desk';

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-8 text-white">
      <div className="mx-auto max-w-lg">
        {onBackToRounds ? (
          <button
            type="button"
            onClick={onBackToRounds}
            className="text-xs text-white/45"
          >
            ← Rounds
          </button>
        ) : null}
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
              Round 1 · Offline
            </p>
            <h1 className="mt-1 text-[1.35rem] font-semibold">
              {bundle?.team?.teamCode}
            </h1>
            <p className="mt-1 text-sm text-white/55">
              {session?.name || 'Leader phone'}
            </p>
          </div>
          <ScoreChip score={state?.score} label="Score" />
        </div>

        <section className="mt-6 rounded-2xl border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 p-4">
          <p className="text-sm font-semibold text-white">Meet at {startName}</p>
          <p className="mt-2 text-sm text-white/70">
            One phone — answers and scans happen here. Teammates walk with you.
          </p>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          {isLeader ? (
            <button
              type="button"
              disabled={starting}
              onClick={onStartHunt}
              className="mt-4 w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'Start Round 1'}
            </button>
          ) : (
            <p className="mt-4 text-center text-sm text-white/50">
              Use the leader phone to start.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
