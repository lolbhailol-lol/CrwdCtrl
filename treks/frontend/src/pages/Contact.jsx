import { useState } from 'react'
import Button from '../components/Button'

export default function Contact() {
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="container-narrow section-pad py-12 sm:py-16">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Contact</h1>
      <p className="mt-3 max-w-xl text-muted">
        Trail feedback or partnership ideas. Frontend-only for the MVP — nothing is sent to a server
        yet.
      </p>

      <div className="card-surface mt-10 p-6 sm:p-8">
        {submitted ? (
          <div className="py-8 text-center">
            <p className="text-2xl font-bold text-ink">Thanks — noted locally</p>
            <p className="mt-2 text-sm text-muted">Backend delivery comes later.</p>
            <Button className="mt-6" onClick={() => setSubmitted(false)}>
              Send another
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSubmitted(true)
            }}
            className="space-y-5"
          >
            {['Name', 'Email'].map((label) => (
              <div key={label}>
                <label className="text-sm font-medium text-muted" htmlFor={label.toLowerCase()}>
                  {label}
                </label>
                <input
                  id={label.toLowerCase()}
                  name={label.toLowerCase()}
                  type={label === 'Email' ? 'email' : 'text'}
                  required
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
                />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-muted" htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <Button type="submit">Send message</Button>
          </form>
        )}
      </div>
    </div>
  )
}
