import { Link } from 'react-router-dom'
import Badge, { crowdTone, entryTone } from './Badge'
import { formatRelativeTime } from '../utils/formatters'

export default function LiveStatusBoard({ treks = [] }) {
  return (
    <section className="container-wide section-pad mb-12 sm:mb-16">
      <div className="rounded-[24px] border border-white/10 bg-panel p-5 shadow-2xl sm:rounded-[32px] sm:p-8">
        <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:mb-8 sm:flex-row sm:items-end">
          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand sm:mb-2">
              Real-time Dashboard
            </span>
            <h2 className="text-xl font-bold text-ink sm:text-2xl">Live Status Board</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand sm:text-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
            </span>
            Live Monitoring
          </div>
        </div>

        <div className="hidden overflow-x-auto no-scrollbar md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
                {['Trek Destination', 'Trail Condition', 'Entry Status', 'Elevation', 'Crowd', 'Last Updated'].map(
                  (h) => (
                    <th
                      key={h}
                      className={`pb-4 text-xs font-bold uppercase tracking-wider text-muted ${
                        h === 'Last Updated' ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {treks.map((trek) => (
                <tr key={trek.id} className="group transition hover:bg-white/5">
                  <td className="py-5">
                    <Link
                      to={`/trek/${trek.slug}`}
                      className="text-base font-semibold text-ink transition group-hover:text-brand sm:text-lg"
                    >
                      {trek.name}
                    </Link>
                  </td>
                  <td className="py-5 text-sm text-muted">{trek.status.trailCondition}</td>
                  <td className="py-5">
                    <Badge tone={entryTone(trek.status.entryStatus)}>{trek.status.entryStatus}</Badge>
                  </td>
                  <td className="py-5 text-sm font-bold text-ink">{trek.elevation}</td>
                  <td className="py-5">
                    <Badge tone={crowdTone(trek.status.crowdLevel)}>{trek.status.crowdLevel}</Badge>
                  </td>
                  <td className="py-5 text-right text-xs font-medium text-muted sm:text-sm">
                    {formatRelativeTime(trek.status.lastUpdated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 md:hidden">
          {treks.map((trek) => (
            <Link
              key={trek.id}
              to={`/trek/${trek.slug}`}
              className="block rounded-xl border border-white/10 bg-surface p-4 shadow-lg transition hover:border-brand/50 active:scale-[0.99]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-ink">{trek.name}</h3>
                <Badge tone={crowdTone(trek.status.crowdLevel)}>{trek.status.crowdLevel}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span>{trek.status.trailCondition}</span>
                <span>·</span>
                <span>Entry {trek.status.entryStatus}</span>
                <span>·</span>
                <span>{formatRelativeTime(trek.status.lastUpdated)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
