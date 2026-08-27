/** Shared session cache for public fest lists — avoids double-fetch flash across fest pages. */

export const FESTS_CACHE_KEY = 'crwdctrl_fests_page_v2';

function isFestList(value) {
  return Array.isArray(value) && value.length > 0;
}

export function readFestsCache() {
  try {
    const raw = sessionStorage.getItem(FESTS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isFestList(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeFestsCache(list) {
  try {
    // Never persist an empty list — a failed fetch used to poison the next visit
    // into the "No fests available yet" empty state without retrying.
    if (!isFestList(list)) return;
    sessionStorage.setItem(FESTS_CACHE_KEY, JSON.stringify(list));
  } catch {
    /* storage full / unavailable */
  }
}

export function readFestsCacheByType(festType) {
  const all = readFestsCache();
  if (!all?.length || !festType) return null;
  const filtered = all.filter(
    (fest) => fest.festType === festType && fest.status !== 'lastyearhit',
  );
  return filtered.length ? filtered : null;
}
