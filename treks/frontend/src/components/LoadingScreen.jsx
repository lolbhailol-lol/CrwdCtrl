export default function LoadingScreen({ label = 'Loading live trek data…' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-brand" />
      </span>
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  )
}
