const KSHITIJ_SLUGS = new Set([
  'kshitij-pune-multicity-event-2026',
  'kshitij-pune-regionals-2026',
]);

function isKshitijFest(fest) {
  if (!fest || typeof fest !== 'object') return false;
  const slug = String(fest.slug || '').trim().toLowerCase();
  const name = String(fest.festName || fest.name || '').trim().toLowerCase();
  return KSHITIJ_SLUGS.has(slug)
    || name.includes('kshitij pune multicity')
    || name.includes('kshitij pune regionals');
}

const kshitijPlugin = {
  id: 'kshitij',
  autoConfirmOnRegister: false,
  manualApprovalRequired: true,
  forcePersonFields: false,
  useCashfreeSettlement: false,
  skipReviewQueue: false,
  omitWhatsAppInEmail: false,
};

module.exports = { isKshitijFest, kshitijPlugin };
