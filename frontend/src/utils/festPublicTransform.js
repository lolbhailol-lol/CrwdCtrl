/**
 * Shared transforms for public fest/competition API data.
 * Keeps view-details, competition-list, and admin-driven fields in sync.
 */

import { getFestPlugin } from '../features/fests/plugins';

import {
  sanitizeCompetitionFeeTiers,
  minCompetitionFeeAmount,
  formatCompetitionFeeFromLabel,
} from './competitionFeeTiers';

export function mapFestRegistration(registration = {}) {
  const externalLink = registration.externalLink || '';
  return {
    mode: registration.mode || 'NOT_STARTED',
    externalLink,
    paymentQR: registration.paymentQR || '',
    paymentQRMessage: registration.paymentQRMessage || '',
    googleSheetsUrl: registration.googleSheetsUrl || '',
    overallSheetUrl: registration.overallSheetUrl || '',
    resourceLinks: Array.isArray(registration.resourceLinks) ? registration.resourceLinks : [],
    formInstructions: registration.formInstructions || '',
    organizerEmail: registration.organizerEmail || '',
    whatsappCommunityLink: registration.whatsappCommunityLink || '',
    formType: registration.formType || 'SINGLE_STEP',
    formSchema: registration.formSchema || [],
    steps: registration.steps || [],
  };
}

export function formatTicketPrice(festData = {}) {
  if (festData.ticketPrice) return festData.ticketPrice;
  if (festData.feeAmount > 0) return `₹${festData.feeAmount}`;
  return 'Free';
}

/** Parse "₹2,500", "2500", 2500, "Free" → number or null if unknown */
export function parseCompetitionFeeAmount(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
  const text = String(raw).trim();
  if (!text) return null;
  if (/^free$/i.test(text)) return 0;
  const digits = text.replace(/[^\d.]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

/**
 * Prefer numeric feeAmount when set (>0), else parse registrationFee / entryFee label.
 * Avoids showing Free when registrationFee is "2500" but feeAmount is still 0.
 */
export function resolveCompetitionFee(comp = {}) {
  const tiers = sanitizeCompetitionFeeTiers(comp.feeTiers);
  if (tiers.length) {
    const min = minCompetitionFeeAmount(tiers);
    const allFree = tiers.every((t) => (Number(t.amount) || 0) === 0);
    return {
      amount: min,
      label: formatCompetitionFeeFromLabel(tiers) || (allFree ? 'Free' : `₹${min.toLocaleString('en-IN')}`),
      isFree: allFree,
      known: true,
      tiers,
    };
  }

  const fromAmount = parseCompetitionFeeAmount(comp.feeAmount);
  const fromLabel = parseCompetitionFeeAmount(
    comp.registrationFee ?? comp.entryFee ?? comp.fee,
  );

  let amount = null;
  if (fromAmount != null && fromAmount > 0) amount = fromAmount;
  else if (fromLabel != null) amount = fromLabel;
  else if (fromAmount === 0) amount = 0;

  if (amount == null) {
    return { amount: null, label: '—', isFree: false, known: false, tiers: [] };
  }
  if (amount === 0) {
    return { amount: 0, label: 'Free', isFree: true, known: true, tiers: [] };
  }
  return {
    amount,
    label: `₹${amount.toLocaleString('en-IN')}`,
    isFree: false,
    known: true,
    tiers: [],
  };
}

export function isFestRegistrationDisabled(mode) {
  return mode === 'NOT_STARTED' || mode === 'CLOSED';
}

export function transformCompetitionItem(comp, festData) {
  const festId = festData?._id || festData?.id;
  const fee = resolveCompetitionFee(comp);
  return {
    id: comp._id,
    _id: comp._id,
    name: comp.name,
    title: comp.name,
    subtitle: comp.subtitle || comp.description,
    image: comp.coverImage,
    coverImage: comp.coverImage,
    gallery: comp.gallery || [],
    fee: fee.known ? fee.label : (comp.registrationFee || 'Free'),
    prize: comp.prizePool || 'TBD',
    prizePool: comp.prizePool,
    description: comp.description,
    dateTime: comp.dateTime,
    venue: comp.venue,
    rules: comp.commonRules || [],
    commonRules: comp.commonRules || [],
    commonRulesMessage: comp.commonRulesMessage || '',
    rounds: comp.rounds || [],
    contact: comp.contact,
    competitionType: comp.competitionType,
    category: comp.category,
    module: getFestPlugin(festData).competitionModuleLabel(comp) || '',
    registrationFee: fee.known ? fee.label : (comp.registrationFee || 'Free'),
    feeAmount: fee.amount ?? 0,
    feeTiers: fee.tiers || [],
    registrationLink: comp.registrationLink || '',
    registrationType: comp.registrationType || 'fest',
    registration: comp.registration || { status: 'not_started' },
    legacyRegistration: comp.legacyRegistration || { status: 'NOT_STARTED' },
    fest: festData
      ? {
          _id: festId,
          festName: festData.festName,
          feeAmount: festData.feeAmount || 0,
          platformFeePercent: festData.platformFeePercent ?? 3,
          registration: mapFestRegistration(festData.registration),
        }
      : null,
    festId,
  };
}

export function groupCompetitionsByType(competitions, festData) {
  if (!Array.isArray(competitions) || competitions.length === 0) return {};

  const plugin = getFestPlugin(festData);
  const grouped = {};
  competitions.forEach((comp) => {
    const category = plugin.competitionGroupKey(comp);
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(transformCompetitionItem(comp, festData));
  });
  return plugin.sortCompetitionGroups(grouped);
}

/** True when transformed fest data already has competition cards to paint. */
export function festHasCompetitionGroups(eventData) {
  const comps = eventData?.competitions;
  if (!comps) return false;
  if (Array.isArray(comps)) {
    return comps.some((c) => c && (c.name || c.title || c.id || c._id));
  }
  return Object.values(comps).some(
    (list) => Array.isArray(list) && list.some((c) => c && (c.name || c.title || c.id || c._id)),
  );
}

export function isFestPlaceholderCopy(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  return /^(untitled event|unknown college|no description available|date tba|venue tba|tbd|tba|-)$/i.test(text);
}

export function transformFestPublicData(festData) {
  if (!festData || !(festData._id || festData.id)) return null;

  const registration = mapFestRegistration(festData.registration);
  const externalLink = registration.externalLink || festData.registrationLink || '';
  const cover = festData.coverImage || '';

  return {
    id: festData._id || festData.id,
    title: festData.festName || '',
    subtitle: festData.subtitle || festData.collegeName || '',
    displaySubtitle: festData.subtitle || '',
    collegeName: festData.collegeName || '',
    festival_name: festData.festName || '',
    organizing_body: festData.collegeName || '',
    type: festData.festType || 'cultural',
    category: festData.festType || 'cultural',
    description: festData.description || '',
    overview: festData.description || '',
    dateTime: festData.festDate || '',
    date: festData.festDate || '',
    venue: festData.venue || '',
    location: festData.venue || '',
    image: cover,
    heroImage: cover,
    galleryImages: festData.galleryImages || [],
    ticketPrice: formatTicketPrice(festData),
    feeAmount: festData.feeAmount || 0,
    platformFeePercent: festData.platformFeePercent ?? 3,
    status: festData.status || 'upcoming',
    registrationLink: festData.registrationLink || externalLink,
    registration: { ...registration, externalLink },
    artists: prioritizeFeaturedArtists(festData.artists || []),
    artistsHeading: festData.artistsHeading || "Artists You'll Love",
    contacts: festData.contacts || [],
    sponsors: festData.sponsors || [],
    competitions: groupCompetitionsByType(festData.competitions, festData),
    competitionsHeading: festData.competitionsHeading || 'Competitions',
    theme:
      festData.festType === 'cultural'
        ? 'Cultural Festival'
        : festData.festType === 'technical'
        ? 'Technical Festival'
        : festData.festType === 'sports'
        ? 'Sports Festival'
        : 'Festival',
  };
}

/** Put Kaustubh / Vivek first in the artists carousel when present */
function prioritizeFeaturedArtists(artists = []) {
  if (!Array.isArray(artists) || artists.length < 2) return artists || [];
  const featured = [/kaustubh?/i, /vivek/i];
  const ranked = [...artists];
  ranked.sort((a, b) => {
    const ai = featured.findIndex((re) => re.test(String(a?.name || '')));
    const bi = featured.findIndex((re) => re.test(String(b?.name || '')));
    const aRank = ai === -1 ? featured.length : ai;
    const bRank = bi === -1 ? featured.length : bi;
    return aRank - bRank;
  });
  return ranked;
}

const REGISTRATION_PREFETCH_PREFIX = 'crwdctrl_reg_prefetch:';

export function registrationPrefetchKey(festId, competitionId) {
  return `${REGISTRATION_PREFETCH_PREFIX}${festId}:${competitionId || 'fest'}`;
}

export function saveRegistrationPrefetch(festId, competitionId, prefetch) {
  if (!prefetch || !festId) return;
  try {
    sessionStorage.setItem(
      registrationPrefetchKey(festId, competitionId),
      JSON.stringify({ ...prefetch, savedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadRegistrationPrefetch(festId, competitionId) {
  if (!festId) return null;
  try {
    const raw = sessionStorage.getItem(registrationPrefetchKey(festId, competitionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    delete parsed.savedAt;
    return parsed;
  } catch {
    return null;
  }
}

/** Build instant registration state from competition/fest data already on screen */
export function buildRegistrationPrefetch({ fest, competition } = {}) {
  if (!fest?._id && !fest?.id) return null;

  return {
    fest: {
      _id: fest._id || fest.id,
      festName: fest.festName || fest.title || fest.festival_name || 'Fest',
      collegeName: fest.collegeName || fest.subtitle || fest.organizing_body || '',
      slug: fest.slug || '',
      feeAmount: fest.feeAmount || 0,
      platformFeePercent: fest.platformFeePercent ?? 0,
      registration: fest.registration || { mode: 'INTERNAL_FORM', formSchema: [], formType: 'SINGLE_STEP' },
    },
    competition: competition
      ? {
          _id: competition._id || competition.id,
          id: competition._id || competition.id,
          name: competition.name || competition.title,
          feeAmount: competition.feeAmount ?? 0,
          registrationFee: competition.registrationFee || competition.entryFee || competition.fee,
          feeTiers: sanitizeCompetitionFeeTiers(competition.feeTiers),
          registrationType: competition.registrationType || 'fest',
          registration: competition.registration,
          teamSizeMin: Math.max(1, Number(competition.teamSizeMin) || 1),
          teamSizeMax: Math.max(
            1,
            Number(competition.teamSizeMax) || Number(competition.teamSizeMin) || 1,
          ),
          teamSizeLabel: competition.teamSizeLabel || '',
          slotsAllotted: Math.max(0, Number(competition.slotsAllotted) || 0),
          slotsFilled: Math.max(0, Number(competition.slotsFilled) || 0),
          slotsLeft: (() => {
            const allotted = Math.max(0, Number(competition.slotsAllotted) || 0);
            if (competition.slotsLeft != null && Number.isFinite(Number(competition.slotsLeft))) {
              return Math.max(0, Math.floor(Number(competition.slotsLeft)));
            }
            if (allotted > 0) {
              return Math.max(0, allotted - Math.max(0, Number(competition.slotsFilled) || 0));
            }
            return null;
          })(),
        }
      : null,
  };
}

/** Payload for competitions-view-details navigation state */
export function buildCompetitionNavPayload(competition, festContext) {
  if (!competition) return null;

  return {
    ...competition,
    fest:
      competition.fest ||
      (festContext
        ? {
            _id: festContext.id,
            festName: festContext.festival_name || festContext.title,
            feeAmount: festContext.feeAmount || 0,
            registration: festContext.registration || { mode: 'NOT_STARTED' },
          }
        : null),
  };
}
