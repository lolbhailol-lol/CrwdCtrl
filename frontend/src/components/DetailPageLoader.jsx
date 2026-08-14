import { ArrowLeft } from 'lucide-react';

/**
 * Detail-page wait state — light 3D icon + short message
 * (used while fest / competition / trek / sports details load).
 */
export default function DetailPageLoader({
  label = 'Hang tight — loading details',
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0a0a0b]"
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
    >
      <div className="detail-loader flex flex-col items-center px-6 text-center">
        <div className="detail-loader-stage" aria-hidden>
          <div className="detail-loader-orb" />
          <div className="detail-loader-card">
            <div className="detail-loader-card-face detail-loader-card-front">
              <span className="detail-loader-mark">C</span>
              <span className="detail-loader-shine" />
            </div>
            <div className="detail-loader-card-face detail-loader-card-side" />
            <div className="detail-loader-card-face detail-loader-card-bottom" />
          </div>
        </div>

        <p className="mt-7 text-sm font-medium tracking-wide text-white/70">
          {label || 'Hang tight — loading details'}
        </p>
        <p className="mt-1.5 text-xs text-white/35">Almost there</p>
      </div>
    </div>
  );
}

/**
 * WhatsApp / shared fest & competition links: same page chrome as the real
 * detail screen — no spinner, no black loading card. Content fills in on top.
 */
export function FestDetailOpeningShell({ onBack }) {
  return (
    <div className="crwdctrl-page min-h-screen overflow-x-clip bg-black page-transition-enter">
      <div className="md:hidden">
        <div className="relative h-80 overflow-hidden bg-[#1A1B1D]">
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.75rem,var(--safe-top))] pb-3 z-10">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
          </div>
        </div>
        <div className="relative -mt-10 rounded-t-[28px] z-10 min-h-[55vh] bg-[#161718]" />
      </div>
      <div className="hidden md:block min-h-screen bg-black" />
    </div>
  );
}

export function CompetitionDetailOpeningShell({ onBack }) {
  return (
    <div className="crwdctrl-page flex flex-col min-h-screen bg-black page-transition-enter">
      <div className="block md:hidden w-full">
        <div className="relative w-full h-[396px] shrink-0 overflow-hidden bg-[#1A1B1D]">
          <div
            className="absolute top-0 left-0 right-0 flex items-center px-4 z-10"
            style={{ paddingTop: 'calc(max(var(--safe-top), 0px) + 2.5rem)' }}
          >
            <button
              type="button"
              onClick={onBack}
              className="size-11 rounded-full bg-black/40 flex items-center justify-center text-white"
              aria-label="Go back"
            >
              <ArrowLeft size={22} strokeWidth={2.25} />
            </button>
          </div>
        </div>
        <div className="relative -mt-10 flex-1 rounded-t-3xl z-10 min-h-[45vh] bg-[#161718]" />
      </div>
      <div className="hidden md:block min-h-screen bg-black" />
    </div>
  );
}
