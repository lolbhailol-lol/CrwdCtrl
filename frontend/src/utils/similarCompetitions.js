import { resolveCompetitionFee } from './festPublicTransform';
import { loadFestDetailCache } from './detailPageCache';
import { resolveTechfestModule } from '../features/fests/techfest/modules';
import { resolveMindSparkModule } from '../features/fests/mindspark/modules';
import { isTechfestFest } from '../features/fests/techfest/isTechfestFest';
import { isMindSparkFest } from '../features/fests/mindspark/isMindSparkFest';

/** Topic buckets — keep in sync with backend competitionSimilarity.js */
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

function scoreSimilar(candidate, seed) {
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

function flattenFestCompetitions(festData) {
  if (!festData) return [];
  const groups = festData.competitions;
  if (!groups) return [];
  if (Array.isArray(groups)) {
    if (groups.length && (groups[0]?.name || groups[0]?.title || groups[0]?._id)) {
      return groups;
    }
    return [];
  }
  return Object.values(groups).flatMap((list) => (Array.isArray(list) ? list : []));
}

function toCardComp(comp, festCtx = null) {
  if (!comp) return null;
  const id = comp._id || comp.id;
  if (!id) return null;
  const fee = resolveCompetitionFee(comp);
  let module = String(comp.module || '').trim();
  if (!module && festCtx) {
    if (isTechfestFest(festCtx, festCtx)) module = resolveTechfestModule(comp) || '';
    else if (isMindSparkFest(festCtx, festCtx)) module = resolveMindSparkModule(comp) || '';
  }
  return {
    _id: id,
    id,
    name: comp.name || comp.title || 'Competition',
    title: comp.name || comp.title || 'Competition',
    slug: comp.slug || '',
    coverImage: comp.coverImage || comp.image || '',
    image: comp.coverImage || comp.image || '',
    module,
    competitionType: comp.competitionType || '',
    category: comp.category || '',
    subtitle: comp.subtitle || '',
    registrationFee: fee.known ? fee.label : (comp.registrationFee || comp.fee || ''),
    feeAmount: fee.amount ?? (Number(comp.feeAmount) || 0),
    feeTiers: fee.tiers || comp.feeTiers || [],
    feeLabel: fee.known ? fee.label : (comp.registrationFee || comp.fee || ''),
  };
}

/**
 * Pick the best 2 similar competitions for this one.
 * Always re-ranks API + fest-cache candidates by topic/module/name (not first-in-list).
 */
export function resolveSimilarCompetitionCards({
  currentCompetition,
  relatedFromApi = [],
  festId,
  limit = 2,
} = {}) {
  const selfId = String(currentCompetition?.id || currentCompetition?._id || '');
  const festCtx =
    currentCompetition?.fest ||
    (festId || currentCompetition?.festId
      ? { _id: festId || currentCompetition?.festId, festName: currentCompetition?.fest?.festName }
      : null);

  const byId = new Map();

  for (const raw of Array.isArray(relatedFromApi) ? relatedFromApi : []) {
    const card = toCardComp(raw, festCtx);
    if (!card || String(card._id) === selfId) continue;
    byId.set(String(card._id), card);
  }

  const festKey =
    festId ||
    currentCompetition?.festId ||
    currentCompetition?.fest?._id ||
    currentCompetition?.fest?.id;
  const festCached = festKey ? loadFestDetailCache(festKey) : null;
  const festForModule = festCached || festCtx;
  for (const raw of flattenFestCompetitions(festCached)) {
    const card = toCardComp(raw, festForModule);
    if (!card || String(card._id) === selfId) continue;
    if (!byId.has(String(card._id))) byId.set(String(card._id), card);
  }

  const candidates = [...byId.values()];
  if (!candidates.length) return [];

  let seedModule = String(currentCompetition?.module || '').trim();
  if (!seedModule && festForModule) {
    if (isTechfestFest(festForModule, festForModule)) {
      seedModule = resolveTechfestModule(currentCompetition) || '';
    } else if (isMindSparkFest(festForModule, festForModule)) {
      seedModule = resolveMindSparkModule(currentCompetition) || '';
    }
  }

  const seed = {
    name: currentCompetition?.title || currentCompetition?.name,
    title: currentCompetition?.title || currentCompetition?.name,
    module: seedModule,
    competitionType: currentCompetition?.competitionType,
    category: currentCompetition?.category,
    subtitle: currentCompetition?.subtitle,
  };

  return candidates
    .map((c) => ({ c, score: scoreSimilar(c, seed) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.c.name).localeCompare(String(b.c.name));
    })
    .slice(0, limit)
    .map(({ c }) => c);
}

export { scoreSimilar, topicsFor };
