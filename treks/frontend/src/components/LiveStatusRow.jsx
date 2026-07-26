import { Link } from 'react-router-dom'
import Badge, { crowdTone, trailTone } from './Badge'
import { formatRelativeTime } from '../utils/formatters'
import { CATEGORY_META } from '../utils/constants'

export default function LiveStatusRow({ item }) {
  const meta = CATEGORY_META[item.category] ?? { emoji: '🥾' }

  return (
    <Link
      to={`/trek/${item.slug}`}
      className="card-surface group flex flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{meta.emoji}</span>
          <h3 className="font-display text-lg font-bold text-forest-800 transition group-hover:text-forest-600 dark:text-stone dark:group-hover:text-trail">
            {item.name}
          </h3>
          <span className="text-xs text-ink/40 dark:text-stone/40">
            {formatRelativeTime(item.lastUpdated)}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-ink/60 dark:text-stone/60">{item.weather}</p>
        {item.alert ? (
          <p className="mt-1 line-clamp-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            {item.alert}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Badge tone={crowdTone(item.crowdLevel)}>{item.crowdLevel}</Badge>
        <Badge tone={trailTone(item.trailCondition)}>{item.trailCondition}</Badge>
        {item.entryStatus ? (
          <Badge
            tone={
              item.entryStatus === 'Open'
                ? 'success'
                : item.entryStatus === 'Closed'
                  ? 'danger'
                  : 'warning'
            }
          >
            Entry {item.entryStatus}
          </Badge>
        ) : null}
      </div>
    </Link>
  )
}
