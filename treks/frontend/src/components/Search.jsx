export default function Search({
  value,
  onChange,
  placeholder = 'Search treks, forts, waterfalls…',
  className = '',
  onSubmit,
}) {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit?.(value)
  }

  return (
    <form onSubmit={handleSubmit} className={`relative w-full ${className}`}>
      <label htmlFor="trek-search" className="sr-only">
        Search treks
      </label>
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-forest-600/60 dark:text-forest-300/70">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <input
        id="trek-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-forest-800/10 bg-white/90 py-3.5 pl-12 pr-4 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink/40 focus:border-forest-600/40 focus:ring-2 focus:ring-forest-500/20 dark:border-white/10 dark:bg-forest-900/90 dark:text-stone dark:placeholder:text-stone/40 dark:focus:border-trail/40 dark:focus:ring-trail/20"
      />
    </form>
  )
}
