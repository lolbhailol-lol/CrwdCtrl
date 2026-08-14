import { ArrowLeft } from 'lucide-react';

/** Inline skeleton shell — no spinner, matches detail page layout for smooth route shift */
export default function DetailPageShell({ onBack }) {
  return (
    <div className="crwdctrl-page min-h-screen bg-black">
      <div className="block md:hidden w-full">
        <div className="relative w-full h-[396px] shrink-0 overflow-hidden bg-[#1A1B1D]">
          <div className="absolute inset-0 skeleton-shimmer-dark opacity-40" />
          {onBack && (
            <div
              className="absolute top-0 left-0 right-0 flex items-center px-4 z-10"
              style={{ paddingTop: 'calc(max(var(--safe-top), 0px) + 2.5rem)' }}
            >
              <button
                type="button"
                onClick={onBack}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        <div className="px-4 pt-5 space-y-3">
          <div className="h-7 w-[78%] rounded-lg skeleton-shimmer-dark" />
          <div className="h-4 w-[52%] rounded-md skeleton-shimmer-dark opacity-70" />
          <div className="h-4 w-[40%] rounded-md skeleton-shimmer-dark opacity-50" />
        </div>
      </div>
      <div className="hidden md:block max-w-7xl mx-auto px-4 lg:px-6 py-4">
        <div className="h-80 xl:h-96 rounded-2xl skeleton-shimmer-dark mb-6" />
        <div className="h-8 w-2/3 rounded-lg skeleton-shimmer-dark mb-3" />
        <div className="h-4 w-1/2 rounded-md skeleton-shimmer-dark opacity-70" />
      </div>
    </div>
  );
}
