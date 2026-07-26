export default function Search({
  value,
  onChange,
  placeholder = 'Search trails…',
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
      <input
        id="trek-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-white/10 bg-panel py-2 pl-3.5 pr-20 text-sm text-ink placeholder:text-muted/70 outline-none focus:border-white/25 sm:h-12 sm:pl-4 sm:pr-24"
      />
      <button
        type="submit"
        className="absolute right-1 top-1 bottom-1 rounded-md bg-brand px-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover sm:right-1.5 sm:top-1.5 sm:bottom-1.5 sm:px-4"
      >
        Search
      </button>
    </form>
  )
}
