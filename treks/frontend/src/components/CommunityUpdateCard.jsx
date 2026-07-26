import { Link } from 'react-router-dom'
import Badge from './Badge'
import { useTrekData } from '../context/TrekDataContext'
import { formatRelativeTime } from '../utils/formatters'

const statusTone = {
  ok: 'success',
  info: 'info',
  warning: 'warning',
  alert: 'danger',
}

const statusLabel = {
  ok: 'Clear',
  info: 'Update',
  warning: 'Caution',
  alert: 'Alert',
}

export default function CommunityUpdateCard({ update, showTrek = false }) {
  const { nowTick } = useTrekData()
  void nowTick
  const tone = statusTone[update.status] ?? 'soft'
  const label = statusLabel[update.status] ?? 'Update'

  const body = (
    <>
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">
        CC
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showTrek && update.trekName ? (
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
              {update.trekName}
            </p>
          ) : null}
          <Badge tone={tone}>{label}</Badge>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{update.message}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
          <time dateTime={update.timestamp}>{formatRelativeTime(update.timestamp)}</time>
          {update.source ? <span>· {update.source}</span> : null}
        </div>
      </div>
    </>
  )

  if (showTrek && update.trekSlug) {
    return (
      <Link
        to={`/trek/${update.trekSlug}`}
        className="card-surface flex gap-4 p-4 transition hover:border-brand/40"
      >
        {body}
      </Link>
    )
  }

  return <article className="card-surface flex gap-4 p-4">{body}</article>
}
