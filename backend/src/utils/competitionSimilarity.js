const RELATED_COMPETITIONS_LIMIT = 2;

/** Topic buckets for Techfest / MindSpark-style names when module is coarse. */
const TOPIC_PATTERNS = [
  {
    id: 'coding',
    re: /\b(code|coding|hack|programm|webscape|junkie|neural|nexus|zero[- ]?code|conflux|software|algorithm|quantitat)\b/i,
  },
  {
    id: 'robotics',
    re: /\b(robo|robot|drone|uav|swarm|meshmerize|roboreach|war|soccer|race|oll)\b/i,
  },
  {
    id: 'space_3d',
    re: /\b(space|spatial|namma|3d|twin|ar\b|walkthrough|indoor)\b/i,
  },
  {
    id: 'ideate',
    re: /\b(ideat|innovat|challenge|india\s*@|ecocircuit|thetashift|genius|prodigium)\b/i,
  },
  {
    id: 'quiz_logic',
    re: /\b(quiz|probability|math|logic|quantquest|worldwize|sherlock|googler)\b/i,
  },
  {
    id: 'design',
    re: /\b(design|fusion|revit|struktura|edifex|architect)\b/i,
  },
  {
    id: 'electronics',
    re: /\b(circuit|volt|microapp|fox\s*hunt|electronics|potentia|assembl)\b/i,
  },
  {
    id: 'aero',
    re: /\b(avion|take\s*off|torquest|drone|propulsion|cycloprop|pushpak|bvlos)\b/i,
  },
  {
    id: 'chem_struct',
    re: /\b(substantia|etch|chemic|material)\b/i,
  },
  {
    id: 'gaming',
    re: /\b(game|fandom|fan[- ]?frenzy|amuzia|flash)\b/i,
  },
];

function textBlob(comp = {}) {
  return [comp.name, comp.title, comp.module, comp.competitionType, comp.category, comp.subtitle]
    .filter(Boolean)
    .join(' ');
}

function topicsFor(comp) {
  const blob = textBlob(comp);
  const hits = [];
  for (const t of TOPIC_PATTERNS) {
    if (t.re.test(blob)) hits.push(t.id);
  }
  return hits;
}

function nameTokens(comp) {
  return String(comp.name || comp.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !/^(the|and|for|with|from|challenge|competition|grand)$/i.test(t));
}

/**
 * Higher = better recommendation for this competition.
 */
function scoreSimilarCompetition(candidate, seed) {
  if (!candidate || !seed) return 0;
  let score = 0;

  const seedModule = String(seed.module || '').trim().toUpperCase();
  const candModule = String(candidate.module || '').trim().toUpperCase();
  if (seedModule && candModule && seedModule === candModule) score += 120;

  const seedType = String(seed.competitionType || '').trim().toLowerCase();
  const candType = String(candidate.competitionType || '').trim().toLowerCase();
  if (seedType && candType && seedType === candType) score += 50;

  const seedCat = String(seed.category || '').trim().toUpperCase();
  const candCat = String(candidate.category || '').trim().toUpperCase();
  if (seedCat && candCat && seedCat === candCat) score += 25;

  const seedTopics = topicsFor(seed);
  const candTopics = topicsFor(candidate);
  for (const t of seedTopics) {
    if (candTopics.includes(t)) score += 70;
  }

  const seedToks = new Set(nameTokens(seed));
  const candToks = nameTokens(candidate);
  let overlap = 0;
  for (const t of candToks) {
    if (seedToks.has(t)) overlap += 1;
  }
  score += Math.min(overlap, 4) * 18;

  if (candidate.coverImage || candidate.image) score += 8;

  return score;
}

function toSlimRelatedCompetition(comp) {
  return {
    _id: comp._id,
    name: comp.name || '',
    slug: comp.slug || '',
    coverImage: comp.coverImage || '',
    module: comp.module || '',
    competitionType: comp.competitionType || '',
    category: comp.category || '',
    registrationFee: comp.registrationFee || '',
    feeAmount: Number(comp.feeAmount) || 0,
    feeTiers: Array.isArray(comp.feeTiers) ? comp.feeTiers : [],
  };
}

module.exports = {
  RELATED_COMPETITIONS_LIMIT,
  scoreSimilarCompetition,
  toSlimRelatedCompetition,
  topicsFor,
};
