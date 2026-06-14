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
    bucket.push({ label, weight, key });
}

function addCity(seen, bucket, value, weight = 2) {
    const raw = String(value || '').trim();
    if (!raw) return;
    const city = raw.split(',')[0].trim();
    addTerm(bucket, seen, city, weight);
}

function festTypeLabel(festType) {
    return FEST_TYPE_LABELS[festType] || (festType ? `${festType} fest` : '');
}

function finalizeKeywords(bucket) {
    return bucket
        .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
        .slice(0, MAX_KEYWORDS)
        .map((item) => item.label);
}

function buildSearchKeywords({
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
        addTerm(bucket, seen, festTypeLabel(fest.festType), 3);
        addCity(seen, bucket, fest.venue, 3);
        addCity(seen, bucket, fest.location, 3);
        (fest.highlights || []).forEach((h) => addTerm(bucket, seen, h, 2));
    });

    treks.forEach((trek) => {
        addTerm(bucket, seen, trek.trekName, 5);
        addCity(seen, bucket, trek.city, 4);
        addTerm(bucket, seen, trek.startingPoint, 3);
        addTerm(bucket, seen, trek.trekCategory, 3);
        if (trek.difficultyLevel) addTerm(bucket, seen, `${trek.difficultyLevel} trek`, 2);
    });

    communities.forEach((comm) => {
        addTerm(bucket, seen, comm.name, 5);
        addCity(seen, bucket, comm.basedIn, 4);
        (comm.trekCategories || []).forEach((cat) => addTerm(bucket, seen, cat, 3));
    });

    sports.forEach((event) => {
        addTerm(bucket, seen, event.title, 5);
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
        addTerm(bucket, seen, comp.name, 5);
        addTerm(bucket, seen, comp.competitionType, 3);
        if (comp.competitionType) addTerm(bucket, seen, `${comp.competitionType} competition`, 2);
    });

    events.forEach((show) => {
        addTerm(bucket, seen, show.title, 5);
        addCity(seen, bucket, show.city, 4);
        addTerm(bucket, seen, show.eventType, 3);
    });

    return finalizeKeywords(bucket);
}

module.exports = { buildSearchKeywords, festTypeLabel };
