function normalizedEmail(member) {
  return String(member?.email || '').trim().toLowerCase();
}

function normalizedPhone(member) {
  return String(member?.phone || member?.mobile || '').replace(/\D/g, '');
}

function isSameMember(left, right) {
  const leftEmail = normalizedEmail(left);
  const rightEmail = normalizedEmail(right);
  if (leftEmail && rightEmail) return leftEmail === rightEmail;

  const leftPhone = normalizedPhone(left);
  const rightPhone = normalizedPhone(right);
  if (leftPhone.length >= 7 && rightPhone.length >= 7) return leftPhone === rightPhone;

  const leftName = String(left?.name || '').trim().toLowerCase();
  const rightName = String(right?.name || '').trim().toLowerCase();
  return Boolean(leftName && rightName && leftName === rightName);
}

/**
 * User booking pages submit additions only; organizer editors submit the full roster.
 * Preserve existing teammates for additions and make repeated submissions idempotent.
 */
function mergeUpdatedTeamMembers({ existingMembers = [], lead, submittedMembers = [] }) {
  const existing = existingMembers.filter((member) => member && typeof member === 'object');
  const submitted = submittedMembers.filter((member) => member && typeof member === 'object');
  const preservedLead = existing[0] || lead || {};

  if (submitted[0] && isSameMember(submitted[0], preservedLead)) {
    return [preservedLead, ...submitted.slice(1)];
  }

  const merged = existing.length > 0 ? [...existing] : [preservedLead];
  for (const member of submitted) {
    if (!merged.some((current) => isSameMember(current, member))) {
      merged.push(member);
    }
  }
  return merged;
}

module.exports = {
  isSameMember,
  mergeUpdatedTeamMembers,
};
