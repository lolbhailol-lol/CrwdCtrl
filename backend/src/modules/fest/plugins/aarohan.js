const AAROHAN_FEST_ID = '6a6f9708884bbe0ca158dba8';
const AAROHAN_SLUG = 'aarohan-2027';

function isAarohanFest(festOrId) {
  if (!festOrId) return false;
  const id = typeof festOrId === 'object' ? (festOrId._id || festOrId.id || festOrId) : festOrId;
  if (String(id || '') === AAROHAN_FEST_ID) return true;
  if (typeof festOrId !== 'object') return false;
  return String(festOrId.slug || '').trim().toLowerCase() === AAROHAN_SLUG;
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
  isAarohanFest,
  aarohanPlugin,
};
