import { useEffect, useRef, useState } from 'react'
import ShareUpdateForm from './ShareUpdateForm'

/**
 * Trek page: a full-width call to action that opens the update form in place.
 * Collapses shortly after posting so the posted update is what stays on screen.
 */
export default function ShareUpdate({ slug, onSuccess }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const closeTimer = useRef(null)

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  function handlePosted(trek, update) {
    setDone(true)
    onSuccess?.(trek, update)
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      setDone(false)
    }, 1400)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-4 text-left transition hover:border-brand/50 hover:bg-brand/15"
      >
        <span
          aria-hidden="true"
          className="material-symbols-outlined shrink-0 text-[26px] text-brand"
        >
          campaign
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-brand">Share a trail update</span>
          <span className="mt-0.5 block text-xs text-muted">
            Crowd, trail, weather or a closure — 10 seconds, no login
          </span>
        </span>
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-brand">
          arrow_forward
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-brand/25 bg-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink">Share a trail update</h3>
          <p className="mt-0.5 text-xs text-muted">
            Only post what you saw yourself — others plan around it.
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 px-2 text-xs font-medium text-muted hover:text-ink"
          onClick={() => {
            setOpen(false)
            setDone(false)
          }}
        >
          Close
        </button>
      </div>

      {done ? (
        <p className="mt-4 text-sm font-medium text-brand">
          Posted — it&apos;s at the top of the list below.
        </p>
      ) : (
        <div className="mt-4">
          <ShareUpdateForm slug={slug} onPosted={handlePosted} />
        </div>
      )}
    </div>
  )
}
