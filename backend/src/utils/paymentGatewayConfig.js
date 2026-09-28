const VALID_GATEWAYS = new Set(['cashfree', 'razorpay']);
const AAROHAN_FEST_SLUG = 'aarohan-2027';

function normalizePaymentGateway(value, fallback = 'cashfree') {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_GATEWAYS.has(normalized) ? normalized : fallback;
}

function resolveFestPaymentGateway() {
  return normalizePaymentGateway(process.env.FEST_PAYMENT_GATEWAY);
}

function resolveDeluluPaymentGateway() {
  return normalizePaymentGateway(process.env.DELULU_PAYMENT_GATEWAY);
}

function resolveRunsPaymentGateway() {
  return normalizePaymentGateway(process.env.RUNS_PAYMENT_GATEWAY);
}

function resolveAarohanPaymentGateway({ festId = '', festSlug = '', festName = '' } = {}) {
  const isAarohan =
    String(festSlug || '').trim().toLowerCase() === AAROHAN_FEST_SLUG
    || String(festName || '').toLowerCase().includes('aarohan');
  if (!isAarohan) return null;
  return normalizePaymentGateway(process.env.AAROHAN_PAYMENT_GATEWAY, 'razorpay');
}

function resolveCheckoutGateway({ entityType = '', listingHub = '', festId = '', festSlug = '', festName = '' } = {}) {
  if (listingHub === 'events' || entityType === 'event_show') {
    return resolveDeluluPaymentGateway();
  }
  if (['fest', 'competition', 'competition_bundle'].includes(entityType)) {
    const aarohanGateway = resolveAarohanPaymentGateway({ festId, festSlug, festName });
    if (aarohanGateway) return aarohanGateway;
    return resolveFestPaymentGateway();
  }
  if (entityType === 'sports') {
    return resolveRunsPaymentGateway();
  }
  return 'cashfree';
}

module.exports = {
  normalizePaymentGateway,
  resolveFestPaymentGateway,
  resolveDeluluPaymentGateway,
  resolveRunsPaymentGateway,
  resolveAarohanPaymentGateway,
  resolveCheckoutGateway,
};
