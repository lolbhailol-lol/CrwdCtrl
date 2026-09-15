import DryRunHuddleChecklist from './DryRunHuddleChecklist';
import PlaytestDesk from './PlaytestDesk';

const PREP = [
  ['Locations', 'Starts + campus places named for your venue'],
  ['Clues', 'Clue 1–5 updated · plant fragments + joined word per stop · print QRs'],
  ['Teams', 'At least CC001 ready (password + roster)'],
  ['Send links', 'Create team links → copy WhatsApp for CC001'],
];

const PHONE = [
  ['Install (Wi‑Fi)', 'Leader opens install link in Chrome → wait Pack saved → Add to Home screen as Hunt'],
  ['Start hunt', 'Admin: Start Round 1 below · then release CC001 (or use cheat desk)'],
  ['Play loop', 'Answer on phone → walk → find N written clues → join word → type → scan poster once → team code'],
  ['Offline check', 'Turn Wi‑Fi + data OFF → open Hunt icon → still plays Round 1'],
  ['Finish', 'Return to start desk · Mark reached on Live (or Finish on cheat desk)'],
];

/**
 * One place for dry-run: checklist, start, cheat desk, plant sheet.
 */
export default function PlaytestPanel({
  eventId,
  eventSlug,
  teams = [],
  stations = [],
  teamSize = 4,
  teamCapacity = 40,
  roundStatus,
  durationMinutes,
  onDurationChange,
  onStartRound,
  busy = false,
  canStart = true,
  overview,
  competitionFormat,
  onChanged,
  onGoTab,
}) {
  const size = Number(teamSize) || 4;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
          Playtest
        </p>
        <h2 className="mt-1 text-xl font-bold">One whole dry run · offline Round 1</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Use this tab only for testing. Live stays for fest day.
          Baseline ~{teamCapacity} × {size}; one team (CC001) is enough to prove the loop.
        </p>
      </div>

      <section className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-4">
        <h3 className="text-sm font-bold text-emerald-100">A · Prep (admin tabs)</h3>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {PREP.map(([title, detail], i) => (
            <li key={title} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
              <p className="text-xs font-semibold text-white">
                {i + 1}. {title}
              </p>
              <p className="mt-0.5 text-[11px] text-white/55">{detail}</p>
              {typeof onGoTab === 'function' ? (
                <button
                  type="button"
                  onClick={() => onGoTab(
                    title === 'Locations' ? 'locations'
                      : title === 'Clues' ? 'clues'
                        : title === 'Teams' ? 'teams'
                          : 'links',
                  )}
                  className="mt-2 text-[11px] font-semibold text-[#0ECCEE] hover:underline"
                >
                  Open {title} →
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] p-4">
        <h3 className="text-sm font-bold text-white">B · Phone path (real offline)</h3>
        <p className="mt-1 text-xs text-white/50">
          Soft start line for players: “One phone. At each stop: find the written clues
          (one per teammate), join the word, type it, then scan.”
        </p>
        <ol className="mt-3 space-y-2">
          {PHONE.map(([title, detail], i) => (
            <li
              key={title}
              className="flex gap-3 rounded-xl border border-white/10 bg-white/4 px-3 py-2.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0ECCEE]/20 text-xs font-bold text-[#0ECCEE]">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/55">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/60">
          <strong className="text-white">Loop to prove:</strong>
          {' '}
          answer → go → find {size} clues → join → type → scan once → next.
          Fragments are shared per stop (not per team).
        </div>
      </section>

      <section className="rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/15 p-5">
        <h3 className="text-lg font-bold text-emerald-100">C · Start Round 1</h3>
        <p className="mt-1 text-sm text-white/70">
          Must be live before release / cheat desk. Schedule lock optional for offline playtest.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs text-white/60">
            Duration (minutes)
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
            className="rounded-xl bg-emerald-400 px-6 py-3 text-base font-bold text-black disabled:opacity-40"
          >
            {roundStatus === 'locked'
              ? 'Reopen Round 1'
              : roundStatus === 'live'
                ? 'Sync due releases'
                : 'Start Round 1'}
          </button>
          {roundStatus ? (
            <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-white/60">
              Status: {roundStatus}
            </span>
          ) : null}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-white">D · Cheat desk (skip walking)</h3>
        <p className="mb-3 text-xs text-white/50">
          Desk advances stages without planting. Still do one real phone install + join-word once
          before fest day.
        </p>
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

      <section>
        <h3 className="mb-2 text-sm font-bold text-white">E · Plant sheet (print)</h3>
        <p className="mb-3 text-xs text-white/50">
          Shared fragments per stop + QR posters. Print once — scales to ~{teamCapacity} teams.
        </p>
        <DryRunHuddleChecklist
          eventId={eventId}
          campusStations={overview?.campusStations || overview?.event?.campusStations}
          campusStarts={overview?.campusStarts || overview?.event?.campusStarts}
          stationCount={overview?.stationCount ?? overview?.event?.stationCount}
          teamSize={competitionFormat?.teamSize || size}
        />
      </section>
    </div>
  );
}
