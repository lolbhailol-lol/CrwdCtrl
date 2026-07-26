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
  const known = value != null && value !== ''

  return (
    <div className={`rounded-xl border border-white/10 bg-panel p-4 ${className}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1.5 font-semibold ${compact ? 'text-sm leading-snug sm:text-base' : 'text-base'} ${
          known ? (valueColor[tone] ?? valueColor.default) : 'font-normal text-muted/70'
        }`}
      >
        {known ? value : 'No reports yet'}
      </p>
      {hint ? <p className="mt-1.5 text-sm leading-relaxed text-muted">{hint}</p> : null}
    </div>
  )
}
