import { useState } from 'react'
import Button from '../components/Button'

export default function Contact() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="container-narrow section-pad py-12 sm:py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight text-forest-800 dark:text-stone sm:text-5xl">
        Contact
      </h1>
      <p className="mt-3 max-w-xl text-ink/60 dark:text-stone/60">
        Share trail feedback, corrections, or partnership ideas. This form is frontend-only for
        the MVP — nothing is sent to a server yet.
      </p>

      <div className="card-surface mt-10 p-6 sm:p-8">
        {submitted ? (
          <div className="py-8 text-center">
            <p className="font-display text-2xl font-bold text-forest-800 dark:text-stone">
              Thanks — message noted locally
            </p>
            <p className="mt-2 text-sm text-ink/60 dark:text-stone/60">
              Backend delivery will be connected in a later phase.
            </p>
            <Button className="mt-6" onClick={() => setSubmitted(false)}>
              Send another
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="text-sm font-medium text-ink/80 dark:text-stone/80">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                className="mt-1.5 w-full rounded-xl border border-forest-800/10 bg-white px-4 py-3 text-sm outline-none focus:border-forest-600/40 focus:ring-2 focus:ring-forest-500/20 dark:border-white/10 dark:bg-forest-950 dark:text-stone"
              />
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-medium text-ink/80 dark:text-stone/80">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1.5 w-full rounded-xl border border-forest-800/10 bg-white px-4 py-3 text-sm outline-none focus:border-forest-600/40 focus:ring-2 focus:ring-forest-500/20 dark:border-white/10 dark:bg-forest-950 dark:text-stone"
              />
            </div>
            <div>
              <label
                htmlFor="message"
                className="text-sm font-medium text-ink/80 dark:text-stone/80"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                className="mt-1.5 w-full rounded-xl border border-forest-800/10 bg-white px-4 py-3 text-sm outline-none focus:border-forest-600/40 focus:ring-2 focus:ring-forest-500/20 dark:border-white/10 dark:bg-forest-950 dark:text-stone"
              />
            </div>
            <Button type="submit">Send message</Button>
          </form>
        )}
      </div>

      <p className="mt-8 text-sm text-ink/50 dark:text-stone/50">
        Future contact: hello@treks.crwdctrl.in
      </p>
    </div>
  )
}
