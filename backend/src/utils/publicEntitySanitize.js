/**
 * Strip internal / admin-only fields from entities before public API responses.
 * Booking UX fields (paymentQR, UPI, formSchema, fees) are intentionally kept.
 * WhatsApp groupLink is only exposed after confirmed registration via notify/booking paths.
 */

function clonePlain(doc) {
  if (doc == null) return doc;
  if (typeof doc.toObject === 'function') return doc.toObject();
  return { ...doc };
}

function stripRegistrationSecrets(registration) {
  if (!registration || typeof registration !== 'object') return registration;
  const {
    organizerEmail: _oe,
    googleSheetsUrl: _gs,
    confirmationEmail: _ce,
    ...rest
  } = registration;
  return rest;
}

/**
 * Always remove from public trek / sports / fest / competition payloads.
 * @param {object} entity
 * @param {{ stripGroupLink?: boolean }} [opts]
 */
function sanitizePublicEntity(entity, opts = {}) {
  const { stripGroupLink = true } = opts;
  if (!entity || typeof entity !== 'object') return entity;

  const copy = clonePlain(entity);
  delete copy.scannerAccess;
  delete copy.createdBy;

  if (stripGroupLink) {
    delete copy.groupLink;
  }

  if (copy.registration && typeof copy.registration === 'object') {
    copy.registration = stripRegistrationSecrets(copy.registration);
  }

  // Nested community / run club refs may carry groupLink
  if (stripGroupLink && copy.communityId && typeof copy.communityId === 'object') {
    const { groupLink: _g, ...communityRest } = copy.communityId;
    copy.communityId = communityRest;
  }
  if (stripGroupLink && copy.runClubId && typeof copy.runClubId === 'object') {
    const { groupLink: _g, ...clubRest } = copy.runClubId;
    copy.runClubId = clubRest;
  }
  if (stripGroupLink && copy.runClub && typeof copy.runClub === 'object') {
    const { groupLink: _g, ...clubRest } = copy.runClub;
    copy.runClub = clubRest;
  }

  return copy;
}

function sanitizePublicTrek(trek, opts = {}) {
  return sanitizePublicEntity(trek, { stripGroupLink: true, ...opts });
}

function sanitizePublicSportsEvent(event, opts = {}) {
  return sanitizePublicEntity(event, { stripGroupLink: true, ...opts });
}

function sanitizePublicRunClub(club) {
  if (!club || typeof club !== 'object') return club;
  const copy = clonePlain(club);
  delete copy.groupLink;
  delete copy.createdBy;
  delete copy.scannerAccess;
  return copy;
}

function sanitizePublicCommunity(community) {
  if (!community || typeof community !== 'object') return community;
  const copy = clonePlain(community);
  delete copy.groupLink;
  delete copy.createdBy;
  return copy;
}

/** Fest detail / list item — drop scanner, sheets, organizer emails */
function sanitizePublicFest(fest) {
  if (!fest || typeof fest !== 'object') return fest;
  const copy = clonePlain(fest);
  delete copy.scannerAccess;
  delete copy.createdBy;

  if (copy.registration && typeof copy.registration === 'object') {
    copy.registration = stripRegistrationSecrets(copy.registration);
  }

  if (copy.organizer && typeof copy.organizer === 'object') {
    const { email: _email, ...orgRest } = copy.organizer;
    copy.organizer = orgRest;
  }

  if (Array.isArray(copy.competitions)) {
    copy.competitions = copy.competitions.map(sanitizePublicCompetition);
  }

  return copy;
}

function sanitizePublicCompetition(competition) {
  if (!competition || typeof competition !== 'object') return competition;
  const copy = clonePlain(competition);
  delete copy.googleSheetsUrl;
  delete copy.confirmationEmail;
  delete copy.scannerAccess;
  delete copy.createdBy;

  if (copy.registration && typeof copy.registration === 'object') {
    copy.registration = stripRegistrationSecrets(copy.registration);
  }

  // Nested fest on competition public fetch
  if (copy.fest && typeof copy.fest === 'object') {
    copy.fest = sanitizePublicFest(copy.fest);
  }

  return copy;
}

function sanitizePublicEventShow(show) {
  if (!show || typeof show !== 'object') return show;
  const copy = clonePlain(show);
  delete copy.googleSheetsUrl;
  delete copy.organizerEmail;
  delete copy.confirmationEmail;
  delete copy.scannerAccess;
  delete copy.createdBy;
  if (copy.registration && typeof copy.registration === 'object') {
    copy.registration = stripRegistrationSecrets(copy.registration);
  }
  return copy;
}

function sanitizePublicPlatformEvent(event) {
  if (!event || typeof event !== 'object') return event;
  const copy = clonePlain(event);
  delete copy.createdBy;
  delete copy.scannerAccess;
  return copy;
}

module.exports = {
  sanitizePublicEntity,
  sanitizePublicTrek,
  sanitizePublicSportsEvent,
  sanitizePublicRunClub,
  sanitizePublicCommunity,
  sanitizePublicFest,
  sanitizePublicCompetition,
  sanitizePublicEventShow,
  sanitizePublicPlatformEvent,
  stripRegistrationSecrets,
};
