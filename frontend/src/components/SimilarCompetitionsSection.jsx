import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { competitionPath, festPath } from '../utils/slugRoutes';
import {
  buildCompetitionNavPayload,
  buildRegistrationPrefetch,
  saveRegistrationPrefetch,
} from '../utils/festPublicTransform';
import { saveCompetitionDetailCache } from '../utils/detailPageCache';
import { resolveSimilarCompetitionCards } from '../utils/similarCompetitions';
import { trackSimilarCompetitionClick } from '../services/analyticsService';
import { markWarmCompetitionNav } from '../utils/warmCompetitionNav';
import SimilarCompetitionCard from './SimilarCompetitionCard';

function resolveFestRef(competition, festOverride) {
  return (
    festOverride ||
    competition?.fest ||
    (competition?.festId
      ? { _id: competition.festId, festName: competition.festName }
      : null)
  );
}

function prefetchCompAndRegistration(comp, festRef) {
  try {
    const festId = festRef?._id || festRef?.id;
    const payload = buildCompetitionNavPayload(
      {
        ...comp,
        fest: festRef
          ? {
              _id: festId,
              festName: festRef.festName,
              slug: festRef.slug,
              festType: festRef.festType,
              collegeName: festRef.collegeName,
              feeAmount: festRef.feeAmount,
              ...(festRef.registration ? { registration: festRef.registration } : {}),
            }
          : null,
      },
      null,
    );
    if (payload) {
      saveCompetitionDetailCache(comp._id || comp.id, {
        ...payload,
        title: comp.name || comp.title,
        name: comp.name,
        coverImage: comp.coverImage || comp.image,
        image: comp.coverImage || comp.image,
      });
    }
    if (festRef && festId) {
      const prefetch = buildRegistrationPrefetch({ fest: festRef, competition: comp });
      if (prefetch) {
        saveRegistrationPrefetch(festId, comp._id || comp.id, prefetch);
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Two competition cards — always open competition detail (user can register from there).
 */
export default function SimilarCompetitionsSection({
  competition,
  relatedFromApi = [],
  festTitle = '',
  festOverride = null,
  isDark = false,
  hideFee = false,
  className = '',
  heading,
  subtitle,
  analyticsSource = 'similar-competitions',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const festRef = resolveFestRef(competition, festOverride);

  const cards = useMemo(
    () =>
      resolveSimilarCompetitionCards({
        currentCompetition: competition,
        relatedFromApi,
        festId: festRef?._id || festRef?.id || competition?.festId,
        limit: 2,
      }),
    [competition, relatedFromApi, festRef],
  );

  if (!cards.length) return null;

  const festHeading =
    heading ||
    String(
      festTitle ||
        festRef?.festName ||
        competition?.fest?.festName ||
        competition?.fest?.title ||
        '',
    ).trim() ||
    'This fest';
  const collegeHeading = String(
    festRef?.collegeName ||
      competition?.fest?.collegeName ||
      competition?.fest?.organizing_body ||
      '',
  ).trim();
  const sub = subtitle || 'Competitions you might be interested in';

  const goToDetail = (comp) => {
    trackSimilarCompetitionClick({
      source: analyticsSource,
      action: 'open_detail',
      competitionId: comp._id || comp.id,
      festId: festRef?._id || festRef?.id,
    });
    prefetchCompAndRegistration(comp, festRef);
    markWarmCompetitionNav();
    const path = competitionPath({
      id: comp._id || comp.id,
      _id: comp._id || comp.id,
      slug: comp.slug,
      name: comp.name,
      title: comp.name,
    });
    navigate(path, {
      state: {
        competition: {
          ...comp,
          fest: festRef || null,
          festId: festRef?._id || festRef?.id,
        },
        from: analyticsSource,
        skipDemoLoad: true,
        backTo: `${location.pathname}${location.search || ''}`,
      },
    });
  };

  return (
    <section className={className}>
      <div className="mb-3 max-w-md sm:max-w-lg md:max-w-xl">
        <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {festHeading}
          {!heading && collegeHeading ? (
            <span className={`font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {' '}· {collegeHeading}
            </span>
          ) : null}
        </h2>
        <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {sub}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md sm:max-w-lg md:max-w-xl items-stretch">
        {cards.map((comp) => (
          <SimilarCompetitionCard
            key={String(comp._id || comp.id)}
            comp={comp}
            isDark={isDark}
            hideFee={hideFee}
            onPrefetch={() => prefetchCompAndRegistration(comp, festRef)}
            onOpen={() => goToDetail(comp)}
          />
        ))}
      </div>
      {festRef && (festRef._id || festRef.id || festRef.slug) ? (
        <button
          type="button"
          onClick={() => navigate(festPath(festRef))}
          className={`mt-3 text-xs font-semibold ${isDark ? 'text-[#0ECCEE]' : 'text-[#0099B8]'}`}
        >
          View all competitions
        </button>
      ) : null}
    </section>
  );
}
