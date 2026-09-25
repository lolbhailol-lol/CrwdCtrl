const VALID_GATEWAYS = new Set(['cashfree', 'razorpay']);

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

function resolveCheckoutGateway({ entityType = '', listingHub = '' } = {}) {
  if (listingHub === 'events' || entityType === 'event_show') {
    return resolveDeluluPaymentGateway();
  }
  if (['fest', 'competition', 'competition_bundle'].includes(entityType)) {
    return resolveFestPaymentGateway();
  }
  return 'cashfree';
}

module.exports = {
  normalizePaymentGateway,
  resolveFestPaymentGateway,
  resolveDeluluPaymentGateway,
  resolveCheckoutGateway,
};
