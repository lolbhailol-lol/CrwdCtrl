/**
 * Normalize trek batch / booking date strings for consistent storage and sorting.
 * Machine-parseable dates → ISO YYYY-MM-DD; free-text ranges (e.g. "11 - 12 July") are kept as-is.
 */
function normalizeTrekDateString(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';

    if (/[a-zA-Z]/.test(text) || text.includes(' - ')) {
        return text;
    }

    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
    }

    return text;
}

function normalizeAvailableDates(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((d) => normalizeTrekDateString(d))
        .filter(Boolean);
}

function parseTrekDateForIndex(raw) {
    const normalized = normalizeTrekDateString(raw);
    if (!normalized || /[a-zA-Z]/.test(normalized) || normalized.includes(' - ')) {
        return null;
    }
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Start of local calendar day for comparisons. */
function startOfLocalDay(d = new Date()) {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
}

/**
 * Prefer the next upcoming batch date for trekDate indexing so recurring
 * "every weekend" treks stay in Upcoming (not Past) after early batches pass.
 */
function pickNextUpcomingBatchDate(batches = [], now = new Date()) {
    if (!Array.isArray(batches) || !batches.length) return null;
    const today = startOfLocalDay(now).getTime();
    const parsed = batches
        .map((b) => parseTrekDateForIndex(b?.date))
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());
    if (!parsed.length) return null;
    const upcoming = parsed.find((d) => startOfLocalDay(d).getTime() >= today);
    return upcoming || parsed[parsed.length - 1];
}

module.exports = {
    normalizeTrekDateString,
    normalizeAvailableDates,
    parseTrekDateForIndex,
    startOfLocalDay,
    pickNextUpcomingBatchDate,
};
