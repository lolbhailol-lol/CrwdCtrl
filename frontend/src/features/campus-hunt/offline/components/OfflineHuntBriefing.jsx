/** Lean briefing — one screen before the clock. */
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

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        {onBackToRounds ? (
          <button
            type="button"
            onClick={onBackToRounds}
            className="text-xs text-white/40"
          >
            ← Home
          </button>
        ) : null}

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0ECCEE]">
          CrwdCtrl Hunt
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          {bundle?.team?.teamCode}
        </h1>
        {startName ? (
          <p className="mt-2 text-sm text-white/55">Meet at {startName}</p>
        ) : null}
        <p className="mt-4 text-sm text-white/60">
          One phone. Walk together. Type answers, scan posters.
        </p>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        {isLeader ? (
          <button
            type="button"
            disabled={starting}
            onClick={onStartHunt}
            className="mt-8 w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black disabled:opacity-50"
          >
            {starting ? 'Starting…' : 'Start the hunt'}
          </button>
        ) : (
          <p className="mt-8 text-center text-sm text-white/50">
            Use the leader phone to start.
          </p>
        )}
      </div>
    </div>
  );
}
