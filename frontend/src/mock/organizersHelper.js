import organizersData from './organizers.json';

// Curated pools of verified high-quality portrait photos strictly matching gender
export const MALE_PORTRAITS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80', // Smiling man with glasses
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', // Young man black shirt
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80', // Man profile portrait
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80', // Young man curly hair
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80', // Smiling young man
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80', // Professional man in blazer
  'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=200&auto=format&fit=crop&q=80', // Young male coordinator
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80', // Man with beard
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80', // Man in suit
  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&auto=format&fit=crop&q=80', // Young man smiling
];

export const FEMALE_PORTRAITS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80', // Smiling young woman
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', // Woman portrait
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80', // Woman smiling softly
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80', // Young woman portrait
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80', // Woman portrait
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80', // Professional woman smiling
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&auto=format&fit=crop&q=80', // Professional woman dark hair
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80', // Woman smiling denim
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&auto=format&fit=crop&q=80', // Young woman portrait
  'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=200&auto=format&fit=crop&q=80', // South Asian woman
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&auto=format&fit=crop&q=80', // Young woman warm smile
];

// Indian female first name keywords for intelligent gender detection
const FEMALE_NAME_PATTERNS = [
  'neha', 'priya', 'sneha', 'tanvi', 'shweta', 'divya', 'meera', 'ritika',
  'natasha', 'kavita', 'pooja', 'ananya', 'ishika', 'rhea', 'shreya',
  'pavithra', 'aditi', 'preeti', 'priyadarshini', 'aishwarya', 'radhika',
  'shruti', 'sonal', 'anushka', 'deepika', 'swati', 'sakshi', 'simran',
  'pallavi', 'rashmi', 'sunita', 'geeta', 'seema', 'rekha', 'kiran',
];

/**
 * Accurately detects whether a given name is female or male based on common Indian naming conventions.
 */
export function guessGender(name) {
  if (!name || typeof name !== 'string') return 'male';
  const clean = name.trim().toLowerCase().split(/\s+/)[0]; // First name

  if (FEMALE_NAME_PATTERNS.some((fn) => clean === fn || clean.startsWith(fn))) {
    return 'female';
  }

  // Endings like -a, -i, -ya are often feminine in Indian names (e.g. Nikita, Priya, Sneha)
  if (/(a|i|ya|ita|ika|sha)$/i.test(clean) && !['aditya', 'krishna', 'shiva', 'arya'].includes(clean)) {
    return 'female';
  }

  return 'male';
}

/**
 * Returns a gender-accurate portrait image based on name or explicit gender.
 */
export function getGenderMatchedImage(name, explicitGender, index = 0) {
  const gender = explicitGender || guessGender(name);
  const pool = gender === 'female' ? FEMALE_PORTRAITS : MALE_PORTRAITS;
  return pool[Math.abs(index) % pool.length];
}

/**
 * Normalizes an identifier (fest/event ID, slug, or title) to match organizers keys.
 */
function normalizeKey(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Returns organizers for a given fest, event, or category from organizers.json.
 *
 * @param {string|object} entityIdOrObject - Event/fest ID, slug, or object
 * @param {string} [type='fest'] - 'fest' | 'event' | 'trek' | 'sports'
 * @returns {Array} List of organizer objects with { id, name, gender, role, image, phone, email, instagramId }
 */
export function getMockOrganizers(entityIdOrObject, type = 'fest') {
  if (!entityIdOrObject) return organizersData.default;

  // Extract all searchable string tokens from the entity
  const searchTokens = [];
  if (typeof entityIdOrObject === 'string') {
    searchTokens.push(entityIdOrObject);
  } else if (typeof entityIdOrObject === 'object') {
    if (entityIdOrObject.slug) searchTokens.push(entityIdOrObject.slug);
    if (entityIdOrObject.festName) searchTokens.push(entityIdOrObject.festName);
    if (entityIdOrObject.title) searchTokens.push(entityIdOrObject.title);
    if (entityIdOrObject.name) searchTokens.push(entityIdOrObject.name);
    if (entityIdOrObject.collegeName) searchTokens.push(entityIdOrObject.collegeName);
    if (entityIdOrObject.category) searchTokens.push(entityIdOrObject.category);
    if (entityIdOrObject.type) searchTokens.push(entityIdOrObject.type);
    if (entityIdOrObject.id) searchTokens.push(entityIdOrObject.id);
    if (entityIdOrObject._id) searchTokens.push(entityIdOrObject._id);
  }

  const combinedSearch = normalizeKey(searchTokens.join(' '));

  // 1. Check Fests
  for (const [festKey, list] of Object.entries(organizersData.fests || {})) {
    const normFest = normalizeKey(festKey);
    if (combinedSearch.includes(normFest) || normFest.includes(combinedSearch)) {
      return list;
    }
  }

  // Common Fest Aliases
  if (combinedSearch.includes('kuruk') || combinedSearch.includes('ceg') || combinedSearch.includes('annauniv')) {
    return organizersData.fests.kurukshetra;
  }
  if (combinedSearch.includes('mindspark') || combinedSearch.includes('coep')) {
    return organizersData.fests.mindspark;
  }
  if (combinedSearch.includes('startup') || combinedSearch.includes('psf')) {
    return organizersData.fests.punestartupfest || organizersData.fests.mindspark;
  }
  if (combinedSearch.includes('techfest') || combinedSearch.includes('iitb')) {
    return organizersData.fests.techfest;
  }
  if (combinedSearch.includes('moodi') || combinedSearch.includes('moodindigo')) {
    return organizersData.fests.moodindigo;
  }
  if (combinedSearch.includes('kshitij') || combinedSearch.includes('ktj') || combinedSearch.includes('iitkgp')) {
    return organizersData.fests.kshitij;
  }
  if (combinedSearch.includes('aarohan') || combinedSearch.includes('durgapur')) {
    return organizersData.fests.aarohan;
  }
  if (combinedSearch.includes('symbi') || combinedSearch.includes('utsav')) {
    return organizersData.fests['symbi-utsav'];
  }

  // 2. Check Events
  for (const [eventKey, list] of Object.entries(organizersData.events || {})) {
    const normEvent = normalizeKey(eventKey);
    if (combinedSearch.includes(normEvent) || normEvent.includes(combinedSearch)) {
      return list;
    }
  }

  // Common Event Aliases
  if (combinedSearch.includes('comedy') || combinedSearch.includes('standup') || combinedSearch.includes('comic')) {
    return organizersData.events.comedy;
  }
  if (combinedSearch.includes('music') || combinedSearch.includes('concert') || combinedSearch.includes('band') || combinedSearch.includes('live')) {
    return organizersData.events.music;
  }
  if (combinedSearch.includes('hack') || combinedSearch.includes('code') || combinedSearch.includes('tech')) {
    return organizersData.events.hackathon;
  }
  if (combinedSearch.includes('dance')) {
    return organizersData.events.dance;
  }
  if (combinedSearch.includes('trek') || combinedSearch.includes('hike') || combinedSearch.includes('camping')) {
    return organizersData.events.trek;
  }
  if (combinedSearch.includes('run') || combinedSearch.includes('marathon') || combinedSearch.includes('sport')) {
    return organizersData.events.run;
  }

  // 3. Fallback by type hint
  const catHint = normalizeKey(type);
  if (catHint) {
    for (const [eventKey, list] of Object.entries(organizersData.events || {})) {
      if (catHint.includes(normalizeKey(eventKey))) {
        return list;
      }
    }
  }

  // Fallback to default mock organizers
  return organizersData.default;
}

export default organizersData;
