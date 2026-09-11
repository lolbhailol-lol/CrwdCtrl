const { parseTrekDateForIndex, startOfLocalDay } = require('./trekDateNormalize');

const TREKKVEDE_COMMUNITY_MATCH = /trek+k?vede|trekk?\s*vede/i;

/** Parse YYYY-MM-DD as local calendar date (avoids UTC weekday drift). */
function parseLocalIsoDate(raw) {
    const text = String(raw || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return parseTrekDateForIndex(text);
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}

function isoFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Upcoming weekday ISO dates for the next `weeks` weeks (from today).
 * dayOfWeek: 0=Sun … 5=Fri, 6=Sat
 */
function upcomingWeekdays(dayOfWeek, weeks = 8, now = new Date()) {
    const out = [];
    const start = startOfLocalDay(now);
    const cursor = new Date(start);
    while (cursor.getDay() !== dayOfWeek) {
        cursor.setDate(cursor.getDate() + 1);
    }
    for (let i = 0; i < weeks; i += 1) {
        const d = new Date(cursor);
        d.setDate(cursor.getDate() + i * 7);
        out.push(isoFromDate(d));
    }
    return out;
}

function batchWeekday(rawDate) {
    const d = parseLocalIsoDate(rawDate);
    return d ? d.getDay() : null;
}

function isFutureOrTodayIso(rawDate, now = new Date()) {
    const d = parseLocalIsoDate(rawDate);
    if (!d) return true;
    return startOfLocalDay(d).getTime() >= startOfLocalDay(now).getTime();
}

function inferWeekdaysFromDateLabel(dateLabel = '') {
    const label = String(dateLabel || '').toLowerCase();
    if (/every saturday\s*&\s*sunday/.test(label)) return [6, 0];
    if (/fri/.test(label) && /sat/.test(label)) return [5, 6];
    if (/weekend/.test(label)) return [6, 0];
    return [6, 0];
}

function collectBatchTemplates(batches = []) {
    const templates = new Map();
    for (const batch of batches) {
        const weekday = batchWeekday(batch?.date);
        if (weekday === null || templates.has(weekday)) continue;
        templates.set(weekday, {
            batchSize: Math.max(0, parseInt(batch?.batchSize, 10) || 0),
            timing: String(batch?.timing || '').trim(),
            note: String(batch?.note || '').trim(),
        });
    }
    return templates;
}

/**
 * Rebuild trek batches with rolling Sat/Sun (or inferred weekday) dates.
 * Preserves timing/note per weekday from existing batches.
 */
function buildRollingWeekendBatches(existingBatches = [], { weeks = 8, dateLabel = '' } = {}, now = new Date()) {
    let templates = collectBatchTemplates(existingBatches);
    if (templates.size === 0) {
        for (const weekday of inferWeekdaysFromDateLabel(dateLabel)) {
            templates.set(weekday, { batchSize: 0, timing: '', note: '' });
        }
    }

    const dates = [];
    for (const weekday of templates.keys()) {
        dates.push(...upcomingWeekdays(weekday, weeks, now));
    }
    dates.sort();

    return dates.map((date) => {
        const weekday = batchWeekday(date);
        const template = templates.get(weekday) || { batchSize: 0, timing: '', note: '' };
        return {
            date,
            batchSize: template.batchSize,
            timing: template.timing,
            note: template.note,
        };
    });
}

function isRecurringWeekendTrek(trek = {}) {
    const label = String(trek.dateLabel || '').toLowerCase();
    if (/every (weekend|saturday|sunday)/.test(label)) return true;
    if (/sat.*sun|fri.*sat/.test(label)) return true;
    if (trek.featuredSection === 'weekend' || trek.featuredSection === 'both') {
        const batches = Array.isArray(trek.trekBatches) ? trek.trekBatches : [];
        const isoCount = batches.filter((b) => parseLocalIsoDate(b?.date)).length;
        if (isoCount >= 2) return true;
    }
    return false;
}

function filterPastIsoDates(dates = [], now = new Date()) {
    return dates.filter((d) => isFutureOrTodayIso(d, now));
}

function matchesTrekVedeCommunity(community = {}) {
    return TREKKVEDE_COMMUNITY_MATCH.test(community.name || '')
        || TREKKVEDE_COMMUNITY_MATCH.test(community.slug || '');
}

module.exports = {
    TREKKVEDE_COMMUNITY_MATCH,
    isoFromDate,
    upcomingWeekdays,
    batchWeekday,
    isFutureOrTodayIso,
    inferWeekdaysFromDateLabel,
    collectBatchTemplates,
    buildRollingWeekendBatches,
    isRecurringWeekendTrek,
    filterPastIsoDates,
    matchesTrekVedeCommunity,
};
