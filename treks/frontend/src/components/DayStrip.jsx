/**
 * Horizontal day chips: Today … +6 days.
 * Mobile: single label line. Desktop: weekday + label.
 */
export default function DayStrip({ days = [], selectedDate, onChange, size = 'md' }) {
  const pad = size === 'sm' ? 'px-2 py-1.5' : 'px-2.5 py-1.5 sm:px-3 sm:py-2'
  const minW = size === 'sm' ? 'min-w-[3.75rem]' : 'min-w-[3.75rem] sm:min-w-[5rem]'

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
      {days.map((day) => {
        const active = day.date === selectedDate
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onChange?.(day.date)}
            className={`${minW} shrink-0 rounded-lg border ${pad} text-center transition ${
              active
                ? 'border-brand/40 bg-brand/15 text-brand'
                : 'border-white/10 text-muted hover:border-white/20 hover:text-ink'
            }`}
          >
            <span className="hidden text-[10px] font-medium uppercase tracking-wide opacity-70 sm:block">
              {day.weekday}
            </span>
            <span
              className={`block text-xs font-semibold sm:mt-0.5 sm:text-sm ${
                size === 'sm' ? '' : 'sm:text-[15px]'
              }`}
            >
              {day.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
