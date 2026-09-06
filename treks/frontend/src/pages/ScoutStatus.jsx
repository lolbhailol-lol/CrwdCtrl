import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Button from '../components/Button'
import LoadingScreen from '../components/LoadingScreen'
import { fetchTrekBySlug, patchTrekStatus } from '../services/trekService'

const SCOUT_KEY = 'treks_scout_token'
const CROWD = ['Low', 'Moderate', 'High', 'Very High']
const TRAIL = ['Open', 'Slippery', 'Closed', 'Caution']
const ENTRY = ['Open', 'Restricted', 'Closed']

export default function ScoutStatus() {
  const { slug } = useParams()
  const [trek, setTrek] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(() => sessionStorage.getItem(SCOUT_KEY) || '')
  const [unlocked, setUnlocked] = useState(() => Boolean(sessionStorage.getItem(SCOUT_KEY)))
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const data = await fetchTrekBySlug(slug)
      if (!alive) return
      setTrek(data)
      if (data?.status) {
        setForm({
          crowdLevel: data.status.crowdLevel || 'Moderate',
          weather: data.status.weather || '',
          trailCondition: data.status.trailCondition || 'Open',
          parkingStatus: data.status.parkingStatus || '',
          forestAdvisory: data.status.forestAdvisory || '',
          entryStatus: data.status.entryStatus || 'Open',
          alert: data.status.alert || '',
        })
      }
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [slug])

  function unlock(e) {
    e.preventDefault()
    const t = token.trim()
    if (!t) return
    sessionStorage.setItem(SCOUT_KEY, t)
    setUnlocked(true)
    setError('')
  }

  function lock() {
    sessionStorage.removeItem(SCOUT_KEY)
    setUnlocked(false)
    setToken('')
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const scoutToken = sessionStorage.getItem(SCOUT_KEY)
      const updated = await patchTrekStatus(slug, form, scoutToken)
      setTrek(updated)
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Could not save status')
      if (err.status === 401) lock()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingScreen label="Loading scout board…" />
  if (!trek) {
    return (
      <div className="container-wide section-pad py-20 text-center">
        <p className="text-muted">Trek not found.</p>
        <Button to="/explore" className="mt-4">
          Back to explore
        </Button>
      </div>
    )
  }

  const fieldClass =
    'mt-1.5 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/50'

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="border-b border-white/8 bg-panel/80">
        <div className="container-wide flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Scout</p>
            <h1 className="text-xl font-bold text-ink">{trek.name}</h1>
          </div>
          <div className="flex gap-2">
            <Button to={`/trek/${slug}`} variant="ghost" size="sm">
              View trek
            </Button>
            {unlocked ? (
              <Button type="button" variant="outline" size="sm" onClick={lock}>
                Lock
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="container-wide section-pad max-w-xl py-10">
        {!unlocked ? (
          <form onSubmit={unlock} className="card-surface space-y-4 p-6">
            <h2 className="text-lg font-semibold text-ink">Enter scout token</h2>
            <p className="text-sm text-muted">
              Stored in this browser session only. Same value as <code className="text-brand">SCOUT_TOKEN</code> on
              the API.
            </p>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={fieldClass}
              placeholder="Scout token"
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full">
              Unlock editor
            </Button>
          </form>
        ) : (
          <form onSubmit={save} className="card-surface space-y-4 p-6">
            <h2 className="text-lg font-semibold text-ink">Update live status</h2>

            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Crowd
              <select
                value={form.crowdLevel}
                onChange={(e) => setField('crowdLevel', e.target.value)}
                className={fieldClass}
              >
                {CROWD.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Weather
              <input
                value={form.weather}
                onChange={(e) => setField('weather', e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Trail
              <select
                value={form.trailCondition}
                onChange={(e) => setField('trailCondition', e.target.value)}
                className={fieldClass}
              >
                {TRAIL.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Parking
              <input
                value={form.parkingStatus}
                onChange={(e) => setField('parkingStatus', e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Forest advisory
              <input
                value={form.forestAdvisory}
                onChange={(e) => setField('forestAdvisory', e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Entry
              <select
                value={form.entryStatus}
                onChange={(e) => setField('entryStatus', e.target.value)}
                className={fieldClass}
              >
                {ENTRY.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Alert / note
              <textarea
                rows={3}
                value={form.alert}
                onChange={(e) => setField('alert', e.target.value)}
                className={`${fieldClass} resize-none`}
              />
            </label>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {saved ? <p className="text-sm text-brand">Status saved.</p> : null}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving…' : 'Publish status'}
            </Button>

            <p className="text-center text-xs text-muted">
              <Link to={`/trek/${slug}`} className="text-brand hover:underline">
                Open public trek page
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
