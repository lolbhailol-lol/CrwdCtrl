import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import ShareUpdateForm from './ShareUpdateForm'

/**
 * Post an update without opening a trek first — the trail is picked inside.
 */
export default function ShareUpdateSheet({ open, onClose, treks = [], onPosted }) {
  const [posted, setPosted] = useState(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setPosted(null)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ) || [],
      )

    focusables()[0]?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, posted])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-80 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-canvas/70"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl border border-white/10 bg-panel sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-6 sm:py-4">
          <h2 id="share-sheet-title" className="text-lg font-semibold text-ink">
            Share a trail update
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md px-3 text-xs font-medium text-muted hover:bg-white/5 hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {posted ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-brand/25 bg-brand/10 px-4 py-3">
                <p className="text-sm font-semibold text-brand">Update posted</p>
                <p className="mt-1 text-sm text-ink">{posted.name}</p>
                <p className="mt-1 text-xs text-muted">
                  Trekkers checking this trail will see it right away.
                </p>
              </div>
              <Button type="button" className="w-full" onClick={onClose}>
                Done
              </Button>
              <Button
                to={`/trek/${posted.slug}`}
                variant="secondary"
                className="w-full"
                onClick={onClose}
              >
                View trail
              </Button>
              <button
                type="button"
                className="w-full py-1 text-center text-xs font-medium text-muted hover:text-brand"
                onClick={() => setPosted(null)}
              >
                Post another update
              </button>
            </div>
          ) : treks.length ? (
            <ShareUpdateForm
              treks={treks}
              idPrefix="sheet"
              onPosted={(trek, update, slug) => {
                setPosted({
                  slug,
                  name: trek?.name || treks.find((t) => t.slug === slug)?.name || 'Trail',
                })
                onPosted?.(trek, update, slug)
              }}
            />
          ) : (
            <p className="text-sm text-muted">No trails loaded yet. Try again in a moment.</p>
          )}
        </div>
      </div>
    </div>
  )
}
