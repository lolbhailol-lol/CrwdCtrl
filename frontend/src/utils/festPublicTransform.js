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

export function isFestRegistrationDisabled(mode) {
  return mode === 'NOT_STARTED' || mode === 'CLOSED';
}

export function transformCompetitionItem(comp, festData) {
  const festId = festData?._id || festData?.id;
  return {
    id: comp._id,
    _id: comp._id,
    name: comp.name,
    title: comp.name,
    subtitle: comp.subtitle || comp.description,
    image: comp.coverImage,
    coverImage: comp.coverImage,
    gallery: comp.gallery || [],
    fee: comp.registrationFee || 'Free',
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
    registrationFee: comp.registrationFee || 'Free',
    feeAmount: comp.feeAmount || 0,
    registrationLink: comp.registrationLink || '',
    registrationType: comp.registrationType || 'fest',
    registration: comp.registration || { status: 'not_started' },
    legacyRegistration: comp.legacyRegistration || { status: 'NOT_STARTED' },
    fest: festData
      ? {
          _id: festId,
          festName: festData.festName,
          feeAmount: festData.feeAmount || 0,
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
    status: festData.status || 'upcoming',
    registrationLink: festData.registrationLink || externalLink,
    registration: { ...registration, externalLink },
    artists: festData.artists || [],
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
