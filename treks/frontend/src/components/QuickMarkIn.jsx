import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import DayStrip from './DayStrip'
import { submitCheckIn } from '../services/trekService'
import { buildPlanDays, labelForDate } from '../utils/planDates'

const SOURCES = [
  { value: 'solo', label: 'Solo' },
  { value: 'friend', label: 'Group' },
  { value: 'community', label: 'Community' },
]

/**
 * Minimal presence: day · where · solo/group/community · people count.
 */
export default function QuickMarkIn({
  open,
  onClose,
  treks = [],
  initialSlug = '',
  selectedDate,
  planDays: planDaysProp,
  onSuccess,
}) {
  const planDays = planDaysProp?.length ? planDaysProp : buildPlanDays()
  const [slug, setSlug] = useState(initialSlug)
  const [date, setDate] = useState(selectedDate || planDays[0]?.date)
  const [source, setSource] = useState('friend')
  const [groupSize, setGroupSize] = useState(2)
  const [communityName, setCommunityName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [confirmed, setConfirmed] = useState(null)
  const wasOpen = useRef(false)
  const panelRef = useRef(null)

  // Only reset the form when the sheet opens — not when board data refreshes after confirm
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSlug(initialSlug || treks[0]?.slug || '')
      setDate(selectedDate || planDays[0]?.date)
      setError('')
      setDone(false)
      setConfirmed(null)
      setSource('friend')
      setGroupSize(2)
      setCommunityName('')
    }
    wasOpen.current = open
  }, [open, initialSlug, treks, selectedDate, planDays])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Escape closes; Tab stays inside the sheet
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
  }, [open, onClose, done])

  useEffect(() => {
    if (source === 'solo') setGroupSize(1)
    else if (groupSize === 1 || groupSize === '') setGroupSize(2)
  }, [source])

  if (!open) return null

  const selected = treks.find((t) => t.slug === slug)
  const dayLabel = labelForDate(confirmed?.date || date, planDays)
  const confirmedName = confirmed?.name || selected?.name
  const confirmedSlug = confirmed?.slug || selected?.slug

  // Picking a day in here changes what you are marking in for, not the board
  // behind the sheet — the board follows only after a successful submit.
  function changeDate(next) {
    setDate(next)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (source === 'community' && !communityName.trim()) {
      setError('Add a community name.')
      return
    }
    setSubmitting(true)
    try {
      const size = source === 'solo' ? 1 : Number(groupSize)
      if (source !== 'solo' && (!Number.isInteger(size) || size < 2 || size > 50)) {
        setError('Enter a number of people between 2 and 50.')
        setSubmitting(false)
        return
      }
      const result = await submitCheckIn(slug, {
        date,
        displayName:
          source === 'community' ? communityName.trim() : source === 'friend' ? 'Group' : 'Solo',
        groupSize: size,
        source,
        communityName: source === 'community' ? communityName.trim() : '',
      })
      const trekName = treks.find((t) => t.slug === slug)?.name || 'Trail'
      setConfirmed({ slug, name: trekName, date, created: result?.created !== false })
      setDone(true)
      // Refresh board in background — success screen stays until user dismisses
      onSuccess?.(date)
    } catch (err) {
      const msg = err.message || ''
      setError(
        /fetch|network|failed|offline|500|503/i.test(msg)
          ? 'Could not mark in — check your connection and try again.'
          : msg || 'Could not mark in. Try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const noTrails = !treks.length

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
        aria-labelledby="mark-in-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl border border-white/10 bg-panel sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-6 sm:py-4">
          <h2 id="mark-in-title" className="text-lg font-semibold text-ink">
            Mark me in · {dayLabel}
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
        {done ? (
          <div className="space-y-3 py-1">
            <div className="rounded-xl border border-brand/25 bg-brand/10 px-4 py-3">
              <p className="text-sm font-semibold text-brand">
                {confirmed?.created === false ? 'Mark-in updated' : "You're on the board"}
              </p>
              <p className="mt-1 text-sm text-ink">
                {confirmedName || 'Trail'} · {dayLabel}
              </p>
              {confirmed?.created === false ? (
                <p className="mt-1 text-xs text-muted">
                  You had already marked in for this day, so we replaced your earlier entry.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Button type="button" className="w-full" onClick={onClose}>
                Back to board
              </Button>
              {confirmedSlug ? (
                <Button
                  to={`/trek/${confirmedSlug}`}
                  variant="secondary"
                  className="w-full"
                  onClick={onClose}
                >
                  View trail
                </Button>
              ) : null}
              <button
                type="button"
                className="w-full py-1 text-center text-xs font-medium text-muted hover:text-brand"
                onClick={() => {
                  setDone(false)
                  setConfirmed(null)
                  setCommunityName('')
                  setSource('friend')
                  setGroupSize(2)
                }}
              >
                Mark another group
              </button>
            </div>
          </div>
        ) : noTrails ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted">No trails for this day yet. Try another day or explore.</p>
            <Button type="button" className="w-full" onClick={onClose}>
              Back to board
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Day
              </p>
              <DayStrip days={planDays} selectedDate={date} onChange={changeDate} size="sm" />
            </div>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Trail
              <select
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-panel-2 px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-ink outline-none focus:border-brand/40"
              >
                {treks.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Who
              </legend>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {SOURCES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSource(opt.value)}
                    className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
                      source === opt.value
                        ? 'bg-brand/15 text-brand ring-1 ring-brand/35'
                        : 'border border-white/10 text-muted hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {source === 'community' ? (
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Community name
                <input
                  value={communityName}
                  onChange={(e) => setCommunityName(e.target.value)}
                  maxLength={80}
                  required
                  placeholder="e.g. Sahyadri Weekend Club"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-panel-2 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-brand/40"
                />
              </label>
            ) : null}

            {source !== 'solo' ? (
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                People
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={50}
                  required
                  value={groupSize}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') {
                      setGroupSize('')
                      return
                    }
                    const n = Number(raw)
                    if (Number.isNaN(n)) return
                    setGroupSize(Math.min(50, Math.max(1, n)))
                  }}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-panel-2 px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-ink outline-none focus:border-brand/40"
                />
              </label>
            ) : null}

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={submitting || !slug || noTrails}>
              {submitting ? 'Marking in…' : `Confirm · ${dayLabel}`}
            </Button>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}
