export const TREK_DETAIL_ICON_OPTIONS = [
    { id: 'people', label: 'People' },
    { id: 'sun', label: 'Morning / Start' },
    { id: 'moon', label: 'Evening / Return' },
    { id: 'map-pin', label: 'Location' },
    { id: 'age', label: 'Age limit' },
    { id: 'fitness', label: 'Fitness' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'clock', label: 'Time' },
    { id: 'mountain', label: 'Mountain' },
    { id: 'route', label: 'Route' },
    { id: 'tent', label: 'Camping' },
    { id: 'food', label: 'Meals' },
    { id: 'weather', label: 'Weather' },
    { id: 'star', label: 'Highlight' },
    { id: 'info', label: 'Info' },
    { id: 'default', label: 'Default' },
];

export const DETAIL_BOX_PRESETS = [
    { label: 'Max People', value: '', icon: 'people' },
    { label: 'Trek Timing', value: '', icon: 'sun' },
    { label: 'Return Time', value: '', icon: 'moon' },
    { label: 'Meeting Point', value: '', icon: 'map-pin' },
    { label: 'Age Limit', value: '', icon: 'age' },
    { label: 'Fitness', value: '', icon: 'fitness' },
];

const LABEL_ICON_RULES = [
    { match: /people|participant|group|seat/i, icon: 'people' },
    { match: /depart|start|timing|morning/i, icon: 'sun' },
    { match: /return|end|evening/i, icon: 'moon' },
    { match: /meet|location|point|pick/i, icon: 'map-pin' },
    { match: /age/i, icon: 'age' },
    { match: /fitness|health|stamina/i, icon: 'fitness' },
    { match: /date|batch/i, icon: 'calendar' },
    { match: /time|hour|am|pm/i, icon: 'clock' },
    { match: /altitude|elevation|mountain|peak/i, icon: 'mountain' },
    { match: /distance|route|km/i, icon: 'route' },
    { match: /camp|tent|stay/i, icon: 'tent' },
    { match: /meal|food|breakfast|lunch|dinner/i, icon: 'food' },
    { match: /weather|rain|season/i, icon: 'weather' },
];

export function guessIconForLabel(label = '') {
    const text = String(label).trim();
    if (!text) return 'default';
    const rule = LABEL_ICON_RULES.find((r) => r.match.test(text));
    return rule?.icon || 'default';
}

export function createEmptyDetailBox(order = 0) {
    return {
        id: `box_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: '',
        value: '',
        icon: 'default',
        order,
    };
}

export function normalizeDetailBoxes(list, trek = null) {
    if (Array.isArray(list) && list.length > 0) {
        return list
            .map((box, index) => ({
                id: box.id || `box_${index}`,
                label: String(box.label || '').trim(),
                value: String(box.value || '').trim(),
                icon: box.icon || guessIconForLabel(box.label),
                order: Number.isFinite(Number(box.order)) ? Number(box.order) : index,
            }))
            .filter((box) => box.label || box.value)
            .sort((a, b) => a.order - b.order);
    }

    if (!trek) return [];

    const legacy = [];
    const push = (label, value, icon) => {
        if (value === undefined || value === null || value === '') return;
        if (typeof value === 'number' && value <= 0) return;
        legacy.push({ id: `legacy_${legacy.length}`, label, value: String(value), icon, order: legacy.length });
    };

    push('Max People', trek.maxParticipants > 0 ? trek.maxParticipants : '', 'people');
    push('Trek Timing', trek.departureTime, 'sun');
    push('Return Time', trek.returnTime, 'moon');
    push('Meeting Point', trek.meetingLocation, 'map-pin');
    push('Age Limit', trek.ageRestrictions, 'age');
    push('Fitness', trek.fitnessRequirements, 'fitness');

    return legacy;
}
