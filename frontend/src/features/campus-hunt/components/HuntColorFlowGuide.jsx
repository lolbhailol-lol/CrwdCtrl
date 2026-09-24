import { STAGE_THEMES } from '../types/stageTheme';

const FLOW = [
  { theme: STAGE_THEMES.clue1, n: 1 },
  { theme: STAGE_THEMES.clue2, n: 2 },
  { theme: STAGE_THEMES.clue3, n: 3 },
  { theme: STAGE_THEMES.clue4, n: 4 },
  { theme: STAGE_THEMES.final, n: 5 },
  { theme: STAGE_THEMES.destination, n: 6 },
];

export const HUNT_COLOR_RAIL = FLOW.map((row) => row.theme.hex).join(', ');

/** Six clues — color and number only. */
export default function HuntColorFlowGuide({ title = 'Clues' }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${HUNT_COLOR_RAIL})` }}
      />
      <div className="px-3 pb-3 pt-3.5">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
          {title}
        </p>
        <ol className="mt-3 grid grid-cols-2 gap-2">
          {FLOW.map((row) => (
            <li
              key={row.theme.id}
              className="flex items-center gap-3 rounded-2xl border px-3 py-2.5"
              style={{
                borderColor: `${row.theme.hex}55`,
                background: `linear-gradient(160deg, ${row.theme.hex}28 0%, rgba(0,0,0,0.2) 78%)`,
              }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black shadow-[0_8px_18px_-10px_rgba(0,0,0,0.8)]"
                style={{ background: row.theme.hex, color: row.theme.ink }}
              >
                {row.n}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  Clue {row.n}
                </span>
                <span className="block truncate text-[15px] font-bold" style={{ color: row.theme.hex }}>
                  {row.theme.colorName}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
