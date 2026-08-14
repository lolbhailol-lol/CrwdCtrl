import ScoreChip from '../../components/ScoreChip';
import HuntProgressTrack from '../../components/HuntProgressTrack';

const ROUTE = [
  { id: 'start', label: 'Start desk', color: '#0ECCEE', hint: 'Meet here. Leader starts Round 1.' },
  { id: 'orange', label: 'Orange QR', color: '#f97316', hint: 'After Clue 1 — all 4 scan.' },
  { id: 'green', label: 'Green QR', color: '#22c55e', hint: 'After Clue 2 — all 4 scan.' },
  { id: 'blue', label: 'Blue QR', color: '#3b82f6', hint: 'After Clue 3 — all 4 scan.' },
  { id: 'purple', label: 'Purple QR', color: '#a855f7', hint: 'After Clue 4 — all 4 scan.' },
  { id: 'finish', label: 'Back to start', color: '#34d399', hint: 'After Clue 5 — export results.' },
];

export default function OfflineHuntBriefing({
  bundle,
  session,
  state,
  onStartHunt,
  starting = false,
  error = '',
  onSwitchPerson,
}) {
  const isLeader = session?.role === 'leader';
  const startName = bundle?.team?.startingPoint?.name;
  const eventName = bundle?.event?.name;

  return (
    <div className="relative min-h-screen overflow-hidden pb-28 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 50% at 50% -10%, rgba(14,204,238,0.14) 0%, transparent 55%),
            linear-gradient(180deg, #0b0c0d 0%, #0e1012 50%, #0b0c0d 100%)
          `,
        }}
      />

      <div className="relative mx-auto max-w-lg px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
              Offline Event Mode
            </p>
            <h1 className="mt-1 text-[1.35rem] font-semibold tracking-tight">
              {bundle?.team?.teamCode || 'Team'}
              {bundle?.team?.teamName ? (
                <span className="font-normal text-white/50">
                  {' '}
                  ·
                  {' '}
                  {bundle.team.teamName}
                </span>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {eventName || 'Campus Hunt'}
              {' · '}
              {isLeader ? `Leader · ${session.name}` : `Player · ${session.name}`}
            </p>
          </div>
          <ScoreChip score={state?.score} label="Score" />
        </div>

        <p className="mt-4 text-sm text-white/60">
          Pack is on this phone. The hunt does not start until the leader starts Round 1
          {startName ? ` at ${startName}` : ' at your start desk'}.
        </p>

        <div className="mt-6">
          <HuntProgressTrack stage="WAITING" />
        </div>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Route — colors only
          </p>
          <ol className="mt-3 space-y-2">
            {ROUTE.map((stop, index) => (
              <li key={stop.id} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black"
                  style={{ background: stop.color }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{stop.label}</p>
                  <p className="text-xs text-white/50">{stop.hint}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-3 rounded-2xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Round 1 · Offline
              </p>
              <h2 className="mt-1 text-lg font-semibold">Campus Hunt</h2>
              <p className="mt-0.5 text-sm text-white/55">
                Same clues as online. Airplane mode. Cameras only.
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
              Waiting
            </span>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-white/70">
            <li>Turn on airplane mode at the venue.</li>
            <li>Leader solves clues. Everyone scans the color poster.</li>
            <li>Members show proof QR. Leader collects, then types team code.</li>
            <li>Leader shows Team QR so phones stay in sync.</li>
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
              Wait with your leader. After they start, tap
              {' '}
              <strong className="text-white">Scan leader QR</strong>
              {' '}
              below.
            </p>
          )}
        </section>

        <section className="mt-3 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Round 2 · Survival
          </p>
          <h2 className="mt-1 text-lg font-semibold">Locked</h2>
          <p className="mt-1 text-xs text-amber-100/85">Not part of Offline Event Mode.</p>
        </section>

        <section className="mt-3 rounded-2xl border border-orange-400/30 bg-orange-500/10 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Round 3 · Finals
          </p>
          <h2 className="mt-1 text-lg font-semibold">Locked</h2>
          <p className="mt-1 text-xs text-amber-100/85">Not part of Offline Event Mode.</p>
        </section>

        {onSwitchPerson ? (
          <button
            type="button"
            onClick={onSwitchPerson}
            className="mt-6 w-full py-2 text-center text-xs text-white/35 transition hover:text-white/60"
          >
            Not you? Switch person on this phone
          </button>
        ) : null}
      </div>
    </div>
  );
}
