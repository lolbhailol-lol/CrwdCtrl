import { transformFestPublicData } from './festPublicTransform';

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

/** Minimal shape so detail pages render immediately without skeleton screens */
export function createFestDetailStub(festId) {
  return {
    id: festId,
    title: '',
    subtitle: '',
    collegeName: '',
    description: '',
    overview: '',
    dateTime: '',
    venue: '',
    heroImage: '',
    image: '',
    galleryImages: [],
    artists: [],
    contacts: [],
    competitions: {},
    registration: { mode: 'NOT_STARTED' },
    ticketPrice: 'Free',
  };
}

export function createCompetitionDetailStub(competitionId) {
  return {
    id: competitionId,
    title: '',
    subtitle: '',
    date: '',
    time: '',
    venue: 'TBD',
    entryFee: '—',
    feeAmount: 0,
    feeLabel: '—',
    feeIsFree: false,
    feeKnown: false,
    prize: '',
    image: '',
    contact: { phone: '', instagram: '', email: '' },
    description: '',
    commonRules: [],
    commonRulesMessage: '',
    registrationType: 'fest',
    registration: { status: 'not_started' },
    rounds: { description: '', list: [], roundsList: [] },
  };
}

/** Cache + navigation state for instant fest detail paint */
export function buildFestDetailNavState(fest) {
  const eventData = transformFestPublicData(fest);
  if (!eventData) return null;
  saveFestDetailCache(eventData.id, eventData);
  return eventData;
}
