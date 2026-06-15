/**
 * Shared public resource fetches for community, run club, and related detail pages.
 */
import { resolveUrl } from './client.js';

async function fetchPublicJSON(path, { signal } = {}) {
  const response = await fetch(resolveUrl(path), {
    method: 'GET',
    credentials: 'omit',
    mode: 'cors',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export const fetchTrekCommunity = (id, signal) =>
  fetchPublicJSON(`/trek-communities/${id}`, { signal });

export const fetchTreksByCommunity = (communityId, signal) =>
  fetchPublicJSON(`/treks?communityId=${communityId}`, { signal });

export const fetchRunClub = (id, signal) =>
  fetchPublicJSON(`/run-clubs/${id}`, { signal });

export const fetchSportsByRunClub = (clubId, signal) =>
  fetchPublicJSON(`/sports?runClubId=${clubId}`, { signal });
