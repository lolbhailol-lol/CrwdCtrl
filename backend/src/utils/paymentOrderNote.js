/** Cashfree order_note max is 200 characters. */
const ORDER_NOTE_MAX = 200;

function sanitizeOrderNote(value, fallback = 'registration') {
  const cleaned = String(value || '')
    .replace(/[^\w\s.&+\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ORDER_NOTE_MAX);
  return cleaned || fallback;
}

/**
 * Bank / Cashfree dashboard label for a paid order.
 * Competitions use the listing name (plus category when selected), not a generic "competition registration".
 */
function buildPaymentOrderNote(pricing = {}) {
  const type = String(pricing.entityType || '').trim();
  const notes = pricing.notes || {};
  const fallback = type ? `${type} registration` : 'registration';
  const festName = String(notes.festName || '').trim();
  const isMindSpark = /mindspark/i.test(festName) || String(notes.festId || '') === '6a7f1010ed26d983b34e55c2';

  if (type === 'competition') {
    const name = String(notes.competitionName || '').trim();
    const tier = String(notes.tierName || '').trim();
    if (isMindSpark && name && tier) return sanitizeOrderNote(`MindSpark - ${name} - ${tier}`, fallback);
    if (isMindSpark && name) return sanitizeOrderNote(`MindSpark - ${name}`, fallback);
    if (name && tier) return sanitizeOrderNote(`${name} - ${tier}`, fallback);
    if (name) return sanitizeOrderNote(`${name} registration`, fallback);
    return fallback;
  }

  if (type === 'fest') {
    const name = festName;
    if (name) return sanitizeOrderNote(`${name} registration`, fallback);
    return fallback;
  }

  if (type === 'event_show') {
    const name = String(notes.eventShowName || '').trim();
    if (name) return sanitizeOrderNote(`${name} registration`, fallback);
    return fallback;
  }

  return fallback;
}

module.exports = {
  buildPaymentOrderNote,
  sanitizeOrderNote,
};
