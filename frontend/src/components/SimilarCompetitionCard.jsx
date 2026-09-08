import React from 'react';
import CompetitionCoverImage from './CompetitionCoverImage';
import { resolveCompetitionFee } from '../utils/festPublicTransform';

/**
 * Compact discovery card: cover → title + fee → outline Explore.
 * Whole card opens competition detail.
 */
export default function SimilarCompetitionCard({
  comp,
  isDark = false,
  hideFee = false,
  onOpen,
  onPrefetch,
  actionLabel = 'Explore',
}) {
  const name = typeof comp?.name === 'string' ? comp.name : (comp?.title || 'Competition');
  const fee = resolveCompetitionFee(comp);
  const feeLabel = fee.known ? fee.label : (comp?.feeLabel || comp?.registrationFee || '');
  const feeIsFree = fee.isFree || feeLabel === 'Free';

  return (
    <article className="card-surface h-full rounded-2xl overflow-hidden flex flex-col">
      <button
        type="button"
        onPointerDown={onPrefetch}
        onClick={onOpen}
        className="text-left flex flex-col flex-1 min-h-0 active:scale-[0.99] transition"
      >
        <div className={`relative aspect-[4/3] w-full shrink-0 ${isDark ? 'bg-[#0B0C0D]' : 'bg-gray-100'}`}>
          <CompetitionCoverImage
            src={comp?.coverImage || comp?.image}
            alt={name}
            preset="cardSm"
            placeholder="muted"
            containerClassName="absolute inset-0 w-full h-full"
          />
        </div>

        <div className={`px-3 pt-2.5 pb-2 flex flex-col flex-1 min-h-0 ${isDark ? 'bg-[#111213]' : 'bg-white'}`}>
          <h3
            className={`text-[13px] sm:text-sm font-bold leading-snug line-clamp-2 min-h-[2.5rem] ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {name}
          </h3>
          {!hideFee && feeLabel ? (
            <p
              className={`mt-1 text-sm font-bold tabular-nums ${
                feeIsFree
                  ? isDark
                    ? 'text-emerald-400'
                    : 'text-emerald-600'
                  : isDark
                    ? 'text-[#0ECCEE]'
                    : 'text-[#0099B8]'
              }`}
            >
              {feeLabel}
            </p>
          ) : (
            <span className="mt-1 block h-5" aria-hidden />
          )}
        </div>
      </button>

      <div className={`px-3 pb-3 pt-0 ${isDark ? 'bg-[#111213]' : 'bg-white'}`}>
        <button
          type="button"
          onPointerDown={onPrefetch}
          onClick={onOpen}
          className={`w-full h-8 rounded-lg text-xs font-semibold active:scale-[0.98] transition border ${
            isDark
              ? 'border-white/15 text-gray-200 bg-transparent hover:bg-white/5'
              : 'border-gray-300 text-gray-800 bg-transparent hover:bg-gray-50'
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
}
