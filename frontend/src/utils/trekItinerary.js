export const EMPTY_MAIN_POINT = { text: '', level: 'main' };
export const EMPTY_SUB_POINT = { text: '', level: 'sub' };
export const EMPTY_SCHEDULE_POINT = EMPTY_MAIN_POINT;

function normalizePoint(raw) {
    const text = String(raw?.text || '').trim();
    if (!text) return null;

    let level = 'main';
    if (raw?.level === 'sub') level = 'sub';
    else if (raw?.showDot === false) level = 'sub';

    return { text, level };
}

export function parseDescriptionToPoints(description = '') {
    return String(description)
        .split(/\n|•|·|;/)
        .map((s) => s.replace(/^[-*\s]+/, '').trim())
        .filter(Boolean)
        .map((text) => ({ text, level: 'main' }));
}

export function normalizeItineraryDay(day, index = 0) {
    if (!day) {
        return { day: index + 1, title: '', description: '', points: [] };
    }

    let points = Array.isArray(day.points)
        ? day.points.map(normalizePoint).filter(Boolean)
        : [];

    if (!points.length && day.description) {
        points = parseDescriptionToPoints(day.description);
    }

    return {
        day: day.day || index + 1,
        title: String(day.title || '').trim(),
        description: String(day.description || '').trim(),
        points,
    };
}

export function normalizeItineraryForForm(list) {
    if (!Array.isArray(list) || !list.length) return [];
    return list.map((day, i) => {
        const normalized = normalizeItineraryDay(day, i);
        if (!normalized.points.length) {
            normalized.points = [{ ...EMPTY_MAIN_POINT }];
        }
        return normalized;
    });
}

export function normalizeItinerary(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((day, i) => normalizeItineraryDay(day, i))
        .filter((day) => day.title || day.points.length);
}

export function serializeItineraryForSave(list) {
    return normalizeItinerary(list).map((day, i) => ({
        day: day.day || i + 1,
        title: day.title,
        description: day.points.map((p) => p.text).join('\n'),
        points: day.points.map((p) => ({
            text: p.text,
            level: p.level === 'sub' ? 'sub' : 'main',
        })),
    }));
}

/** Dot column (6px) + gap (8px) — sub-points align under main text */
export const SCHEDULE_SUB_INDENT_PX = 14;
