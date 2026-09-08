import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { festPath, competitionPath } from '../utils/slugRoutes';
import { getImageUrl } from '../utils/imageImports';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';
import {
  buildCompetitionNavPayload,
  buildRegistrationPrefetch,
  saveRegistrationPrefetch,
} from '../utils/festPublicTransform';
import { saveCompetitionDetailCache } from '../utils/detailPageCache';
import {
  trackSimilarCompetitionClick,
  trackExploreFestClick,
} from '../services/analyticsService';
import SimilarCompetitionCard from './SimilarCompetitionCard';

const FEST_TYPE_LABEL = {
  technical: 'technical',
  cultural: 'cultural',
  sports: 'sports',
};

function prefetchCompAndRegistration(comp, fest) {
  const festId = fest._id || fest.id;
  try {
    const payload = buildCompetitionNavPayload(
      {
        ...comp,
        fest: {
          _id: festId,
          festName: fest.festName,
          slug: fest.slug,
          festType: fest.festType,
          collegeName: fest.collegeName,
          feeAmount: fest.feeAmount,
          ...(fest.registration ? { registration: fest.registration } : {}),
        },
      },
      null,
    );
    if (payload) {
      saveCompetitionDetailCache(comp._id || comp.id, {
        ...payload,
        title: comp.name,
        name: comp.name,
        coverImage: comp.coverImage || comp.image,
        image: comp.coverImage || comp.image,
      });
    }
    if (festId) {
      const prefetch = buildRegistrationPrefetch({ fest, competition: comp });
      if (prefetch) saveRegistrationPrefetch(festId, comp._id || comp.id, prefetch);
    }
  } catch {
    /* ignore */
  }
}

/**
 * End-of-page discovery: other fests of the same type (e.g. Techfest ↔ MindSpark).
 * variant="cards" — horizontal fest cards (fest detail page)
 * variant="blocks" — Explore {FestName} + 2 competition cards (competition detail)
 */
export default function SimilarFestsSection({
  relatedFests = [],
  festType = '',
  isDark = false,
  className = '',
  title,
  subtitle,
  limit,
  variant = 'cards',
  hideFee = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const backToHere = `${location.pathname}${location.search || ''}`;
  const raw = Array.isArray(relatedFests) ? relatedFests.filter((f) => f && (f._id || f.id)) : [];
  const list = typeof limit === 'number' && limit > 0 ? raw.slice(0, limit) : raw;
  if (list.length === 0) return null;

  const typeKey = String(festType || list[0]?.festType || '').toLowerCase();
  const typeWord = FEST_TYPE_LABEL[typeKey] || 'similar';

  if (variant === 'blocks') {
    const blocks = list.filter(
      (f) => Array.isArray(f.sampleCompetitions) && f.sampleCompetitions.length > 0,
    );
    if (!blocks.length) return null;

    return (
      <section className={className}>
        <div className="space-y-8">
          {blocks.map((fest) => {
            const id = fest._id || fest.id;
            const festName = fest.festName || 'Fest';
            const comps = fest.sampleCompetitions.slice(0, 2);
            const festPagePath = festPath({
              id,
              _id: id,
              slug: fest.slug,
              festName,
              title: festName,
            });

            const openComp = (comp) => {
              trackSimilarCompetitionClick({
                source: 'explore-other-fest',
                action: 'open_detail',
                competitionId: comp._id || comp.id,
                festId: id,
              });
              navigate(
                competitionPath({
                  id: comp._id || comp.id,
                  _id: comp._id || comp.id,
                  slug: comp.slug,
                  name: comp.name,
                  title: comp.name,
                }),
                {
                  state: {
                    competition: {
                      ...comp,
                      registrationType: comp.registrationType || 'fest',
                      fest: {
                        _id: id,
                        festName: fest.festName,
                        slug: fest.slug,
                        festType: fest.festType,
                        collegeName: fest.collegeName,
                        feeAmount: fest.feeAmount,
                        registration: fest.registration || undefined,
                      },
                      festId: id,
                    },
                    from: 'explore-other-fest-comp',
                    skipDemoLoad: true,
                    backTo: backToHere,
                  },
                },
              );
            };

            return (
              <div key={String(id)}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className={`text-base sm:text-lg font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Explore {festName}
                      {fest.collegeName ? (
                        <span className={`font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {' '}· {fest.collegeName}
                        </span>
                      ) : null}
                    </h2>
                    <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Competitions you might be interested in
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      trackExploreFestClick({
                        source: 'explore-other-fest',
                        action: 'view_fest',
                        festId: id,
                        festName,
                      });
                      navigate(festPagePath, { state: { from: 'explore-other-fest' } });
                    }}
                    className={`shrink-0 text-xs font-semibold ${isDark ? 'text-[#0ECCEE]' : 'text-[#0099B8]'}`}
                  >
                    View fest
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 items-stretch">
                  {comps.map((comp) => (
                    <SimilarCompetitionCard
                      key={String(comp._id || comp.name)}
                      comp={comp}
                      isDark={isDark}
                      hideFee={hideFee}
                      onPrefetch={() => prefetchCompAndRegistration(comp, fest)}
                      onOpen={() => openComp(comp)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  const heading =
    title ||
    (typeWord === 'similar' ? 'Explore more fests' : `Explore more ${typeWord} fests`);
  const sub = subtitle || 'Also check these fests';

  return (
    <section className={`${className}`}>
      <div className="mb-3 px-0">
        <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {heading}
        </h2>
        <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {sub}
        </p>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {list.map((fest) => {
          const id = fest._id || fest.id;
          const festName = fest.festName || 'Fest';
          const college = String(fest.collegeName || '').trim();
          const cover = fest.coverImage || '';
          const src = cover
            ? getImageUrl(cover, { preset: 'detail' }) || getImageUrl(cover, { preset: 'thumb' })
            : null;
          const path = festPath({
            id,
            _id: id,
            slug: fest.slug,
            festName,
            title: festName,
          });

          return (
            <article
              key={String(id)}
              className="card-surface snap-start shrink-0 w-[min(85vw,320px)] sm:w-[280px] rounded-2xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => {
                  trackExploreFestClick({
                    source: 'similar-fests-cards',
                    action: 'open_fest',
                    festId: id,
                    festName,
                  });
                  navigate(path, { state: { from: 'similar-fests' } });
                }}
                className="w-full text-left active:scale-[0.99] transition"
              >
                <div className={`relative aspect-[16/10] w-full ${isDark ? 'bg-[#0B0C0D]' : 'bg-gray-100'}`}>
                  {src ? (
                    <img
                      src={src}
                      alt={festName}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => handleImageErrorWithFallback(e, festName, 'fest')}
                    />
                  ) : (
                    <div
                      className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${
                        isDark ? 'text-gray-600' : 'text-gray-400'
                      }`}
                    >
                      {festName}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white font-bold text-sm sm:text-base leading-snug line-clamp-2">
                      {festName}
                      {college ? (
                        <span className="font-semibold text-white/75"> · {college}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
