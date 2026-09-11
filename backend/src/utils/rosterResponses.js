/**
 * MindSpark roster registrations store contact details on team_members[0].
 * Mirror lead identity to top-level aliases so receipts, invoices, and legacy form keys resolve.
 */

function normalizeLeadIdentityFromRoster(responses = {}) {
  if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
    return responses || {};
  }

  const out = { ...responses };
  const members = Array.isArray(out.team_members) ? out.team_members : [];
  const lead = members[0] && typeof members[0] === 'object' ? members[0] : null;
  if (!lead) return out;

  const name = String(lead.name || '').trim();
  const email = String(lead.email || '').trim();
  const phone = String(lead.phone || lead.mobile || '').trim();
  const college = String(lead.college || lead.college_name || '').trim();

  if (name) {
    if (!out.full_name) out.full_name = name;
    if (!out.name) out.name = name;
  }
  if (email && !out.email) out.email = email;
  if (phone) {
    if (!out.phone) out.phone = phone;
    if (!out.mobile) out.mobile = phone;
    if (!out.contact_no) out.contact_no = phone;
  }
  if (college) {
    if (!out.college) out.college = college;
    if (!out.college_name) out.college_name = college;
  }

  return out;
}

module.exports = {
  normalizeLeadIdentityFromRoster,
};
