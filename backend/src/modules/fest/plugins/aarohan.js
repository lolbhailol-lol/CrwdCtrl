const AAROHAN_FEST_ID = '6a6f9708884bbe0ca158dba8';
const AAROHAN_SLUG = 'aarohan-2027';
const AAROHAN_MUMBAI_MULTICITY_FEST_ID = '6ac22157ec8160dfd660d0d4';
const AAROHAN_MUMBAI_MULTICITY_SLUG = 'aarohan-multicity-2026';
const AAROHAN_FEST_IDS = new Set([AAROHAN_FEST_ID, AAROHAN_MUMBAI_MULTICITY_FEST_ID]);
const AAROHAN_SLUGS = new Set([AAROHAN_SLUG, AAROHAN_MUMBAI_MULTICITY_SLUG]);

function isAarohanFest(festOrId) {
  if (!festOrId) return false;
  const id = typeof festOrId === 'object' ? (festOrId._id || festOrId.id || festOrId) : festOrId;
  if (AAROHAN_FEST_IDS.has(String(id || ''))) return true;
  if (typeof festOrId !== 'object') return false;
  return AAROHAN_SLUGS.has(String(festOrId.slug || '').trim().toLowerCase());
}

/**
 * AAROHAN 2027 — MindSpark-style roster registration: entries confirm on submit,
 * no organizer approve queue.
 */
const aarohanPlugin = {
  id: 'aarohan',
  autoConfirmOnRegister: true,
  manualApprovalRequired: false,
  forcePersonFields: true,
  useCashfreeSettlement: false,
  skipReviewQueue: true,
  omitWhatsAppInEmail: false,
};

module.exports = {
  AAROHAN_FEST_ID,
  AAROHAN_SLUG,
  AAROHAN_MUMBAI_MULTICITY_FEST_ID,
  isAarohanFest,
  aarohanPlugin,
};
