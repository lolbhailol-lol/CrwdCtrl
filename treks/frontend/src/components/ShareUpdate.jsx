import { useState } from 'react'
import Button from './Button'
import { submitCommunityUpdate } from '../services/trekService'

const TAGS = [
  { value: 'crowd', label: 'Crowd' },
  { value: 'trail', label: 'Trail' },
  { value: 'weather', label: 'Weather' },
  { value: 'closure', label: 'Closure' },
  { value: 'info', label: 'Info' },
]

export default function ShareUpdate({ slug, onSuccess }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [tag, setTag] = useState('info')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const note = message.trim()
    if (!note) {
      setError('Write a short update.')
      return
    }
    setSubmitting(true)
    try {
      const data = await submitCommunityUpdate(slug, {
        message: note,
        tag,
        displayName: displayName.trim() || 'Trekker',
      })
      setDone(true)
      onSuccess?.(data.trek)
      setMessage('')
      setTag('info')
    } catch (err) {
      setError(err.message || 'Could not post update.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        Share a trail update
      </Button>
    )
  }

  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Share update</h3>
        <button
          type="button"
          className="text-xs text-muted hover:text-ink"
          onClick={() => {
            setOpen(false)
            setDone(false)
            setError('')
          }}
        >
          Close
        </button>
      </div>

      {done ? (
        <p className="mt-3 text-sm text-brand">Posted — thanks for helping others.</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTag(t.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  tag === t.value
                    ? 'bg-brand/15 text-brand ring-1 ring-brand/35'
                    : 'bg-white/5 text-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={280}
            required
            rows={3}
            placeholder="e.g. Stream crossing deeper than usual — poles help."
            className="w-full rounded-lg border border-white/10 bg-panel-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand/40"
          />
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            placeholder="Name (optional)"
            className="w-full rounded-lg border border-white/10 bg-panel-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand/40"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" size="sm" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post update'}
          </Button>
        </form>
      )}
    </div>
  )
}
