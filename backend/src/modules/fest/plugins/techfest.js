const TECHFEST_SLUG = 'techfest-iit-bombay-2026';

function isTechfestFest(festOrId) {
  if (!festOrId) return false;
  if (typeof festOrId === 'string' || typeof festOrId === 'object' && festOrId._bsontype === 'ObjectId') {
    // id-only callers can't resolve Techfest without DB — slug/name checks below need a fest doc
  }
  const fest = typeof festOrId === 'object' ? festOrId : null;
  if (!fest) return false;
  const slug = String(fest.slug || '').trim().toLowerCase();
  if (slug === TECHFEST_SLUG || slug.includes('techfest')) return true;
  const name = String(fest.festName || fest.name || '').toLowerCase();
  const college = String(fest.collegeName || '').toLowerCase();
  if (name.includes('techfest') && (name.includes('bombay') || name.includes('iit') || college.includes('bombay'))) {
    return true;
  }
  return false;
}

/**
 * Techfest IIT Bombay — free comps, no WhatsApp group in confirmation email.
 */
const techfestPlugin = {
  id: 'techfest',
  autoConfirmOnRegister: true,
  forcePersonFields: true,
  useCashfreeSettlement: false,
  skipReviewQueue: true,
  omitWhatsAppInEmail: true,
};

module.exports = {
  TECHFEST_SLUG,
  isTechfestFest,
  techfestPlugin,
};
