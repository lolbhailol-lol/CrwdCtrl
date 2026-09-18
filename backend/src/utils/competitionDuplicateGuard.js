'use strict';

const Registration = require('../model/registration_model');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function clean(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function validEmail(value) {
  return EMAIL_RE.test(clean(value).toLowerCase());
}

function identityFromDraft(draft = {}) {
  const form = draft.formData && typeof draft.formData === 'object' ? draft.formData : {};
  const phone = phoneDigits(
    form.phone || form.mobile || form.contact_no || form.whatsapp || '',
  );
  const email = clean(form.email || form.Email || '', 180).toLowerCase();
  return {
    phone: phone.length === 10 ? phone : '',
    email: validEmail(email) ? email : '',
  };
}

/**
 * Find an approved competition registration for the same person
 * (user id and/or phone/email in responses).
 */
async function findApprovedCompetitionDuplicate({
  festId,
  competitionId,
  userId,
  phone,
  email,
} = {}) {
  const or = [];
  if (userId) or.push({ user: userId });
  const digits = phoneDigits(phone);
  if (digits.length === 10) {
    or.push({ 'responses.phone': digits });
    or.push({ 'responses.mobile': digits });
    or.push({ 'responses.contact_no': digits });
  }
  const normalizedEmail = clean(email, 180).toLowerCase();
  if (validEmail(normalizedEmail)) {
    or.push({ 'responses.email': normalizedEmail });
  }
  if (!or.length || !festId || !competitionId) return null;
  return Registration.findOne({
    fest: festId,
    competitionId,
    status: 'approved',
    $or: or,
  }).select('_id payment_order_id qrCodeData user').lean();
}

module.exports = {
  clean,
  phoneDigits,
  validEmail,
  identityFromDraft,
  findApprovedCompetitionDuplicate,
};
