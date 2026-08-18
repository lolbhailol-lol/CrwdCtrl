/** Official MindSpark'26 modules — public / ops section order. */
export const MINDSPARK_MODULE_ORDER = [
  'CODIFICA',
  'HACKATHON',
  'AMUZIA',
  'AVIONICA',
  'QUANTUMANIA',
  'ILLUMINATI',
  'LOGICA',
  'DESIGNOVA',
  'POTENTIA',
  'FAN-FRENZY',
  'PRODIGIUM',
  'STRUKTURA',
  'SUBSTANTIA',
  'VOLTUS',
  'ROBOTICA',
  'IDEATHON',
  'GENIUS JUNIOR',
  'GAME OF INNOVATION',
];

const MODULE_SET = new Set(MINDSPARK_MODULE_ORDER);

/** Older / misspelled labels still resolve to the official module. */
const MODULE_ALIASES = {
  QUANTAMANIA: 'QUANTUMANIA',
};

/** Event title → module (normalized keys). */
const EVENT_TO_MODULE = {
  flash: 'AMUZIA',

  'take off': 'AVIONICA',
  takeoff: 'AVIONICA',
  torquest: 'AVIONICA',

  'code junkie': 'CODIFICA',
  webscape: 'CODIFICA',
  'neural nexus': 'CODIFICA',

  hackathon: 'HACKATHON',

  quantquest: 'QUANTUMANIA',
  'quant quest': 'QUANTUMANIA',

  worldwize: 'ILLUMINATI',
  'world wize': 'ILLUMINATI',
  'world-wize': 'ILLUMINATI',

  mathletics: 'LOGICA',

  'fusion id': 'DESIGNOVA',
  fusionid: 'DESIGNOVA',
  'revit rush': 'DESIGNOVA',

  assemblix: 'POTENTIA',

  fandom: 'FAN-FRENZY',
  'beyond suits': 'FAN-FRENZY',

  sherlocked: 'PRODIGIUM',
  googler: 'PRODIGIUM',
  utopia: 'STRUKTURA',

  edifex: 'STRUKTURA',

  'on the etch': 'SUBSTANTIA',

  microapps: 'VOLTUS',
  'circuit fixer': 'VOLTUS',
  'fox hunt': 'VOLTUS',
  foxhunt: 'VOLTUS',

  robowars: 'ROBOTICA',
  'search n destroy': 'ROBOTICA',
  'search and destroy': 'ROBOTICA',
  robosoccer: 'ROBOTICA',
  'robo soccer': 'ROBOTICA',
  roboraces: 'ROBOTICA',
  'robo races': 'ROBOTICA',
  'robo-royale': 'ROBOTICA',
  roboroyale: 'ROBOTICA',
  'robo royale': 'ROBOTICA',
  'virtual robotics': 'ROBOTICA',
  'robo falconry': 'ROBOTICA',
  'robo falconary': 'ROBOTICA',
  'bot wrestling': 'ROBOTICA',

  ideathon: 'IDEATHON',
  'genius junior': 'GENIUS JUNIOR',
  'game of innovation': 'GAME OF INNOVATION',
  'game of innovations': 'GAME OF INNOVATION',
};

function normKey(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupModule(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (MODULE_SET.has(upper)) return upper;
  if (MODULE_ALIASES[upper]) return MODULE_ALIASES[upper];
  const key = normKey(raw);
  if (!key) return '';
  if (EVENT_TO_MODULE[key]) return EVENT_TO_MODULE[key];
  const compact = key.replace(/\s+/g, '');
  return EVENT_TO_MODULE[compact] || '';
}

/**
 * Resolve which MindSpark module a competition belongs to.
 * Prefers event name, then subtitle (rulebook folder), then stored type.
 */
export function resolveMindSparkModule(competition = {}) {
  const fromName = lookupModule(competition.name || competition.title || '');
  if (fromName) return fromName;

  const fromSubtitle = lookupModule(competition.subtitle || '');
  if (fromSubtitle && MODULE_SET.has(fromSubtitle)) return fromSubtitle;

  const fromStored = lookupModule(competition.module || competition.moduleName || '');
  if (fromStored) return fromStored;

  return 'OTHER';
}

export function sortMindSparkModules(modules = []) {
  const rank = new Map(MINDSPARK_MODULE_ORDER.map((name, i) => [name, i]));
  return [...modules].sort((a, b) => {
    const ai = rank.has(a) ? rank.get(a) : 999;
    const bi = rank.has(b) ? rank.get(b) : 999;
    if (ai !== bi) return ai - bi;
    return String(a).localeCompare(String(b));
  });
}

export function sortMindSparkModuleGroups(grouped = {}) {
  const ordered = {};
  for (const key of sortMindSparkModules(Object.keys(grouped))) {
    ordered[key] = grouped[key];
  }
  return ordered;
}

export function formatMindSparkModuleLabel(moduleName = '') {
  const name = String(moduleName || '').trim();
  if (!name || name === 'OTHER') return 'Other';
  return name;
}
