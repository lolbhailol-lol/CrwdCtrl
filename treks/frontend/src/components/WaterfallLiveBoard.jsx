import { Link } from 'react-router-dom'
import Badge, { crowdTone, trailTone } from './Badge'
import Button from './Button'
import DayStrip from './DayStrip'
import { useTrekData } from '../context/TrekDataContext'
import { formatRelativeTime } from '../utils/formatters'
import { labelForDate } from '../utils/planDates'

function crowdIconClass(level) {
  switch (level) {
    case 'Low':
      return 'text-brand'
    case 'Moderate':
      return 'text-warn'
    case 'High':
    case 'Very High':
      return 'text-danger'
    default:
      return 'text-muted'
  }
}

function trailIconClass(condition) {
  switch (condition) {
    case 'Open':
      return 'text-brand'
    case 'Slippery':
    case 'Caution':
      return 'text-warn'
    case 'Closed':
      return 'text-danger'
    default:
      return 'text-muted'
  }
}

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Waterfall Trek', label: 'Waterfalls' },
  { id: 'Jungle Trek', label: 'Jungles' },
]

/**
 * Mobile: compact controls + one-line rows + sticky Mark me in.
 * Desktop: richer table.
 */
export default function WaterfallLiveBoard({
  treks = [],
  planDays = [],
  selectedDate,
  onDateChange,
  categoryFilter = 'all',
  onCategoryChange,
  onMarkIn,
  dayKey = 0,
  boardLoading = false,
}) {
  const { source, nowTick } = useTrekData()
  const dayLabel = labelForDate(selectedDate, planDays)
  const isToday = planDays.find((d) => d.date === selectedDate)?.isToday
  const title = isToday ? "Today's board" : `Board · ${dayLabel}`

  const filtered =
    categoryFilter === 'all' ? treks : treks.filter((t) => t.category === categoryFilter)

  const totalGoing = filtered.reduce(
    (sum, t) => sum + (Number(t.status?.peopleCount ?? t.status?.todayPeople) || 0),
    0,
  )

  const freshest = filtered.reduce((best, t) => {
    const u = t.status?.lastUpdated
    if (!u) return best
    if (!best || new Date(u) > new Date(best)) return u
    return best
  }, null)

  // Touch nowTick so relative labels re-render
  void nowTick

  const trustLine = [
    `Planned for ${dayLabel}`,
    'community mark-ins',
    source !== 'api' ? 'Demo times' : freshest ? `Updated ${formatRelativeTime(freshest)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section id="live-waterfalls" className="container-wide section-pad scroll-mt-20">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-panel">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink sm:text-2xl">{title}</h2>
            <p className="mt-0.5 text-xs text-muted sm:text-sm">
              <span key={`going-${dayKey}-${selectedDate}`} className="text-ink">
                {totalGoing} people
              </span>{' '}
              · {dayLabel}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted/90 sm:text-xs">{trustLine}</p>
          </div>
          <div className="hidden shrink-0 items-center gap-3 md:flex">
            <Link to="/explore" className="text-xs font-medium text-brand hover:underline">
              Explore
            </Link>
            <Button type="button" size="sm" onClick={() => onMarkIn?.('')}>
              Mark me in
            </Button>
          </div>
          <Link
            to="/explore"
            className="shrink-0 text-xs font-medium text-brand hover:underline md:hidden"
          >
            Explore
          </Link>
        </div>

        <div className="space-y-3 border-b border-white/10 px-3 py-3 sm:space-y-4 sm:px-6 sm:py-4">
          <DayStrip days={planDays} selectedDate={selectedDate} onChange={onDateChange} />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onCategoryChange?.(f.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3.5 sm:py-2 sm:text-sm ${
                  categoryFilter === f.id
                    ? 'bg-brand/15 text-brand ring-1 ring-brand/35'
                    : 'bg-white/5 text-muted hover:bg-white/8 hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pb-[5.5rem] md:pb-0">
          {boardLoading ? (
            <p className="border-b border-white/8 px-4 py-2 text-center text-xs text-muted">
              Updating…
            </p>
          ) : null}
          {!filtered.length && !boardLoading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted">No trails here.</p>
              {categoryFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => onCategoryChange?.('all')}
                  className="mt-3 text-sm font-semibold text-brand hover:underline"
                >
                  Show all trails
                </button>
              ) : null}
            </div>
          ) : !filtered.length ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading trails…</p>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/8 text-muted">
                      <th className="px-6 py-2.5 text-[11px] font-medium uppercase tracking-wide">
                        Trail
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide">
                        Crowd
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide">
                        Condition
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide">
                        Going
                      </th>
                      <th className="px-6 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {filtered.map((trek) => {
                      const people = trek.status?.peopleCount ?? trek.status?.todayPeople ?? 0
                      return (
                        <tr key={trek.id} className="hover:bg-white/3">
                          <td className="px-6 py-3.5">
                            <Link
                              to={`/trek/${trek.slug}`}
                              className="font-medium text-ink hover:text-brand"
                            >
                              {trek.name}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted">
                              {trek.location}
                              <span className="text-white/30"> · </span>
                              {trek.category === 'Waterfall Trek' ? 'Waterfall' : 'Jungle'}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge tone={crowdTone(trek.status.crowdLevel)}>
                              {trek.status.crowdLevel}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge tone={trailTone(trek.status.trailCondition)}>
                              {trek.status.trailCondition}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-sm font-medium text-ink">{people}</td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => onMarkIn?.(trek.slug)}
                              className="inline-flex min-h-10 items-center rounded-full bg-brand/15 px-3.5 text-sm font-semibold text-brand hover:bg-brand/25"
                            >
                              Mark in
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-white/8 md:hidden">
                {filtered.map((trek) => {
                  const people = trek.status?.peopleCount ?? trek.status?.todayPeople ?? 0
                  const crowd = trek.status?.crowdLevel
                  const trail = trek.status?.trailCondition
                  const updated = trek.status?.lastUpdated
                  return (
                    <li key={trek.id} className="flex items-center gap-2 px-3 py-2.5">
                      <Link to={`/trek/${trek.slug}`} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {trek.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                          <span>{people} going</span>
                          {updated ? <span>· Updated {formatRelativeTime(updated)}</span> : null}
                          {crowd ? (
                            <span className={crowdIconClass(crowd)}>· {crowd}</span>
                          ) : null}
                          {trail ? (
                            <span className={trailIconClass(trail)}>· {trail}</span>
                          ) : null}
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => onMarkIn?.(trek.slug)}
                        className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-brand/15 px-3 text-sm font-semibold text-brand"
                      >
                        Mark in
                      </button>
                    </li>
                  )
                })}
              </ul>

              {totalGoing === 0 ? (
                <div className="border-t border-white/8 px-3 py-3 text-center">
                  <p className="text-xs text-muted sm:text-sm">No one marked in yet</p>
                  <button
                    type="button"
                    onClick={() => onMarkIn?.('')}
                    className="mt-1.5 text-sm font-semibold text-brand hover:underline"
                  >
                    Be the first · Mark me in
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Sticky Mark me in — above bottom nav */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-3 md:hidden">
        <Button
          type="button"
          className="pointer-events-auto w-full shadow-lg"
          onClick={() => onMarkIn?.('')}
        >
          Mark me in
        </Button>
      </div>
    </section>
  )
}
