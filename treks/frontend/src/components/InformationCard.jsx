export default function InformationCard({ title, children, icon, className = '' }) {
  return (
    <div className={`card-surface p-5 ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-100 text-forest-700 dark:bg-forest-800 dark:text-trail">
            {icon}
          </span>
        ) : null}
        <h3 className="font-display text-base font-semibold text-forest-800 dark:text-stone">
          {title}
        </h3>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-ink/70 dark:text-stone/70">{children}</div>
    </div>
  )
}
