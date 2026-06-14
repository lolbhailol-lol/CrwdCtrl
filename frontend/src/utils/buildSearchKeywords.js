/**
 * Build search chip keywords from in-memory catalog (mirrors backend searchKeywords util).
 */
const FEST_TYPE_LABELS = {
    cultural: 'cultural fest',
    technical: 'tech fest',
    sports: 'sports fest',
};

const MIN_TERM_LEN = 2;
const MAX_KEYWORDS = 48;

function normKey(value) {
    return String(value || '').trim().toLowerCase();
}

function addTerm(bucket, seen, value, weight = 1) {
    const label = String(value || '').trim().replace(/\s+/g, ' ');
    const key = normKey(label);
    if (key.length < MIN_TERM_LEN || seen.has(key)) return;
    seen.add(key);
    bucket.push({ label, weight });
}

function addCity(seen, bucket, value, weight = 2) {
    const raw = String(value || '').trim();
    if (!raw) return;
    addTerm(bucket, seen, raw.split(',')[0].trim(), weight);
}

function festTypeLabel(festType) {
    return FEST_TYPE_LABELS[festType] || (festType ? `${festType} fest` : '');
}

export function buildSearchKeywordsFromCatalog({
    fests = [],
    treks = [],
    communities = [],
    sports = [],
    runClubs = [],
    competitions = [],
    events = [],
} = {}) {
    const seen = new Set();
    const bucket = [];

    fests.forEach((fest) => {
        addTerm(bucket, seen, fest.festName, 5);
        addTerm(bucket, seen, fest.collegeName, 4);
        addTerm(bucket, seen, festTypeLabel(fest.festType || fest.type), 3);
        addCity(seen, bucket, fest.venue, 3);
        addCity(seen, bucket, fest.location, 3);
        (fest.highlights || []).forEach((h) => addTerm(bucket, seen, h, 2));
    });

    treks.forEach((trek) => {
        addTerm(bucket, seen, trek.trekName || trek.title, 5);
        addCity(seen, bucket, trek.city, 4);
        addTerm(bucket, seen, trek.startingPoint, 3);
        addTerm(bucket, seen, trek.trekCategory, 3);
        if (trek.difficultyLevel) addTerm(bucket, seen, `${trek.difficultyLevel} trek`, 2);
    });

    communities.forEach((comm) => {
        addTerm(bucket, seen, comm.name || comm.title, 5);
        addCity(seen, bucket, comm.basedIn || comm.subtitle, 4);
        (comm.trekCategories || []).forEach((cat) => addTerm(bucket, seen, cat, 3));
    });

    sports.forEach((event) => {
        addTerm(bucket, seen, event.title || event.name, 5);
        addCity(seen, bucket, event.city, 4);
        addTerm(bucket, seen, event.sportType, 3);
        if (event.sportType) addTerm(bucket, seen, `${event.sportType} event`, 2);
    });

    runClubs.forEach((club) => {
        addTerm(bucket, seen, club.name, 5);
        addCity(seen, bucket, club.basedIn, 4);
        addTerm(bucket, seen, 'run club', 2);
    });

    competitions.forEach((comp) => {
        addTerm(bucket, seen, comp.name || comp.competitionName, 5);
        addTerm(bucket, seen, comp.competitionType, 3);
        if (comp.competitionType) addTerm(bucket, seen, `${comp.competitionType} competition`, 2);
    });

    events.forEach((show) => {
        addTerm(bucket, seen, show.title, 5);
        addCity(seen, bucket, show.city, 4);
        addTerm(bucket, seen, show.eventType, 3);
    });

    return bucket
        .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
        .slice(0, MAX_KEYWORDS)
        .map((item) => item.label);
}

export function mergeKeywordLists(...lists) {
    const seen = new Set();
    const out = [];
    lists.flat().forEach((term) => {
        const label = String(term || '').trim();
        const key = normKey(label);
        if (key.length < MIN_TERM_LEN || seen.has(key)) return;
        seen.add(key);
        out.push(label);
    });
    return out.slice(0, MAX_KEYWORDS);
}
