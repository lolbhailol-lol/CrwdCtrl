const STEPS = [
  ['1 · Clues', 'Bootstrap, save Clue 1→Final, print yellow/green/blue cards'],
  ['2 · Locations', 'Confirm 4 starting points (Library · Chanakya · Design · Vyas)'],
  ['3 · Teams', '40 teams · one login link each · shared password · leader + 3 players'],
  ['4 · Schedule', 'Preview → Generate → Lock (needs CP1+CP2+CP3 on every team)'],
  ['5 · Live', 'Start round · release desk · mark finish when teams return'],
  ['6 · Results', 'Stop & lock scores → finalize leaderboard'],
];

const TERMS = [
  ['Starting point', 'Gather here (Library · Chanakya · Design · Vyas). Not a hunt scan stop.'],
  ['Campus place', 'One of 10 hunt scan spots. Exactly 4 teams; print 4 team-named QR cards.'],
  ['Yellow → Green → Blue → Red', 'Clue 1 scan → Clue 2 → green scan → Clue 3 riddle → blue scan → Final → report to start.'],
  ['Scoring', '≈50 per clue · hints −15 · late still advances at 0 · ties broken by time/hints/fails.'],
  ['Finish', 'Players report to their start with team number. Organizer marks reached on Live (not a player QR).'],
  ['Team login', 'Share /team/CC001 + that team’s unique password. Names unlock after password. No hopping teams.'],
];

const TEST_FLOW = [
  ['Prep', 'Clues saved · Locations A–D · Teams ready · Schedule Preview → Generate → Lock · Start with 90+ min'],
  ['Playtest desk', 'Live tab → pick team → Release → Yellow/Green/Blue 4/4 → Mark finish'],
  ['Team login', 'Open /team/CC001 → that team’s password → tap Leader / Player'],
  ['Clue 1', 'Leader only sees Clue 1 · Players wait · then all 4 scan yellow'],
  ['Yellow scan', 'Copy yellow CH- from Playtest · paste on all 4 member phones'],
  ['Clue 2 → Green', 'Leader solves Clue 2 → paste green code ×4'],
  ['Blue → Final', 'Clue 3 Caesar → Blue scan ×4 → Final word → Mark finish on Playtest'],
];

const RESET_STEPS = [
  ['Soft reset', 'Results → Reset Round 1 to zero (or Stop & lock → Start/Reopen). Clears progress + scans.'],
  ['Then relaunch', 'Schedule: Preview → Generate → Lock → Start again with a fresh duration'],
  ['Live wipe only', 'Schedule → Generate → confirm force-reset in-progress teams → Lock → Start'],
  ['Hard rebuild', 'backend: CAMPUS_HUNT_SEED_RESET=true node scripts/seed-campus-hunt-pilot.js --reset'],
  ['Backups', 'No in-app backup. Use Mongo snapshot before hard reset. Do not Finalize if you still need reopen.'],
];

const SCAN_TIPS = [
  ['Paste codes', 'Live → Emergency · station codes → Copy CH-… → player “Submit station code”'],
  ['Camera', 'Player: Open camera to scan station QR on the printed card'],
  ['Dev cheat', 'Local only: VITE_CAMPUS_HUNT_DEV_CHEATS=1 + CAMPUS_HUNT_DEV_CHEATS=1 → “Dev: scan all 4 & continue”'],
];

export default function AdminSetupGuide({ compact = false }) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/4 p-4" open={!compact}>
      <summary className="cursor-pointer list-none font-semibold">
        How to run, test & reset Round 1
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
          Scans without printing
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {SCAN_TIPS.map(([name, description]) => (
            <div key={name} className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2">
              <p className="text-sm font-semibold text-amber-100">{name}</p>
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

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {TERMS.map(([name, description]) => (
          <div key={name} className="rounded-lg bg-black/25 px-3 py-2">
            <p className="text-sm font-semibold text-white/90">{name}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/55">{description}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
