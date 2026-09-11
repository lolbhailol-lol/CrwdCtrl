const STEPS = [
  ['1 · Locations', 'Set starts + campus places (rename for any college / mall / run club)'],
  ['2 · Clues', 'Update Clue 1–5 · plant fragments · print 1 shared Place QR per campus stop'],
  ['3 · Teams', 'Match team count · passwords · roster names'],
  ['4 · Send links', 'Create team install links → WhatsApp one link per team (leader phone)'],
  ['5 · Playtest', 'Open Playtest tab — one dry-run section (phone path · start · cheat desk · plant sheet)'],
  ['6 · Live', 'Fest day: board · mark finish when teams return'],
  ['7 · Results', 'Lock scores → finalize leaderboard'],
];

const TERMS = [
  ['Starting point', 'Gather here before release. Not a hunt scan stop.'],
  ['Campus place', 'Hunt stop. Print 1 shared Place QR here — not per team, not 4 colors.'],
  ['Join word → scan', 'At each stop: find N written clues, join into one word, type it, then scan the place QR once.'],
  ['One phone', 'Leader holds Hunt. Teammates walk and hunt fragments together — no multi-phone scan.'],
  ['Send links', 'One WhatsApp install link per team. Open once on Wi‑Fi, then offline.'],
  ['Playtest tab', 'Whole dry-run in one place. Live is for fest day only.'],
  ['Finish', 'Report to start desk. Organizer marks reached on Live.'],
];

const TEST_FLOW = [
  ['Open Playtest', 'Round 1 → Playtest tab — follow A→E on that page'],
  ['Install', 'Leader opens link in Chrome → Pack saved → Add Hunt icon'],
  ['Play', 'Answer → go → find N clues → join word → type → scan once'],
  ['Offline test', 'Data off → Hunt icon → still opens Round 1'],
];

const RESET_STEPS = [
  ['Soft reset', 'Results → Reset Round 1 to zero (or Stop & lock → Start/Reopen).'],
  ['Then relaunch', 'Live / Start again with a fresh duration'],
  ['Hard rebuild', 'backend: CAMPUS_HUNT_SEED_RESET=true node scripts/seed-campus-hunt-pilot.js --reset'],
];

export default function AdminSetupGuide({ compact = false }) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/4 p-4" open={!compact}>
      <summary className="cursor-pointer list-none font-semibold">
        How to run Round 1 (offline · send links)
        <span className="ml-2 text-xs font-normal text-white/45">tap to expand</span>
      </summary>

      <ol className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {STEPS.map(([title, detail]) => (
          <li key={title} className="rounded-lg border border-[#0ECCEE]/20 bg-[#0ECCEE]/5 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/60">{detail}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
          How to test (one team)
        </p>
        <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {TEST_FLOW.map(([title, detail], index) => (
            <li key={title} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-200">
                {index + 1}. {title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/60">{detail}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
          Terms
        </p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {TERMS.map(([name, description]) => (
            <div key={name} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-sm font-semibold text-white">{name}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/55">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-200">
          Reset to zero
        </p>
        <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {RESET_STEPS.map(([title, detail]) => (
            <li key={title} className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-rose-100">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/60">{detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
