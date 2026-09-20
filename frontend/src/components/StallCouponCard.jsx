import { Store } from 'lucide-react';

const SVVAD = {
  orange: '#ED6920',
  teal: '#108474',
};

const SAMPLES = [
  '/svvad-pro/cookies.webp',
  '/svvad-pro/rusk.webp',
  '/svvad-pro/loops.webp',
  '/svvad-pro/chocos.webp',
];

/**
 * Svvad Pro stall offer.
 * `compact` — small strip for ticket / bookings (below QR).
 * Default — full hero card for success / preview.
 */
export default function StallCouponCard({ isDark, stallCoupon, compact = false }) {
  if (!stallCoupon) return null;

  const brand = stallCoupon.brand || 'Svvad Pro';
  const percent = Number(stallCoupon.discountPercent) || 20;
  const muted = isDark ? 'text-gray-400' : 'text-black/45';
  const ink = isDark ? 'text-white' : 'text-[#1A1412]';
  const hairline = isDark ? 'border-white/10' : 'border-black/[0.06]';

  if (compact) {
    return (
      <div
        className={`w-full rounded-2xl overflow-hidden text-left ${
          isDark
            ? 'bg-[#0a0b0c] border border-gray-700/50'
            : 'bg-[#FFF8F3] border border-[#ED6920]/30'
        }`}
      >
        <div className="relative h-28 overflow-hidden">
          <img
            src="/svvad-pro/offer-hero.png"
            alt={`${brand} snacks`}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(18,10,8,0.15) 0%, rgba(18,10,8,0.75) 100%)',
            }}
          />
          <img
            src="/svvad-pro/logo.png"
            alt="Svvad Pro"
            className="absolute top-2.5 left-2.5 h-6 w-auto object-contain rounded bg-white/95 px-1.5 py-0.5"
          />
          <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/65 mb-1">
              Unlocked with registration
            </p>
            <p className="text-3xl font-black leading-none tracking-tight text-white">
              {percent}%
              <span
                className="ml-1.5 text-base font-extrabold align-middle"
                style={{ color: SVVAD.orange }}
              >
                OFF
              </span>
            </p>
            <p className="mt-1 text-xs font-medium text-white/85">at the {brand} stall</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isDark ? 'bg-white/5 border border-gray-700/50' : 'bg-[#ED6920]/10'
            }`}
          >
            <Store className="h-4 w-4" style={{ color: SVVAD.orange }} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold leading-snug ${ink}`}>
              Show this at the {brand} stall
            </p>
            <p className={`mt-0.5 text-[11px] leading-snug ${muted}`}>
              3 &amp; 4 Oct · MindSpark, COEP
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl overflow-hidden ${
        isDark
          ? 'bg-[#0a0b0c] border border-gray-700/50 shadow-lg shadow-black/50'
          : 'bg-[#FFF8F3] border border-[#ED6920]/30 shadow-sm'
      }`}
    >
      {/* Full-bleed product hero */}
      <div className="relative h-44 sm:h-52 overflow-hidden">
        <img
          src="/svvad-pro/offer-hero.png"
          alt={`${brand} snacks`}
          className="absolute inset-0 w-full h-full object-cover scale-105"
          loading="eager"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,10,8,0.2) 0%, rgba(18,10,8,0.15) 35%, rgba(18,10,8,0.9) 100%)',
          }}
        />

        <img
          src="/svvad-pro/logo.png"
          alt="Svvad Pro"
          className="absolute top-4 left-4 h-8 w-auto object-contain rounded-md bg-white/95 px-2 py-1 shadow-sm"
        />

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 mb-2">
            Unlocked with registration
          </p>
          <p
            className="text-5xl sm:text-6xl font-black leading-none tracking-tight text-white"
            style={{ textShadow: '0 4px 24px rgba(0,0,0,0.35)' }}
          >
            {percent}%
            <span
              className="ml-2 text-2xl sm:text-3xl font-extrabold align-middle"
              style={{ color: SVVAD.orange }}
            >
              OFF
            </span>
          </p>
          <p className="mt-2.5 text-[15px] font-medium text-white/90">
            at the {brand} stall
          </p>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="flex w-full items-center gap-3">
          {SAMPLES.map((src) => (
            <div
              key={src}
              className={`relative h-12 w-12 rounded-xl overflow-hidden shrink-0 bg-white shadow-sm ${
                isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-black/5'
              }`}
            >
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
          <p className={`min-w-0 flex-1 text-xs font-medium leading-snug ${muted}`}>
            Protein cookies, rusk &amp; more
          </p>
        </div>

        <div className={`my-4 border-t ${hairline}`} />

        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              isDark ? 'bg-white/5 border border-gray-700/50' : 'bg-[#ED6920]/10'
            }`}
          >
            <Store className="h-[18px] w-[18px]" style={{ color: SVVAD.orange }} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold leading-snug ${ink}`}>
              Show this screen at the {brand} stall
            </p>
            <p className={`mt-1 text-xs leading-snug ${muted}`}>
              3 &amp; 4 Oct · MindSpark, COEP
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
