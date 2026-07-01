function normalizePoint(raw) {
    const text = String(raw?.text || '').trim();
    if (!text) return null;

    let level = 'main';
    if (raw?.level === 'sub') level = 'sub';
    else if (raw?.showDot === false) level = 'sub';

    return { text, level };
}

function sanitizeItinerary(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((day, index) => {
            const points = Array.isArray(day?.points)
                ? day.points.map(normalizePoint).filter(Boolean)
                : [];

            const title = String(day?.title || '').trim();
            const description = points.length
                ? points.map((p) => p.text).join('\n')
                : String(day?.description || '').trim();

            if (!title && !points.length && !description) return null;

            return {
                day: Number(day?.day) || index + 1,
                title,
                description,
                points: points.length
                    ? points
                    : String(day?.description || '')
                        .split(/\n|•|·|;/)
                        .map((s) => s.replace(/^[-*\s]+/, '').trim())
                        .filter(Boolean)
                        .map((text) => ({ text, level: 'main' })),
            };
        })
        .filter(Boolean);
}

module.exports = { sanitizeItinerary };
