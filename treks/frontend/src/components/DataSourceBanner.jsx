import { useTrekData } from '../context/TrekDataContext'

export default function DataSourceBanner() {
  const { source, error, apiBase, refresh, loading } = useTrekData()

  if (source === 'api' || source === 'idle') return null

  const message =
    source === 'api-no-db'
      ? 'Live reports are temporarily unavailable — trail info only'
      : `Offline — showing trail info only, no live reports (${apiBase})`

  return (
    <div className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-xs font-medium text-[#ffcd98]">
      {message}
      {error && source !== 'api-no-db' ? <span className="opacity-70"> · {error}</span> : null}
      <button
        type="button"
        onClick={() => refresh({ force: true })}
        disabled={loading}
        className="ml-3 min-h-11 px-1 font-bold text-brand underline underline-offset-2 disabled:opacity-50"
      >
        Retry
      </button>
    </div>
  )
}
