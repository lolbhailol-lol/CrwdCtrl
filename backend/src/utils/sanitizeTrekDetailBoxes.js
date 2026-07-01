const ALLOWED_ICONS = new Set([
    'people', 'sun', 'moon', 'map-pin', 'age', 'fitness', 'calendar',
    'info', 'mountain', 'route', 'tent', 'food', 'weather', 'clock', 'star', 'default',
]);

function sanitizeTrekDetailBoxes(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((box, index) => ({
            id: String(box?.id || `box_${index}_${Date.now()}`),
            label: String(box?.label || '').trim(),
            value: String(box?.value || '').trim(),
            icon: ALLOWED_ICONS.has(box?.icon) ? box.icon : 'default',
            order: Number.isFinite(Number(box?.order)) ? Number(box.order) : index,
        }))
        .filter((box) => box.label || box.value)
        .sort((a, b) => a.order - b.order);
}

module.exports = { sanitizeTrekDetailBoxes, ALLOWED_ICONS };
