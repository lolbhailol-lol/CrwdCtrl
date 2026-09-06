import { useState } from 'react'
import Button from './Button'
import { submitCommunityUpdate } from '../services/trekService'

export const UPDATE_TAGS = [
  { value: 'crowd', label: 'Crowd' },
  { value: 'trail', label: 'Trail' },
  { value: 'weather', label: 'Weather' },
  { value: 'closure', label: 'Closure' },
  { value: 'info', label: 'Info' },
]

const FIELD =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-panel-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/40'
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wide text-muted'

/**
 * The one place a trail update is written. Used inline on a trek page (fixed
 * slug) and from the Alerts sheet, where the trail is picked here.
 */
export default function ShareUpdateForm({
  slug: fixedSlug,
  treks = [],
  idPrefix = 'share',
  submitLabel = 'Post update',
  onPosted,
}) {
  const [slug, setSlug] = useState(fixedSlug || treks[0]?.slug || '')
  const [message, setMessage] = useState('')
  const [tag, setTag] = useState('info')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const targetSlug = fixedSlug || slug

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const note = message.trim()
    if (!targetSlug) {
      setError('Pick a trail first.')
      return
    }
    if (!note) {
      setError('Write a short update.')
      return
    }
    setSubmitting(true)
    try {
      const data = await submitCommunityUpdate(targetSlug, {
        message: note,
        tag,
        displayName: displayName.trim() || 'Trekker',
      })
      setMessage('')
      setTag('info')
      onPosted?.(data.trek, data.update, targetSlug)
    } catch (err) {
      const msg = err.message || ''
      setError(
        /fetch|network|failed|offline|500|503/i.test(msg)
          ? 'Could not post — check your connection and try again.'
          : msg || 'Could not post update.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {fixedSlug ? null : (
        <div>
          <label htmlFor={`${idPrefix}-trail`} className={LABEL}>
            Which trail
          </label>
          <select
            id={`${idPrefix}-trail`}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            className={`${FIELD} font-medium`}
          >
            {treks.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset>
        <legend className={LABEL}>What is this about</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {UPDATE_TAGS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTag(t.value)}
              aria-pressed={tag === t.value}
              className={`min-h-11 rounded-lg px-3.5 text-xs font-semibold transition ${
                tag === t.value
                  ? 'bg-brand/15 text-brand ring-1 ring-brand/35'
                  : 'bg-white/5 text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-message`} className={LABEL}>
          Your update
        </label>
        <textarea
          id={`${idPrefix}-message`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={280}
          required
          rows={3}
          placeholder="e.g. Stream crossing deeper than usual — poles help."
          className={FIELD}
        />
        <p className="mt-1 text-right text-[11px] text-muted/70">{message.length}/280</p>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-name`} className={LABEL}>
          Name (optional)
        </label>
        <input
          id={`${idPrefix}-name`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          placeholder="Trekker"
          className={FIELD}
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? 'Posting…' : submitLabel}
      </Button>
      <p className="text-center text-[11px] text-muted/70">
        Closure and trail reports also show on the Alerts page.
      </p>
    </form>
  )
}
