import React, { useEffect, useState } from 'react';
import { publicFetchJSONRetry as fetchJSON } from '../services/api/client';
import SimilarCompetitionsSection from './SimilarCompetitionsSection';

/**
 * Post-registration upsell: similar competitions → open detail (then register there).
 * Fetches related comps from the public competition endpoint when needed.
 */
export default function AlsoRegisterForSection({
  competition,
  fest = null,
  relatedFromApi: relatedProp,
  isDark = false,
  className = '',
}) {
  const competitionId = competition?._id || competition?.id;
  const [related, setRelated] = useState(() =>
    Array.isArray(relatedProp) ? relatedProp : [],
  );

  useEffect(() => {
    if (Array.isArray(relatedProp) && relatedProp.length > 0) {
      setRelated(relatedProp);
      return undefined;
    }
    if (!competitionId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetchJSON(`/fests/competitions/${competitionId}/public`, {
          cacheBust: false,
        });
        if (cancelled) return;
        const list = response?.data?.relatedCompetitions;
        if (Array.isArray(list) && list.length) setRelated(list);
      } catch {
        /* keep empty — section hides itself */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [competitionId, relatedProp]);

  if (!competition || (!related.length && !competitionId)) return null;

  return (
    <SimilarCompetitionsSection
      competition={competition}
      relatedFromApi={related}
      festOverride={fest || competition?.fest || null}
      isDark={isDark}
      heading="Also register for…"
      subtitle="Similar competitions you might like"
      analyticsSource="also-register-success"
      className={className}
    />
  );
}
