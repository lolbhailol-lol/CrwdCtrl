/**
 * Horizontal day chips: Today … +6 days.
 * Mobile: single label line. Desktop: weekday + label.
 */
export default function DayStrip({ days = [], selectedDate, onChange, size = 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2 sm:px-3.5 sm:py-2'
  const minW = size === 'sm' ? 'min-w-[4rem]' : 'min-w-[4.25rem] sm:min-w-[5rem]'

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
      {days.map((day) => {
        const active = day.date === selectedDate
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onChange?.(day.date)}
            className={`${minW} shrink-0 rounded-xl ${pad} text-center transition ${
              active
                ? 'bg-brand text-brand-ink'
                : 'bg-white/5 text-muted hover:bg-white/8 hover:text-ink'
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
