/**
 * Shared transforms for public fest/competition API data.
 * Keeps view-details, competition-list, and admin-driven fields in sync.
 */

export function mapFestRegistration(registration = {}) {
  const externalLink = registration.externalLink || '';
  return {
    mode: registration.mode || 'NOT_STARTED',
    externalLink,
    paymentQR: registration.paymentQR || '',
    paymentQRMessage: registration.paymentQRMessage || '',
    googleSheetsUrl: registration.googleSheetsUrl || '',
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
  const fromAmount = parseCompetitionFeeAmount(comp.feeAmount);
  const fromLabel = parseCompetitionFeeAmount(
    comp.registrationFee ?? comp.entryFee ?? comp.fee,
  );

  let amount = null;
  if (fromAmount != null && fromAmount > 0) amount = fromAmount;
  else if (fromLabel != null) amount = fromLabel;
  else if (fromAmount === 0) amount = 0;

  if (amount == null) {
    return { amount: null, label: '—', isFree: false, known: false };
  }
  if (amount === 0) {
    return { amount: 0, label: 'Free', isFree: true, known: true };
  }
  return {
    amount,
    label: `₹${amount.toLocaleString('en-IN')}`,
    isFree: false,
    known: true,
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
    registrationFee: fee.known ? fee.label : (comp.registrationFee || 'Free'),
    feeAmount: fee.amount ?? 0,
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

  const grouped = {};
  competitions.forEach((comp) => {
    const category = comp.competitionType?.toUpperCase() || 'OTHER';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(transformCompetitionItem(comp, festData));
  });
  return grouped;
}

export function transformFestPublicData(festData) {
  if (!festData || !(festData._id || festData.id)) return null;

  const registration = mapFestRegistration(festData.registration);
  const externalLink = registration.externalLink || festData.registrationLink || '';

  return {
    id: festData._id || festData.id,
    title: festData.festName || 'Untitled Event',
    subtitle: festData.subtitle || festData.collegeName || 'Unknown College',
    displaySubtitle: festData.subtitle || '',
    collegeName: festData.collegeName || 'Unknown College',
    festival_name: festData.festName || 'Untitled Event',
    organizing_body: festData.collegeName || 'Unknown College',
    type: festData.festType || 'cultural',
    category: festData.festType || 'cultural',
    description: festData.description || 'No description available',
    overview: festData.description || 'No description available',
    dateTime: festData.festDate || 'Date TBA',
    date: festData.festDate || 'Date TBA',
    venue: festData.venue || 'Venue TBA',
    location: festData.venue || 'Venue TBA',
    image: festData.coverImage || '/placeholder-image.jpg',
    heroImage: festData.coverImage || '/placeholder-image.jpg',
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
