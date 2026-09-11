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

/** Extra selects shown on booking step 1 (chips), plus coupon-linked dropdowns. */
export function isBookingPage1Field(field) {
  if (!field) return false;
  if (hasAutoCouponOptions(field)) return true;
  return Number(field.bookingStep) === 1;
}

export function bookingPage1Fields(schema) {
  return (Array.isArray(schema) ? schema : []).filter((field) => (
    field?.label?.trim() && field?.fieldName?.trim() && isBookingPage1Field(field)
  ));
}

/** Custom questions that each get their own wizard page (bookingStep 3+). */
export function isStandaloneQuestionField(field) {
  return Number(field?.bookingStep) >= 3
    && Boolean(String(field?.label || '').trim())
    && Boolean(String(field?.fieldName || '').trim());
}

export function standaloneQuestionFields(schema) {
  return (Array.isArray(schema) ? schema : [])
    .filter(isStandaloneQuestionField)
    .sort((a, b) => Number(a.bookingStep) - Number(b.bookingStep));
}

export function shortBookingStepLabel(field) {
  const label = String(field?.label || '').trim();
  if (/fuel|mokaroma|drink|coffee|latte|mocha/i.test(label)) return 'Café';
  if (/rate yourself|player|skill|badminton/i.test(label)) return 'Skill';
  const short = label.split(/[?—]/)[0].trim();
  return (short || 'Question').slice(0, 16);
}

export function buildBookingStepLabels(isFree, extraFields = []) {
  const extras = extraFields.map(shortBookingStepLabel);
  if (isFree) return ['Party size', ...extras, 'Confirm'];
  return ['Party size', ...extras, 'Your Details', 'Confirm'];
}
