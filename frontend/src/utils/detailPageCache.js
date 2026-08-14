import { transformFestPublicData } from './festPublicTransform';
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

/** Cache + navigation state for instant fest detail paint */
export function buildFestDetailNavState(fest) {
  const eventData = transformFestPublicData(fest);
  if (!eventData) return null;
  saveFestDetailCache(eventData.id, eventData);
  return eventData;
}
