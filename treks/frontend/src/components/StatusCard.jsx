const accents = {
  default: 'border-brand/20',
  success: 'border-brand/30',
  warning: 'border-warn/30',
  danger: 'border-danger/30',
  info: 'border-[#9dcedd]/25',
  trail: 'border-brand/20',
}

const valueColor = {
  default: 'text-ink',
  success: 'text-brand',
  warning: 'text-[#ffcd98]',
  danger: 'text-danger',
  info: 'text-faint',
  trail: 'text-brand',
}

export default function StatusCard({
  label,
  value,
  hint,
  tone = 'default',
  compact = false,
  className = '',
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-panel p-5 shadow-lg transition hover:bg-panel/90 ${accents[tone] ?? accents.default} ${className}`}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand/5" />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
        <p
          className={`mt-3 font-bold tracking-tight ${
            compact ? 'text-base leading-snug sm:text-lg' : 'text-2xl'
          } ${valueColor[tone] ?? valueColor.default}`}
        >
          {value}
        </p>
        {hint ? <p className="mt-2 text-sm leading-relaxed text-muted">{hint}</p> : null}
      </div>
    </div>
  )
}
