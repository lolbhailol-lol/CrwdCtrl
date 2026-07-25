const tones = {
  default: 'bg-forest-100 text-forest-800 dark:bg-forest-800 dark:text-forest-100',
  trail: 'bg-trail/20 text-trail-dark dark:bg-trail/15 dark:text-trail',
  soft: 'bg-stone text-ink dark:bg-white/10 dark:text-stone',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
}

export default function Badge({ children, tone = 'default', className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${tones[tone] ?? tones.default} ${className}`}
    >
      {children}
    </span>
  )
}

export function difficultyTone(difficulty) {
  switch (difficulty) {
    case 'Easy':
      return 'success'
    case 'Moderate':
      return 'info'
    case 'Difficult':
      return 'warning'
    case 'Challenging':
      return 'danger'
    default:
      return 'default'
  }
}

export function crowdTone(level) {
  switch (level) {
    case 'Low':
      return 'success'
    case 'Moderate':
      return 'info'
    case 'High':
      return 'warning'
    case 'Very High':
      return 'danger'
    default:
      return 'default'
  }
}

export function trailTone(condition) {
  switch (condition) {
    case 'Open':
      return 'success'
    case 'Slippery':
      return 'warning'
    case 'Closed':
      return 'danger'
    default:
      return 'default'
  }
}
