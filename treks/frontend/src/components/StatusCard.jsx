const accent = {
  default: 'from-forest-500/10',
  success: 'from-emerald-500/15',
  warning: 'from-amber-500/15',
  danger: 'from-rose-500/15',
  info: 'from-sky-500/15',
  trail: 'from-trail/20',
}

const valueColor = {
  default: 'text-forest-800 dark:text-stone',
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-800 dark:text-amber-200',
  danger: 'text-rose-700 dark:text-rose-300',
  info: 'text-sky-800 dark:text-sky-300',
  trail: 'text-trail-dark dark:text-trail',
}

export default function StatusCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  compact = false,
  className = '',
}) {
  return (
    <div
      className={`card-surface relative overflow-hidden p-5 transition hover:shadow-md ${className}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent[tone] ?? accent.default} via-transparent to-transparent`}
      />
      <div
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accent[tone] ?? accent.default} to-transparent`}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45 dark:text-stone/45">
            {label}
          </p>
          {icon ? <span className="text-forest-600 dark:text-trail">{icon}</span> : null}
        </div>
        <p
          className={`mt-3 font-display font-bold tracking-tight ${
            compact ? 'text-base leading-snug sm:text-lg' : 'text-2xl'
          } ${valueColor[tone] ?? valueColor.default}`}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-2 text-sm leading-relaxed text-ink/60 dark:text-stone/60">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

