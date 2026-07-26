const tones = {
  default: 'bg-white/8 text-muted border border-white/10',
  soft: 'bg-white/5 text-muted border border-white/10',
  brand: 'bg-white/10 text-ink border border-white/15',
  success: 'bg-white/8 text-ink border border-white/10',
  warning: 'bg-white/8 text-warn border border-white/10',
  danger: 'bg-white/8 text-danger border border-white/10',
  info: 'bg-white/8 text-muted border border-white/10',
  trail: 'bg-white/8 text-muted border border-white/10',
}

export default function Badge({ children, tone = 'default', className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone] ?? tones.default} ${className}`}
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
      return 'soft'
  }
}

export function crowdTone(level) {
  switch (level) {
    case 'Low':
      return 'success'
    case 'Moderate':
      return 'warning'
    case 'High':
    case 'Very High':
      return 'danger'
    default:
      return 'soft'
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
      return 'soft'
  }
}

export function entryTone(status) {
  switch (status) {
    case 'Open':
      return 'success'
    case 'Restricted':
      return 'warning'
    case 'Closed':
      return 'danger'
    default:
      return 'soft'
  }
}
