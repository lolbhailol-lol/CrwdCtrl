/**
 * Shared Campus Hunt profile-entries cache (sidebar + enter page).
 */
import { fetchCampusHuntProfileEntries } from '../services/campusHunt.api';
import { isCampusHuntEnabled } from '../config';

let cache = null;
let inflight = null;

export function peekCampusHuntProfileCache() {
  return cache;
}

export function clearCampusHuntProfileCache() {
  cache = null;
  inflight = null;
}

export function writeCampusHuntProfileCache(next) {
  cache = next;
  return cache;
}

/**
 * @param {string} cacheKey — `guest` or `u:<identity>`
 * @returns {Promise<{ key: string, showLogin: boolean, showLeaderboard: boolean, myTeams: any[], login: any[] }>}
 */
export async function loadCampusHuntProfileEntries(cacheKey = 'guest') {
  if (!isCampusHuntEnabled()) {
    const empty = {
      key: cacheKey,
      showLogin: false,
      showLeaderboard: false,
      myTeams: [],
      login: [],
    };
    cache = empty;
    return empty;
  }

  if (cache?.key === cacheKey && cache.resolved) {
    return cache;
  }

  if (inflight?.key === cacheKey) {
    return inflight.promise;
  }

  const promise = (async () => {
    const res = await fetchCampusHuntProfileEntries();
    const next = {
      key: cacheKey,
      resolved: true,
      showLogin: Boolean(res.data?.showLogin),
      showLeaderboard: Boolean(res.data?.showLeaderboard),
      myTeams: Array.isArray(res.data?.myTeams) ? res.data.myTeams : [],
      login: Array.isArray(res.data?.login) ? res.data.login : [],
    };
    cache = next;
    return next;
  })();

  inflight = { key: cacheKey, promise };
  try {
    return await promise;
  } finally {
    if (inflight?.promise === promise) inflight = null;
  }
}

/** Warm lazy route chunks used from Profile. */
export function warmCampusHuntChunks() {
  if (typeof window === 'undefined') return;
  void import('../pages/CampusHuntEnterPage');
  void import('../pages/CampusHuntLeaderboardPage');
  void import('../pages/CampusHuntPlayPage');
}
