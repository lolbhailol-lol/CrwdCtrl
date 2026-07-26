import { Link } from 'react-router-dom'
import Badge, { crowdTone } from './Badge'
import DayStrip from './DayStrip'
import { useTrekData } from '../context/TrekDataContext'
import { formatRelativeTime } from '../utils/formatters'
import { labelForDate } from '../utils/planDates'

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Waterfall Trek', label: 'Falls' },
  { id: 'Jungle Trek', label: 'Jungle' },
]

const MARK_IN_PILL =
  'shrink-0 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/20'

const BUSY_LEVELS = new Set(['High', 'Very High'])

/** Only surface conditions that change a plan; entry wins over trail. */
function warningFor(status) {
  const entry = status?.entryStatus
  if (entry && entry !== 'Open') return entry
  const trail = status?.trailCondition
  if (trail && trail !== 'Open') return trail
  return null
}

/**
 * Mobile: calm list — tap the name for details, Mark in per row.
 * Desktop: same data as a table.
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
  const title = isToday ? 'Today' : dayLabel

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

  const tally = filtered.reduce(
    (acc, t) => {
      if (warningFor(t.status)) acc.blocked += 1
      else if (BUSY_LEVELS.has(t.status?.crowdLevel)) acc.busy += 1
      else if (t.status?.crowdLevel === 'Low') acc.quiet += 1
      return acc
    },
    { quiet: 0, busy: 0, blocked: 0 },
  )

  const signals = [
    tally.quiet ? { key: 'quiet', label: `${tally.quiet} quiet`, dot: 'bg-brand' } : null,
    tally.busy ? { key: 'busy', label: `${tally.busy} busy`, dot: 'bg-[#ffcd98]' } : null,
    tally.blocked
      ? { key: 'blocked', label: `${tally.blocked} restricted`, dot: 'bg-danger' }
      : null,
  ].filter(Boolean)

  void nowTick

  return (
    <section id="live-waterfalls" className="container-wide section-pad scroll-mt-20">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-panel">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {isToday ? "Today's board" : `Board · ${dayLabel}`}
            </h2>
            <p
              key={`signals-${dayKey}-${selectedDate}`}
              className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted"
            >
              {signals.length ? (
                signals.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                ))
              ) : (
                <span>{filtered.length} trails</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {source === 'api' ? (
              <span
                title={freshest ? `Updated ${formatRelativeTime(freshest)}` : undefined}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                </span>
                Live
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-warn/30 bg-warn/10 px-2.5 py-1 text-[11px] font-medium text-[#ffcd98]">
                Demo
              </span>
            )}
            <Link
              to="/explore"
              className="hidden text-xs font-medium text-brand hover:underline md:block"
            >
              Explore
            </Link>
          </div>
        </div>

        {/* Day + type */}
        <div className="space-y-2.5 border-b border-white/10 px-3 py-3 sm:space-y-3 sm:px-6 sm:py-4">
          <DayStrip days={planDays} selectedDate={selectedDate} onChange={onDateChange} />
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onCategoryChange?.(f.id)}
                className={`rounded-lg py-2 text-center text-xs font-semibold transition sm:text-sm ${
                  categoryFilter === f.id
                    ? 'bg-panel text-brand shadow-sm ring-1 ring-brand/30'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          {boardLoading ? (
            <p className="border-b border-white/8 px-4 py-2 text-center text-xs text-muted">
              Updating…
            </p>
          ) : null}
          {!filtered.length && !boardLoading ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted">No trails here.</p>
              {categoryFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => onCategoryChange?.('all')}
                  className="mt-3 text-sm font-semibold text-brand hover:underline"
                >
                  Show all
                </button>
              ) : null}
            </div>
          ) : !filtered.length ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading trails…</p>
          ) : (
            <>
              {/* Desktop table */}
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
                      const warn = warningFor(trek.status)
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
                              {warn ? (
                                <>
                                  <span className="text-white/30"> · </span>
                                  <span className="font-semibold text-danger">{warn}</span>
                                </>
                              ) : null}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge tone={crowdTone(trek.status.crowdLevel)}>
                              {trek.status.crowdLevel}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-sm font-medium text-ink">{people}</td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => onMarkIn?.(trek.slug)}
                              className={MARK_IN_PILL}
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

              {/* Mobile: tap name → details; Mark in per trek */}
              <ul className="divide-y divide-white/8 md:hidden">
                {filtered.map((trek) => {
                  const people = trek.status?.peopleCount ?? trek.status?.todayPeople ?? 0
                  const crowd = trek.status?.crowdLevel
                  const warn = warningFor(trek.status)

                  return (
                    <li key={trek.id} className="flex items-center gap-3 px-4 py-3">
                      <Link to={`/trek/${trek.slug}`} className="min-w-0 flex-1 active:opacity-80">
                        <p className="truncate text-[15px] font-medium text-ink">{trek.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {people} going
                          {crowd ? ` · ${crowd} crowd` : ''}
                          {warn ? <span className="text-danger"> · {warn}</span> : null}
                        </p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => onMarkIn?.(trek.slug)}
                        className={MARK_IN_PILL}
                      >
                        Mark in
                      </button>
                    </li>
                  )
                })}
              </ul>

              {totalGoing === 0 ? (
                <p className="border-t border-white/8 px-4 py-3 text-center text-xs text-muted">
                  No one marked in yet for {title}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
