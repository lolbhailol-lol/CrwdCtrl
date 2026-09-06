export default function InformationCard({ title, children, className = '' }) {
  return (
    <div className={`card-surface p-5 ${className}`}>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  )
}
