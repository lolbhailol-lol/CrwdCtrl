import { useState } from 'react';

export default function StallCouponCard({ isDark, stallCoupon }) {
  const [copied, setCopied] = useState(false);

  if (!stallCoupon) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(stallCoupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unsupported, ignore */
    }
  };

  return (
    <div
      className={`rounded-2xl border p-5 text-center ${
        isDark
          ? 'bg-[#0ECCEE]/10 border-[#0ECCEE]/30'
          : 'bg-[#0ECCEE]/5 border-[#0ECCEE]/40'
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-[#0ECCEE]' : 'text-[#0a9fb8]'}`}>
        🎟️ Stall Coupon Unlocked
      </p>

      <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
        {stallCoupon.brand}
      </p>

      <div
        className={`flex items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-3 mb-3 ${
          isDark ? 'border-[#0ECCEE]/40 bg-black/20' : 'border-[#0ECCEE]/50 bg-white'
        }`}
      >
        <span className={`font-mono text-xl tracking-widest font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {stallCoupon.code}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#0ECCEE] text-black hover:bg-[#0ECCEE]/80 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        Show this code at the <strong>{stallCoupon.brand}</strong> stall on fest day to redeem
      </p>
    </div>
  );
}