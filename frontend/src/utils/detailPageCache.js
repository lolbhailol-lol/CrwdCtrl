import { transformFestPublicData, festHasCompetitionGroups } from './festPublicTransform';
import { toSlug } from './slugRoutes';

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
  if (!eventData?.title) return;
  const id = festId || eventData.id || eventData._id;
  if (id) write(`${FEST_PREFIX}${id}`, eventData);
  const slug = toSlug(eventData.title || eventData.festName || '');
  if (slug && slug !== String(id)) write(`${FEST_PREFIX}${slug}`, eventData);
}

export function loadFestDetailCache(festId) {
  if (!festId) return null;
  return read(`${FEST_PREFIX}${festId}`);
}

export function saveCompetitionDetailCache(compId, data) {
  if (!data) return;
  const id = compId || data.id || data._id;
  if (id) write(`${COMP_PREFIX}${id}`, data);
  const slug = toSlug(data.title || data.name || '');
  if (slug && slug !== String(id)) write(`${COMP_PREFIX}${slug}`, data);
}

export function loadCompetitionDetailCache(compId) {
  if (!compId) return null;
  return read(`${COMP_PREFIX}${compId}`);
}

function removeKey(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearFestDetailCache(festId) {
  if (!festId) return;
  removeKey(`${FEST_PREFIX}${festId}`);
}

export function clearCompetitionDetailCache(compId) {
  if (!compId) return;
  removeKey(`${COMP_PREFIX}${compId}`);
}

export function clearAllDetailCaches() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith(FEST_PREFIX) || key.startsWith(COMP_PREFIX))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/** Cache + navigation state for instant fest detail paint */
export function buildFestDetailNavState(fest) {
  const eventData = transformFestPublicData(fest);
  if (!eventData) return null;
  const cached =
    loadFestDetailCache(eventData.id)
    || loadFestDetailCache(toSlug(eventData.title || eventData.festName || ''));
  // List cards do not include competitions — never overwrite a complete detail cache.
  if (festHasCompetitionGroups(cached) && !festHasCompetitionGroups(eventData)) {
    return cached;
  }
  if (festHasCompetitionGroups(eventData)) {
    saveFestDetailCache(eventData.id, eventData);
  }
  return eventData;
}
