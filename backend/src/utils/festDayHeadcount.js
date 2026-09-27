function responsesToObject(responses) {
  if (!responses) return {};
  if (responses instanceof Map) return Object.fromEntries(responses);
  if (typeof responses.toObject === 'function') return responses.toObject();
  return { ...responses };
}

function normalizedText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function memberIdentity(member) {
  if (typeof member === 'string') {
    const name = normalizedText(member);
    return name ? `name:${name}` : '';
  }
  if (!member || typeof member !== 'object') return '';
  const email = normalizedText(member.email);
  const phone = String(member.phone || member.mobile || '').replace(/\D/g, '').slice(-10);
  const name = normalizedText(member.name || member.full_name || member.fullName);
  const college = normalizedText(member.college || member.college_name);
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  return name ? `name:${name}|college:${college}` : '';
}

function rosterDetails(registration) {
  const responses = responsesToObject(registration?.responses);
  const members = Array.isArray(responses.team_members)
    ? responses.team_members
    : (Array.isArray(responses.members) ? responses.members : []);
  const identities = new Set(members.map(memberIdentity).filter(Boolean));
  const declaredPeople = Math.max(1, Number(responses.team_size) || 0, members.length);
  return {
    bundleId: String(responses.mindspark_bundle_id || '').trim(),
    identities,
    declaredPeople,
    unknownPeople: Math.max(0, declaredPeople - identities.size),
  };
}

function countFestDayAttendees(registrations = []) {
  let standalonePeople = 0;
  const bundles = new Map();
  for (const registration of registrations) {
    const roster = rosterDetails(registration);
    if (!roster.bundleId) {
      standalonePeople += roster.declaredPeople;
      continue;
    }
    const bundle = bundles.get(roster.bundleId) || {
      identities: new Set(),
      maxRosterSize: 0,
      maxUnknownPeople: 0,
    };
    roster.identities.forEach((identity) => bundle.identities.add(identity));
    bundle.maxRosterSize = Math.max(bundle.maxRosterSize, roster.declaredPeople);
    bundle.maxUnknownPeople = Math.max(bundle.maxUnknownPeople, roster.unknownPeople);
    bundles.set(roster.bundleId, bundle);
  }

  const bundlePeople = [...bundles.values()].reduce((sum, bundle) => (
    sum + Math.max(
      bundle.maxRosterSize,
      bundle.identities.size + bundle.maxUnknownPeople,
    )
  ), 0);
  return standalonePeople + bundlePeople;
}

module.exports = { countFestDayAttendees, memberIdentity, rosterDetails };
