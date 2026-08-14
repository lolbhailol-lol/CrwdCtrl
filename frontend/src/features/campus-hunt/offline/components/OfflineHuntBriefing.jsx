import ScoreChip from '../../components/ScoreChip';

export default function OfflineHuntBriefing({
  bundle,
  session,
  state,
  onStartHunt,
  starting = false,
  error = '',
  onSwitchPerson,
  onBackToRounds,
}) {
  const isLeader = session?.role === 'leader';
  const startName = bundle?.team?.startingPoint?.name || 'your start desk';

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-8 pb-28 text-white">
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
              Round 1
            </p>
            <h1 className="mt-1 text-[1.35rem] font-semibold">
              {bundle?.team?.teamCode}
            </h1>
            <p className="mt-1 text-sm text-white/55">
              {isLeader ? 'Leader' : 'Player'}
              {' · '}
              {session?.name}
            </p>
          </div>
          <ScoreChip score={state?.score} label="Score" />
        </div>

        <section className="mt-6 rounded-2xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/10 p-4">
          <p className="text-sm font-semibold text-white">Wait here</p>
          <p className="mt-2 text-sm text-white/70">
            Meet at
            {' '}
            <strong className="text-white">{startName}</strong>
            . Clue 1 stays closed until the leader starts.
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-white/75">
            <li>Leader taps Start Round 1.</li>
            <li>Leader shows Team QR.</li>
            <li>Everyone else scans that QR.</li>
          </ol>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          {isLeader ? (
            <button
              type="button"
              disabled={starting}
              onClick={onStartHunt}
              className="mt-4 w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'Start Round 1'}
            </button>
          ) : (
            <p className="mt-4 text-center text-sm text-white/60">
              After the leader starts, tap
              {' '}
              <strong className="text-white">Scan leader QR</strong>
              {' '}
              below.
            </p>
          )}
        </section>

        {onSwitchPerson ? (
          <button
            type="button"
            onClick={onSwitchPerson}
            className="mt-6 w-full py-2 text-center text-xs text-white/35"
          >
            Back to team
          </button>
        ) : null}
      </div>
    </div>
  );
}
