import PlaytestDesk from './PlaytestDesk';

/**
 * Dry-run tools only — prep lives in the other tabs.
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
}) {
  const size = Number(teamSize) || 4;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Dry run</h2>
        <p className="mt-1 text-sm text-white/55">
          Start the hunt, then force leader scans from the desk. Fest day uses Live.
        </p>
      </div>

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
                ? 'Sync releases'
                : 'Start hunt'}
          </button>
          {roundStatus ? (
            <span className="text-xs text-white/45">{roundStatus}</span>
          ) : null}
        </div>
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
