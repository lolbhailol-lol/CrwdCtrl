/** Instant black loader for fest / competition detail pages — no grey chrome gap. */
export default function DetailPageLoader({ label = 'Loading...' }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-7 w-7 rounded-full border-2 border-white/10 border-t-[#0ECCEE] animate-spin"
          aria-hidden
        />
        <p className="text-xs font-medium tracking-wide text-white/55">{label}</p>
      </div>
    </div>
  );
}
