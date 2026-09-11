/**
 * Shared public resource fetches for community, run club, and related detail pages.
 */
import { publicFetchJSONRetry } from './client.js';
import { DETAIL_FETCH_OPTS } from '../../utils/detailPageLoad.js';

async function fetchPublicJSON(path, { signal, retries = DETAIL_FETCH_OPTS.retries } = {}) {
  const { data } = await publicFetchJSONRetry(path, {
    signal,
    cacheBust: DETAIL_FETCH_OPTS.cacheBust,
    retries,
    timeout: DETAIL_FETCH_OPTS.timeout,
  });
  return data;
}

export const fetchTrek = (id, signal, options = {}) =>
  fetchPublicJSON(`/treks/${encodeURIComponent(id)}`, { signal, ...options });

export const fetchTrekCommunity = (id, signal) =>
  fetchPublicJSON(`/trek-communities/${encodeURIComponent(id)}`, { signal });

export const fetchTreksByCommunity = (communityId, signal, { timeframe = 'upcoming' } = {}) =>
  fetchPublicJSON(
    `/treks?communityId=${encodeURIComponent(communityId)}&timeframe=${encodeURIComponent(timeframe)}`,
    { signal },
  );

export const fetchRunClub = (id, signal) =>
  fetchPublicJSON(`/run-clubs/${encodeURIComponent(id)}`, { signal });

export const fetchSportsByRunClub = (clubId, signal, { timeframe = 'upcoming' } = {}) =>
  fetchPublicJSON(
    `/sports?runClubId=${encodeURIComponent(clubId)}&timeframe=${encodeURIComponent(timeframe)}`,
    { signal },
  );
export const fetchSportsEvent = (id, signal) =>
  fetchPublicJSON(`/sports/${encodeURIComponent(id)}`, { signal });
