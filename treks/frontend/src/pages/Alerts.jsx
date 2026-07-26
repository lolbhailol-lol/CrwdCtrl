import { useMemo } from 'react'
import Badge from '../components/Badge'
import LoadingScreen from '../components/LoadingScreen'
import { useTrekData } from '../context/TrekDataContext'

const severityTone = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
}

export default function Alerts() {
  const { ready, loading, tick, getAlerts } = useTrekData()
  const alerts = useMemo(() => (ready ? getAlerts() : []), [ready, tick, getAlerts])

  if (!ready) {
    return <LoadingScreen label={loading ? 'Loading alerts…' : 'Loading…'} />
  }

  return (
    <div className="container-wide section-pad py-10 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <span className="text-xs font-bold uppercase tracking-widest text-brand">Field alerts</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Live Advisories
        </h1>
        <p className="mt-3 text-muted">
          Statewide alerts for iconic Maharashtra corridors — rain, parking, fog, permissions.
        </p>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <article key={alert.id} className="card-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={severityTone[alert.severity] ?? 'soft'}>{alert.severity}</Badge>
                  <span className="text-xs font-medium text-muted">{alert.region}</span>
                </div>
                <h2 className="mt-3 text-lg font-bold text-ink sm:text-xl">{alert.title}</h2>
              </div>
              <span className="text-xs font-medium text-muted">{alert.time}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{alert.description}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
