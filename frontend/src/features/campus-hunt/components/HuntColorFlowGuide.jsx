import { STAGE_THEMES } from '../types/stageTheme';

const FLOW = [
  { theme: STAGE_THEMES.clue1, clue: 'Clue 1', detail: 'Type campus place → orange scan' },
  { theme: STAGE_THEMES.clue2, clue: 'Clue 2', detail: 'Digit slips → green scan' },
  { theme: STAGE_THEMES.clue3, clue: 'Clue 3', detail: 'Physical lockbox → blue scan' },
  { theme: STAGE_THEMES.clue4, clue: 'Clue 4', detail: 'Zip Grid → purple scan' },
  { theme: STAGE_THEMES.final, clue: 'Clue 5', detail: 'Letter slips → red scan' },
  { theme: STAGE_THEMES.destination, clue: 'Clue 6', detail: 'Mindspark Lobby finish' },
];

/** Color path for the hunt — no points shown. */
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
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                <span style={{ color: row.theme.hex }}>{row.theme.colorName}</span>
                {' · '}
                {row.clue}
              </p>
              <p className="text-[11px] text-white/45">{row.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
