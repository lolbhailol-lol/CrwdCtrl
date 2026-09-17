/**
 * MindSpark roster registrations store contact details on team_members[0].
 * Mirror lead identity to top-level aliases so receipts, invoices, and legacy form keys resolve.
 *
 * Bundle checkouts historically saved team_members as plain name strings — normalize those
 * to { name } objects so booking details / add-member flows can render them.
 */

function normalizeTeamMemberEntry(raw, index = 0) {
  if (typeof raw === 'string') {
    const name = String(raw || '').trim();
    return name ? { name } : null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = { ...raw };
  const name = String(out.name || out.full_name || out.fullName || '').trim();
  if (name) out.name = name;
  if (!out.name && !out.email && !out.phone && !out.mobile && !out.college) {
    return null;
  }
  if (!out.name) out.name = `Person ${index + 1}`;
  return out;
}

function normalizeTeamMembersList(rawMembers) {
  if (!Array.isArray(rawMembers)) return [];
  return rawMembers
    .map((member, index) => normalizeTeamMemberEntry(member, index))
    .filter(Boolean);
}

function normalizeLeadIdentityFromRoster(responses = {}) {
  if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
    return responses || {};
  }

  const out = { ...responses };
  const members = normalizeTeamMembersList(out.team_members);
  if (members.length) {
    out.team_members = members;
    if (!out.team_size || Number(out.team_size) < members.length) {
      out.team_size = members.length;
    }
  }

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
  normalizeTeamMemberEntry,
  normalizeTeamMembersList,
  normalizeLeadIdentityFromRoster,
};
