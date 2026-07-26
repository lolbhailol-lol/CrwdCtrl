import { Link } from 'react-router-dom'
import Badge, { crowdTone, difficultyTone } from './Badge'

export default function TrekCard({ trek }) {
  return (
    <Link
      to={`/trek/${trek.slug}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-panel shadow-lg transition duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={trek.heroImage}
          alt={trek.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-transparent to-transparent" />
        <div className="absolute left-3 top-3">
          <Badge tone="soft">{trek.category.replace(' Trek', '')}</Badge>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-xl font-bold text-ink">{trek.name}</h3>
          <p className="mt-0.5 text-sm text-muted">{trek.location}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-4">
        <Badge tone={difficultyTone(trek.difficulty)}>{trek.difficulty}</Badge>
        <Badge tone={crowdTone(trek.status.crowdLevel)}>{trek.status.crowdLevel}</Badge>
        <span className="text-xs text-muted">{trek.distance}</span>
        <span className="text-white/20">·</span>
        <span className="text-xs text-muted">{trek.duration}</span>
      </div>
    </Link>
  )
}
