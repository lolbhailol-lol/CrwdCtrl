/** Map dropdown option labels → coupon codes on run form fields. */

export function optionCouponMap(field) {
  const raw = field?.optionCoupons;
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw);
  if (typeof raw === 'object') return raw;
  return {};
}

export function selectOptionLabels(field) {
  return (Array.isArray(field?.options) ? field.options : [])
    .map((o) => String(o || '').trim())
    .filter(Boolean);
}

export function hasAutoCouponOptions(field) {
  if (field?.type !== 'select') return false;
  return Object.values(optionCouponMap(field)).some((c) => String(c || '').trim());
}

export function couponCodeForSelectValue(field, value) {
  const code = optionCouponMap(field)[value];
  return String(code || '').trim().toUpperCase();
}

/** First matching coupon from page-1 select answers. */
export function resolveFormAutoCouponCode(schema, extraFields = {}) {
  for (const field of Array.isArray(schema) ? schema : []) {
    if (!hasAutoCouponOptions(field)) continue;
    const val = extraFields[field.fieldName];
    const code = couponCodeForSelectValue(field, val);
    if (code) return code;
  }
  return '';
}

export function firstPageCouponFields(schema) {
  return (Array.isArray(schema) ? schema : []).filter(hasAutoCouponOptions);
}
