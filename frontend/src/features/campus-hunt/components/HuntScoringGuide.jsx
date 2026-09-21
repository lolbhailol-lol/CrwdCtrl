import { STAGE_THEMES } from '../types/stageTheme';

const CLUE_ROWS = [
  { theme: STAGE_THEMES.clue1, clue: 'Clue 1', points: '50' },
  { theme: STAGE_THEMES.clue2, clue: 'Clue 2', points: '≤55' },
  { theme: STAGE_THEMES.clue3, clue: 'Clue 3', points: '65' },
  { theme: STAGE_THEMES.clue4, clue: 'Clue 4', points: '50' },
  { theme: STAGE_THEMES.final, clue: 'Clue 5', points: '≤75' },
  { theme: STAGE_THEMES.destination, clue: 'Clue 6', points: '30' },
];

/** Color · clue · points — start 100. */
export default function HuntScoringGuide({ startingScore = 100 }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
        Scoring · start {startingScore}
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {CLUE_ROWS.map((row) => (
          <li
            key={row.theme.id}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: row.theme.hex }}
              aria-hidden
            />
            <p className="min-w-0 flex-1 text-sm font-semibold text-white">
              <span style={{ color: row.theme.hex }}>{row.theme.colorName}</span>
              {' · '}
              {row.clue}
            </p>
            <p
              className="shrink-0 tabular-nums text-sm font-bold"
              style={{ color: row.theme.hex }}
            >
              {row.points}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-white/40">
        Blue/red: physical find nearby · fewer tries · hints cost more
      </p>
    </section>
  );
}
