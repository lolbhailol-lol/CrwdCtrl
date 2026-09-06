/**
 * Pull a suggested promo code from event copy / navigate state / URL.
 * Looks for patterns like "coupon CTRL20", "use CTRL20", or bare CTRL20 in price labels.
 */
export function getSuggestedCouponCode(event, extras = {}) {
  if (event?.registration?.allowCoupons === false || event?.raw?.registration?.allowCoupons === false) {
    return '';
  }
  const fromExtra = String(extras.suggestedCoupon || extras.coupon || '').trim().toUpperCase();
  if (fromExtra) return fromExtra;

  try {
    const fromQuery = new URLSearchParams(extras.search || window.location.search).get('coupon');
    if (fromQuery) return String(fromQuery).trim().toUpperCase();
  } catch {
    /* ignore */
  }

  const blob = [
    event?.suggestedCouponCode,
    event?.priceLabel,
    event?.registrationProcess,
    event?.description,
    event?.about,
    event?.generalRules,
    event?.raw?.suggestedCouponCode,
    event?.raw?.priceLabel,
    event?.raw?.registrationProcess,
    event?.raw?.description,
  ]
    .filter(Boolean)
    .join(' ');

  if (!blob) return '';

  const explicit =
    blob.match(/\bcoupon(?:\s+code)?\s*[:-]?\s*([A-Z0-9]{3,16})\b/i)
    || blob.match(/\b(?:use|apply)\s+([A-Z0-9]{3,16})\b/i)
    || blob.match(/\b([A-Z]{3,12}\d{1,4})\b\s*(?:=|for)?\s*\d{1,2}\s*%\s*off/i)
    || blob.match(/\b(CTRL20)\b/i);

  return explicit?.[1] ? String(explicit[1]).trim().toUpperCase() : '';
}

export function getSuggestedCouponLabel(code) {
  if (!code) return '';
  if (/^CTRL20$/i.test(code)) return '20% OFF';
  return 'Promo';
}
