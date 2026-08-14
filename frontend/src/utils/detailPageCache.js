/** Session cache for fest / competition detail pages — instant paint on revisit & back nav */

const FEST_PREFIX = 'crwdctrl_detail_fest:';
const COMP_PREFIX = 'crwdctrl_detail_comp:';
const TTL_MS = 45 * 60 * 1000;

function read(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function write(key, data) {
  if (!data) return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ data, savedAt: Date.now(), expiresAt: Date.now() + TTL_MS }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function isBuiltCompetitionDetail(data) {
  return Boolean(data?.title && data?.rounds && Array.isArray(data.rounds.roundsList));
}

export function saveFestDetailCache(festId, eventData) {
  if (!festId || !eventData?.title) return;
  write(`${FEST_PREFIX}${festId}`, eventData);
}

export function loadFestDetailCache(festId) {
  if (!festId) return null;
  return read(`${FEST_PREFIX}${festId}`);
}

export function saveCompetitionDetailCache(compId, data) {
  if (!compId || !data) return;
  write(`${COMP_PREFIX}${compId}`, data);
}

export function loadCompetitionDetailCache(compId) {
  if (!compId) return null;
  return read(`${COMP_PREFIX}${compId}`);
}
