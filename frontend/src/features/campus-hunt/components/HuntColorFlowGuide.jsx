import { STAGE_THEMES } from '../types/stageTheme';

const FLOW = [
  { theme: STAGE_THEMES.clue1, n: 1, line: 'Solve it on the leader phone. Scan once.' },
  { theme: STAGE_THEMES.clue2, n: 2, line: 'Solve it on the leader phone. Scan once.' },
  { theme: STAGE_THEMES.clue3, n: 3, line: 'Solve it on the leader phone. Scan once.' },
  { theme: STAGE_THEMES.clue4, n: 4, line: 'Solve it on the leader phone. Scan once.' },
  { theme: STAGE_THEMES.final, n: 5, line: 'Solve it on the leader phone. Scan once.' },
  {
    theme: STAGE_THEMES.destination,
    n: 6,
    line: 'Organizer finish code. First team in gets 200, then −10 each, down to 10.',
  },
];

export const HUNT_COLOR_RAIL = FLOW.map((row) => row.theme.hex).join(', ');

/** Start-page rules: one line per clue, plus the tie-break. */
export default function HuntColorFlowGuide({ title = 'Before you start' }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${HUNT_COLOR_RAIL})` }}
      />
      <div className="px-4 pb-4 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
          {title}
        </p>
        <ol className="mt-3 space-y-2">
          {FLOW.map((row) => (
            <li key={row.theme.id} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black"
                style={{ background: row.theme.hex, color: row.theme.ink }}
              >
                {row.n}
              </span>
              <p className="min-w-0 pt-0.5 text-sm leading-snug text-white/80">
                <span className="font-bold" style={{ color: row.theme.hex }}>
                  {row.theme.colorName}.{' '}
                </span>
                {row.line}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm leading-snug text-white/75">
          Same score? The team that finishes earlier ranks higher.
          One leader phone. One scan each clue.
        </p>
      </div>
    </section>
  );
}
