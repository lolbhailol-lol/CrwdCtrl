import { formatRelativeTime } from '../utils/formatters'

export default function CommunityUpdateCard({ update }) {
  return (
    <article className="card-surface flex gap-4 p-4">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-800 text-xs font-bold text-trail dark:bg-trail dark:text-forest-950">
        CC
      </div>
      <div className="min-w-0">
        <p className="text-sm leading-relaxed text-ink dark:text-stone">{update.message}</p>
        <time
          dateTime={update.timestamp}
          className="mt-2 block text-xs font-medium text-ink/45 dark:text-stone/45"
        >
          {formatRelativeTime(update.timestamp)}
        </time>
      </div>
    </article>
  )
}
