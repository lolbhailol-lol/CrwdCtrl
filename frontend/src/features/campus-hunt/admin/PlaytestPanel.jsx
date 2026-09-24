import PlaytestDesk from './PlaytestDesk';

/**
 * Dry-run tools only — prep lives in the other tabs.
 * Offline teams start with the shared start code (not schedule / release).
 */
export default function PlaytestPanel({
  eventId,
  eventSlug,
  teams = [],
  stations = [],
  teamSize = 4,
  roundStatus,
  durationMinutes,
  onDurationChange,
  onStartRound,
  busy = false,
  canStart = true,
  onChanged,
  organizerStartCode = 'GO',
  organizerFinishCode = 'MSFINISH',
}) {
  const size = Number(teamSize) || 4;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Dry run</h2>
        <p className="mt-1 text-sm text-white/55">
          Start over one team, and copy each station code. Fest day: shout the start code — phones unlock themselves.
        </p>
      </div>

      <section className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Start code</p>
          <p className="mt-1 font-mono text-2xl font-black tracking-[0.18em] text-[#0ECCEE]">
            {String(organizerStartCode || 'GO').toUpperCase()}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-400/35 bg-[#140a0c] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Finish code</p>
          <p className="mt-1 font-mono text-2xl font-black tracking-[0.18em] text-rose-200">
            {String(organizerFinishCode || 'MSFINISH').toUpperCase()}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-white/60">
            Minutes
            <input
              type="number"
              min="5"
              max="240"
              value={durationMinutes}
              onChange={(e) => onDurationChange?.(Number(e.target.value) || 50)}
              className="ml-2 w-20 rounded bg-black/30 px-2 py-1.5"
            />
          </label>
          <button
            type="button"
            disabled={busy || !canStart}
            onClick={onStartRound}
            className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-40"
          >
            {roundStatus === 'locked'
              ? 'Reopen'
              : roundStatus === 'live'
                ? 'Already live'
                : 'Go live (optional)'}
          </button>
          {roundStatus ? (
            <span className="text-xs text-white/45">{roundStatus}</span>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-white/45">
          Optional for the live board / ranking. Offline phones do not need this — they use the start code.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white">Cheat desk</h3>
        <PlaytestDesk
          eventId={eventId}
          eventSlug={eventSlug}
          teams={teams}
          stations={stations}
          teamSize={size}
          roundStatus={roundStatus}
          onChanged={onChanged}
        />
      </section>
    </div>
  );
}
