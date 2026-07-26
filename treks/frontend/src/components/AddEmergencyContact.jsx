import { useState } from 'react'
import Button from './Button'
import { submitEmergencyContact } from '../services/trekService'

const FIELD =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-panel-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/40'
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wide text-muted'

/** Anyone can add a help number for a trail — it shows on that trail only. */
export default function AddEmergencyContact({ slug, onAdded }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [phone, setPhone] = useState('')
  const [addedBy, setAddedBy] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function close() {
    setOpen(false)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!label.trim()) {
      setError('Say who this number belongs to.')
      return
    }
    setSubmitting(true)
    try {
      const contact = await submitEmergencyContact(slug, {
        label: label.trim(),
        phone: phone.trim(),
        addedBy: addedBy.trim(),
      })
      setLabel('')
      setPhone('')
      onAdded?.(contact)
      setOpen(false)
    } catch (err) {
      setError(err.message || 'Could not add this contact.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/12 px-3 text-sm font-medium text-ink transition hover:border-brand/40 hover:text-brand"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] leading-none">
          add
        </span>
        Add a contact
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-xl border border-white/10 p-3">
      <div>
        <label htmlFor="contact-label" className={LABEL}>
          Who is this
        </label>
        <input
          id="contact-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          required
          placeholder="Forest office, local guide, jeep driver…"
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="contact-phone" className={LABEL}>
          Phone
        </label>
        <input
          id="contact-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={20}
          required
          placeholder="+91 98765 43210"
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="contact-added-by" className={LABEL}>
          Your name (optional)
        </label>
        <input
          id="contact-added-by"
          value={addedBy}
          onChange={(e) => setAddedBy(e.target.value)}
          maxLength={60}
          placeholder="Trekker"
          className={FIELD}
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add contact'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
