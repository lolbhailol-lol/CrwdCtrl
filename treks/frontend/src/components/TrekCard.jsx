import { Link } from 'react-router-dom'
import Badge, { difficultyTone } from './Badge'

export default function TrekCard({ trek }) {
  return (
    <Link
      to={`/trek/${trek.slug}`}
      className="group card-surface overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={trek.heroImage}
          alt={trek.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950/70 via-transparent to-transparent" />
        <div className="absolute left-3 top-3">
          <Badge tone="soft">{trek.category}</Badge>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-display text-xl font-bold text-white">{trek.name}</h3>
          <p className="mt-0.5 text-sm text-white/80">{trek.location}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-4">
        <Badge tone={difficultyTone(trek.difficulty)}>{trek.difficulty}</Badge>
        <span className="text-xs text-ink/55 dark:text-stone/55">{trek.distance}</span>
        <span className="text-ink/25 dark:text-stone/25">·</span>
        <span className="text-xs text-ink/55 dark:text-stone/55">{trek.duration}</span>
      </div>
    </Link>
  )
}
