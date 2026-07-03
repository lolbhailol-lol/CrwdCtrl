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

module.exports = {
    normalizeTrekDateString,
    normalizeAvailableDates,
    parseTrekDateForIndex,
};
