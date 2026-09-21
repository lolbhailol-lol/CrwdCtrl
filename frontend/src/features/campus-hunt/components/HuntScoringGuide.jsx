import { STAGE_THEMES } from '../types/stageTheme';

const CLUE_ROWS = [
  {
    theme: STAGE_THEMES.clue1,
    title: 'Clue 1 · Place',
    points: '50 pts',
    detail: 'Type the place · 3 tries · miss all → answer shown (0 pts) · scan Orange',
  },
  {
    theme: STAGE_THEMES.clue2,
    title: 'Clue 2 · Plant word',
    points: 'up to 50',
    detail: 'Join plant slips · faster = more · late/miss → 0 pts · scan Green',
  },
  {
    theme: STAGE_THEMES.clue3,
    title: 'Clue 3 · Lockbox',
    points: '50 pts',
    detail: 'Digit code · 3 tries · hint −15 · scan Blue',
  },
  {
    theme: STAGE_THEMES.clue4,
    title: 'Clue 4 · Zip Grid',
    points: '50 pts',
    detail: 'Laptop · device key · GRID-XXXX · scan Purple',
  },
  {
    theme: STAGE_THEMES.final,
    title: 'Clue 5 · Word',
    points: 'up to 75',
    detail: 'Fragments · faster = bonus · late/miss → 0 · scan Red',
  },
  {
    theme: STAGE_THEMES.destination,
    title: 'Clue 6 · Lobby',
    points: '25 pts',
    detail: 'Mindspark Lobby · finish code from organizer',
  },
];

/**
 * Pre-hunt scoring + color guide — same for offline briefing and online hold.
 */
export default function HuntScoringGuide({ startingScore = 100, compact = false }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
        How scoring works
      </p>
      <p className="mt-1.5 text-sm text-white/70">
        Start at <span className="font-semibold text-white">{startingScore}</span> pts · 6 clues ·
        poster scans unlock the next clue (no scan points)
      </p>

      <ul className={`mt-3 space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        {CLUE_ROWS.map((row) => (
          <li
            key={row.theme.id}
            className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5"
          >
            <span
              className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
              style={{ background: row.theme.hex }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-white">
                  <span style={{ color: row.theme.hex }}>{row.theme.colorName}</span>
                  {' · '}
                  {row.title}
                </p>
                <p className="tabular-nums font-semibold" style={{ color: row.theme.hex }}>
                  {row.points}
                </p>
              </div>
              <p className="mt-0.5 text-white/50">{row.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-white/45">
        One phone (leader). Whole team walks together. Hints cost 15 pts.
      </p>
    </section>
  );
}
