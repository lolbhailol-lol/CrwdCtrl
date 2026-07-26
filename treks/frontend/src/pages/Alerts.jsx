import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge'
import LoadingScreen from '../components/LoadingScreen'
import ShareUpdateSheet from '../components/ShareUpdateSheet'
import { useTrekData } from '../context/TrekDataContext'
import { UPDATE_STATUS_META } from '../utils/constants'
import { formatRelativeTime } from '../utils/formatters'

const HEADING = 'text-lg font-semibold text-ink sm:text-xl'
const COLUMN = 'rounded-2xl border border-white/10 bg-panel'

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Waterfall Trek', label: 'Falls' },
  { id: 'Jungle Trek', label: 'Jungle' },
]

const severityTone = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
}


function IssueRow({ issue }) {
  return (
    <Link
      to={`/trek/${issue.slug}`}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/3"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ink">{issue.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {issue.note || issue.location}
          {issue.lastUpdated ? ` · ${formatRelativeTime(issue.lastUpdated)}` : ''}
        </p>
      </div>
      <Badge tone={severityTone[issue.severity] ?? 'soft'}>{issue.headline}</Badge>
    </Link>
  )
}

/** One trail, with everything trekkers reported about it. */
function TrailUpdates({ group }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          to={`/trek/${group.slug}`}
          className="truncate text-[15px] font-medium text-ink hover:text-brand"
        >
          {group.name}
        </Link>
        <span className="shrink-0 text-[11px] text-muted/70">
          {formatRelativeTime(group.updates[0]?.timestamp)}
        </span>
      </div>
      <ul className="mt-2 space-y-2">
        {group.updates.map((update) => {
          const tag = UPDATE_STATUS_META[update.status] ?? UPDATE_STATUS_META.info
          return (
          <li key={update.id} className="flex items-start gap-2">
            <Badge tone={tag.tone}>{tag.label}</Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-ink/90">{update.message}</p>
              <p className="mt-0.5 text-[11px] text-muted/70">
                {update.source || 'Trekker'} · {formatRelativeTime(update.timestamp)}
              </p>
            </div>
          </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function Alerts() {
  const {
    ready,
    loading,
    tick,
    nowTick,
    refresh,
    getAllTreks,
    getTrailIssues,
    getLatestCommunityUpdates,
  } = useTrekData()
  const [category, setCategory] = useState('all')
  const [shareOpen, setShareOpen] = useState(false)

  const allIssues = useMemo(
    () => (ready ? getTrailIssues() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, tick, nowTick],
  )
  const allUpdates = useMemo(
    () => (ready ? getLatestCommunityUpdates(60) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, tick, nowTick],
  )
  const treks = useMemo(
    () => (ready ? getAllTreks() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, tick],
  )

  if (!ready) {
    return <LoadingScreen label={loading ? 'Loading alerts…' : 'Loading…'} />
  }

  const inCategory = (value) => category === 'all' || value === category
  const issues = allIssues.filter((i) => inCategory(i.category))
  const updates = allUpdates.filter((u) => inCategory(u.trekCategory))

  const countFor = (id) => {
    const matches = (value) => id === 'all' || value === id
    return (
      allIssues.filter((i) => matches(i.category)).length +
      allUpdates.filter((u) => matches(u.trekCategory)).length
    )
  }

  // Group the update feed by trail so a reader scans by place, not by time
  const grouped = []
  const bySlug = new Map()
  for (const update of updates) {
    let group = bySlug.get(update.trekSlug)
    if (!group) {
      group = { slug: update.trekSlug, name: update.trekName, updates: [] }
      bySlug.set(update.trekSlug, group)
      grouped.push(group)
    }
    if (group.updates.length < 4) group.updates.push(update)
  }

  const closed = issues.filter((i) => i.severity === 'critical')
  const headsUp = issues.filter((i) => i.severity !== 'critical')

  return (
    <div className="container-wide section-pad space-y-6 py-8 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Alerts</h1>
        <p className="mt-1.5 text-sm text-muted">
          Closures and cautions on the left, what trekkers reported on the right.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShareOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-4 text-left transition hover:border-brand/50 hover:bg-brand/15 sm:px-5"
      >
        <span
          aria-hidden="true"
          className="material-symbols-outlined shrink-0 text-[28px] text-brand"
        >
          campaign
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-brand sm:text-lg">
            Share a trail update
          </span>
          <span className="mt-0.5 block text-xs text-muted sm:text-sm">
            Saw a closure, a crowd or bad trail? Post it here — pick the trail, 10 seconds, no login.
          </span>
        </span>
        <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-brand">
          arrow_forward
        </span>
      </button>

      <div
        className="grid max-w-md grid-cols-3 gap-1 rounded-xl bg-white/5 p-1"
        role="group"
        aria-label="Filter by trail type"
      >
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setCategory(f.id)}
            aria-pressed={category === f.id}
            className={`min-h-11 rounded-lg py-2 text-center text-xs font-semibold transition sm:text-sm ${
              category === f.id
                ? 'bg-panel text-brand shadow-sm ring-1 ring-brand/30'
                : 'text-muted hover:text-ink'
            }`}
          >
            {f.label}
            <span className={category === f.id ? 'ml-1.5 text-brand/70' : 'ml-1.5 text-muted/60'}>
              {countFor(f.id)}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h2 className={HEADING}>Alerts</h2>
          <p className="mt-1 text-sm text-muted">Trails to avoid or approach carefully.</p>
          <div className={`mt-3 overflow-hidden ${COLUMN}`}>
            {closed.length || headsUp.length ? (
              <div className="divide-y divide-white/8">
                {closed.length ? (
                  <div>
                    <p className="bg-danger/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-danger">
                      Closed or restricted
                    </p>
                    <div className="divide-y divide-white/8">
                      {closed.map((issue) => (
                        <IssueRow key={issue.slug} issue={issue} />
                      ))}
                    </div>
                  </div>
                ) : null}
                {headsUp.length ? (
                  <div>
                    <p className="bg-warn/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#ffcd98]">
                      Heads up
                    </p>
                    <div className="divide-y divide-white/8">
                      {headsUp.map((issue) => (
                        <IssueRow key={issue.slug} issue={issue} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-ink">Nothing to avoid right now</p>
                <p className="mt-1 text-sm text-muted">
                  No trail is closed or restricted in this filter.
                </p>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className={HEADING}>Updates</h2>
          <p className="mt-1 text-sm text-muted">Newest first, grouped by trail.</p>
          <div className={`mt-3 divide-y divide-white/8 overflow-hidden ${COLUMN}`}>
            {grouped.length ? (
              grouped.map((group) => <TrailUpdates key={group.slug} group={group} />)
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-ink">No updates yet</p>
                <p className="mt-1 text-sm text-muted">
                  Be the first — use the button above after your trek.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <ShareUpdateSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        treks={treks}
        onPosted={() => refresh({ force: true, silent: true })}
      />
    </div>
  )
}
