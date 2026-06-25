const RECENT_KEY = 'crwdctrl_recent_searches';
const MAX_RECENT = 6;

/** Fallback when API / catalog keywords are not loaded yet */
export const FALLBACK_SEARCH_TERMS = [
    'cultural fest',
    'tech fest',
    'sports fest',
    'trek',
    'run club',
    'competition',
];

export function filterPopularTerms(query, terms = FALLBACK_SEARCH_TERMS) {
    const q = query.trim().toLowerCase();
    if (!q) return terms.slice(0, 8);
    return terms
        .filter((term) => term.includes(q) || q.split(/\s+/).some((word) => word.length > 1 && term.includes(word)))
        .slice(0, 6);
}

export function getRecentSearches() {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.filter(Boolean).slice(0, MAX_RECENT) : [];
    } catch {
        return [];
    }
}

export function saveRecentSearch(term) {
    const label = String(term || '').trim();
    if (!label) return;
    const prev = getRecentSearches().filter((t) => t.toLowerCase() !== label.toLowerCase());
    localStorage.setItem(RECENT_KEY, JSON.stringify([label, ...prev].slice(0, MAX_RECENT)));
}

export function clearRecentSearches() {
    try {
        localStorage.removeItem(RECENT_KEY);
    } catch {
        /* ignore */
    }
}

export function getSearchResultTitle(result) {
    return result?.title || result?._title || result?.festival_name || result?.name || result?.competitionName || 'Untitled';
}

export function filterItemsByQuery(items, query) {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
        const title = (item.title || item._title || item.festName || item.name || '').toLowerCase();
        const subtitle = (item.subtitle || item._subtitle || item.collegeName || item.organizing_body || item.basedIn || '').toLowerCase();
        return title.includes(q) || subtitle.includes(q);
    });
}
