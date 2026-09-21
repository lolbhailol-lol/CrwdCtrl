import ScoreChip from '../../components/ScoreChip';

/** Lean briefing before the hunt clock starts. */
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
  const startName = bundle?.team?.startingPoint?.name || 'your start';

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        {onBackToRounds ? (
          <button
            type="button"
            onClick={onBackToRounds}
            className="text-xs text-white/40"
          >
            ← Back
          </button>
        ) : null}

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE]">
              The Hunt
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {bundle?.team?.teamCode}
            </h1>
            <p className="mt-1 text-sm text-white/55">
              Meet at {startName}
            </p>
          </div>
          <ScoreChip score={state?.score} label="Score" />
        </div>

        <section className="mt-8 rounded-3xl border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 p-5">
          <p className="text-sm font-semibold text-white">Quick path</p>
          <ul className="mt-3 space-y-1.5 text-sm text-white/65">
            <li>1 · Type place → orange</li>
            <li>2 · Plant word → green</li>
            <li>3 · Lockbox → blue</li>
            <li>4 · Laptop · Zip Grid → purple</li>
            <li>5 · Team word → red</li>
            <li>6 · Mindspark Lobby finish</li>
          </ul>
          <p className="mt-4 text-xs text-white/45">
            One phone. Teammates walk with you.
          </p>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          {isLeader ? (
            <button
              type="button"
              disabled={starting}
              onClick={onStartHunt}
              className="mt-5 w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'Start the hunt'}
            </button>
          ) : (
            <p className="mt-5 text-center text-sm text-white/50">
              Use the leader phone to start.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
