import { useEffect, useMemo, useState } from 'react'
import Button from './Button'
import DayStrip from './DayStrip'
import { submitCheckIn } from '../services/trekService'
import { buildPlanDays, labelForDate, todayIst } from '../utils/planDates'

const SOURCES = [
  { value: 'solo', label: 'Solo' },
  { value: 'friend', label: 'Group' },
  { value: 'community', label: 'Community' },
]

export default function GoingTodayPanel({ slug, onSuccess, initialDate }) {
  const planDays = useMemo(() => buildPlanDays(), [])
  const [date, setDate] = useState(initialDate || todayIst())
  const [source, setSource] = useState('friend')
  const [groupSize, setGroupSize] = useState(2)
  const [communityName, setCommunityName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (source === 'solo') setGroupSize(1)
    else if (groupSize === 1 || groupSize === '') setGroupSize(2)
  }, [source])

  const dayLabel = labelForDate(date, planDays)

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
      const data = await submitCheckIn(slug, {
        date,
        displayName:
          source === 'community' ? communityName.trim() : source === 'friend' ? 'Group' : 'Solo',
        groupSize: size,
        source,
        communityName: source === 'community' ? communityName.trim() : '',
      })
      setDone(true)
      onSuccess?.(data.trek, date)
    } catch (err) {
      setError(err.message || 'Could not check in. Is the API + Mongo online?')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card-surface p-5">
      <p className="text-xs font-medium text-muted">Presence</p>
      <h3 className="mt-1 text-lg font-semibold text-ink">Going · {dayLabel}?</h3>
      <p className="mt-1 text-sm text-muted">Pick a day, then solo / group / community + count.</p>

      {done ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-brand/25 bg-brand/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              You&apos;re on the board
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{dayLabel}</p>
            <p className="mt-0.5 text-sm text-muted">Your group counts toward that day&apos;s crowd.</p>
          </div>
          <Button to={`/trek/${slug}`} className="w-full" size="sm">
            Refresh trail status
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="sm"
            onClick={() => {
              setDone(false)
              setCommunityName('')
              setSource('friend')
              setGroupSize(2)
            }}
          >
            Mark another group
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Which day?
            </p>
            <DayStrip days={planDays} selectedDate={date} onChange={setDate} size="sm" />
          </div>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Who&apos;s going
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SOURCES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSource(opt.value)}
                  className={`rounded-lg px-2 py-2.5 text-xs font-medium transition sm:text-sm ${
                    source === opt.value
                      ? 'bg-white/10 text-ink'
                      : 'border border-white/10 text-muted hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          {source === 'community' ? (
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Community name
              <input
                required
                maxLength={80}
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-brand/50"
                placeholder="Sahyadri Weekend Club"
              />
            </label>
          ) : null}

          {source !== 'solo' ? (
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Number of people
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
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-ink outline-none focus:border-brand/50"
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Marking in…' : `Mark me in · ${dayLabel}`}
          </Button>
        </form>
      )}
    </section>
  )
}
