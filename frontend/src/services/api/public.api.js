/**
 * Shared public resource fetches for community, run club, and related detail pages.
 */
import { publicFetchJSONRetry } from './client.js';

async function fetchPublicJSON(path, { signal } = {}) {
  const { data } = await publicFetchJSONRetry(path, {
    signal,
    cacheBust: true,
  });
  return data;
}

export const fetchTrekCommunity = (id, signal) =>
  fetchPublicJSON(`/trek-communities/${id}`, { signal });

export const fetchTreksByCommunity = (communityId, signal) =>
  fetchPublicJSON(`/treks?communityId=${communityId}`, { signal });

export const fetchRunClub = (id, signal) =>
  fetchPublicJSON(`/run-clubs/${id}`, { signal });

export const fetchSportsByRunClub = (clubId, signal) =>
  fetchPublicJSON(`/sports?runClubId=${clubId}`, { signal });
