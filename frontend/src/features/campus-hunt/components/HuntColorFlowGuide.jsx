import { STAGE_THEMES } from '../types/stageTheme';

const FLOW = [
  { theme: STAGE_THEMES.clue1, clue: 'Clue 1' },
  { theme: STAGE_THEMES.clue2, clue: 'Clue 2' },
  { theme: STAGE_THEMES.clue3, clue: 'Clue 3' },
  { theme: STAGE_THEMES.clue4, clue: 'Clue 4' },
  { theme: STAGE_THEMES.final, clue: 'Clue 5' },
  { theme: STAGE_THEMES.destination, clue: 'Clue 6' },
];

/** Color path for the hunt — color + clue only. */
export default function HuntColorFlowGuide({ title = 'Your path' }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
        {title}
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {FLOW.map((row) => (
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
          </li>
        ))}
      </ul>
    </section>
  );
}
