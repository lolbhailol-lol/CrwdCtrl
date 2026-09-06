/** Official Techfest IIT Bombay 2026 modules — public section order. */
export const TECHFEST_MODULE_ORDER = [
  'Competitions',
  'Pushpak Grand Challenge 2026',
  'Ideates',
  'Zonals',
];

const MODULE_SET = new Set(TECHFEST_MODULE_ORDER.map((m) => m.toLowerCase()));

const MODULE_ALIASES = {
  competitions: 'Competitions',
  competition: 'Competitions',
  pushpak: 'Pushpak Grand Challenge 2026',
  'pushpak grand challenge': 'Pushpak Grand Challenge 2026',
  'pushpak grand challenge 2026': 'Pushpak Grand Challenge 2026',
  ideates: 'Ideates',
  ideate: 'Ideates',
  zonals: 'Zonals',
  zonal: 'Zonals',
};

/** Event title → module when module field is missing. */
const EVENT_TO_MODULE = {
  qcc: 'Competitions',
  'quantitative code conflux': 'Competitions',
  'the quantitative code conflux': 'Competitions',
  npc: 'Competitions',
  'national probability challenge': 'Competitions',
  'namma space': 'Competitions',
  nammaspace: 'Competitions',
  oll: 'Competitions',
  'oll robotics championship': 'Competitions',
  lqideathon: 'Competitions',
  'logiqids ideathon': 'Competitions',
  'uav-x': 'Pushpak Grand Challenge 2026',
  'uav-x: resilient bvlos swarm challenge': 'Pushpak Grand Challenge 2026',
  cycloprop: 'Pushpak Grand Challenge 2026',
  'cycloprop: advanced uav propulsion challenge': 'Pushpak Grand Challenge 2026',
  secofdrones: 'Pushpak Grand Challenge 2026',
  'security of drones': 'Pushpak Grand Challenge 2026',
  india71100: 'Ideates',
  'the india @71/100 challenge': 'Ideates',
  ecocircuit: 'Ideates',
  thetashift: 'Zonals',
  roboreach: 'Zonals',
  meshmerize: 'Zonals',
  'zero-code': 'Zonals',
  zerocode: 'Zonals',
  innovatex: 'Zonals',
};

function normalizeKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function lookupTechfestModule(raw = '') {
  const key = normalizeKey(raw);
  if (!key) return '';
  if (MODULE_ALIASES[key]) return MODULE_ALIASES[key];
  for (const name of TECHFEST_MODULE_ORDER) {
    if (normalizeKey(name) === key) return name;
  }
  if (MODULE_SET.has(key)) {
    return TECHFEST_MODULE_ORDER.find((m) => normalizeKey(m) === key) || '';
  }
  return '';
}

/**
 * Resolve which Techfest module a competition belongs to.
 * Prefers stored module, then event name / subtitle.
 */
export function resolveTechfestModule(competition = {}) {
  const fromStored = lookupTechfestModule(
    competition.module || competition.moduleName || competition.subtitle || ''
  );
  if (fromStored) return fromStored;

  const nameKey = normalizeKey(competition.name || competition.title || '');
  if (EVENT_TO_MODULE[nameKey]) return EVENT_TO_MODULE[nameKey];

  for (const [key, mod] of Object.entries(EVENT_TO_MODULE)) {
    if (nameKey.includes(key) || key.includes(nameKey)) return mod;
  }

  return 'Competitions';
}

export function sortTechfestModules(modules = []) {
  return [...modules].sort((a, b) => {
    const ia = TECHFEST_MODULE_ORDER.indexOf(a);
    const ib = TECHFEST_MODULE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function sortTechfestModuleGroups(grouped = {}) {
  const ordered = {};
  for (const key of sortTechfestModules(Object.keys(grouped))) {
    ordered[key] = grouped[key];
  }
  return ordered;
}

export function formatTechfestModuleLabel(moduleName = '') {
  const name = String(moduleName || '').trim();
  if (!name || name === 'OTHER') return 'Other';
  return lookupTechfestModule(name) || name;
}
