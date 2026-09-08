import React from 'react';
import CompetitionCoverImage from './CompetitionCoverImage';
import { resolveCompetitionFee } from '../utils/festPublicTransform';

/**
 * Compact discovery card: cover → title + fee → outline Explore.
 * density="minimal" — smaller mobile Explore-fest cards (desktop stays comfortable).
 */
export default function SimilarCompetitionCard({
  comp,
  isDark = false,
  hideFee = false,
  onOpen,
  onPrefetch,
  actionLabel = 'Explore',
  density = 'default',
}) {
  const name = typeof comp?.name === 'string' ? comp.name : (comp?.title || 'Competition');
  const fee = resolveCompetitionFee(comp);
  const feeLabel = fee.known ? fee.label : (comp?.feeLabel || comp?.registrationFee || '');
  const feeIsFree = fee.isFree || feeLabel === 'Free';
  const minimal = density === 'minimal';

  return (
    <article
      className={`card-surface h-full w-full overflow-hidden flex flex-col ${
        minimal ? 'rounded-xl md:rounded-2xl' : 'rounded-2xl'
      }`}
    >
      <button
        type="button"
        onPointerDown={onPrefetch}
        onClick={onOpen}
        className="text-left flex flex-col flex-1 min-h-0 active:scale-[0.99] transition"
      >
        <div
          className={`relative w-full shrink-0 overflow-hidden ${isDark ? 'bg-[#0B0C0D]' : 'bg-gray-100'} ${
            minimal
              ? 'aspect-[16/10] md:aspect-[4/3]'
              : 'aspect-[5/4] sm:aspect-[4/3]'
          }`}
        >
          <CompetitionCoverImage
            src={comp?.coverImage || comp?.image}
            alt={name}
            preset="cardSm"
            placeholder="muted"
            eager={minimal}
            containerClassName="absolute inset-0 w-full h-full"
          />
        </div>

        <div
          className={`flex flex-col flex-1 min-h-0 ${
            isDark ? 'bg-[#111213]' : 'bg-white'
          } ${minimal ? 'px-2 pt-1.5 pb-1 md:px-3 md:pt-2.5 md:pb-2' : 'px-3 pt-2.5 pb-2'}`}
        >
          <h3
            className={`font-bold leading-snug line-clamp-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            } ${
              minimal
                ? 'text-[12px] md:text-sm min-h-0 md:min-h-[2.5rem]'
                : 'text-[13px] sm:text-sm min-h-[2.5rem]'
            }`}
          >
            {name}
          </h3>
          {!hideFee && feeLabel ? (
            <p
              className={`font-bold tabular-nums ${
                minimal ? 'mt-0.5 text-xs md:mt-1 md:text-sm' : 'mt-1 text-sm'
              } ${
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
          ) : !minimal ? (
            <span className="mt-1 block h-5" aria-hidden />
          ) : null}
        </div>
      </button>

      <div
        className={`${isDark ? 'bg-[#111213]' : 'bg-white'} ${
          minimal ? 'px-2 pb-2 pt-0 md:px-3 md:pb-3' : 'px-3 pb-3 pt-0'
        }`}
      >
        <button
          type="button"
          onPointerDown={onPrefetch}
          onClick={onOpen}
          className={`w-full rounded-lg font-semibold active:scale-[0.98] transition border ${
            minimal ? 'h-7 text-[11px] md:h-8 md:text-xs' : 'h-8 text-xs'
          } ${
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
