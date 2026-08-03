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

export const RUN_DETAIL_BOX_PRESETS = [
    { label: 'Max People', value: '', icon: 'people' },
    { label: 'Run Timing', value: '', icon: 'sun' },
    { label: 'Return Time', value: '', icon: 'moon' },
    { label: 'Meeting Point', value: '', icon: 'map-pin' },
    { label: 'Age Limit', value: '', icon: 'age' },
    { label: 'Fitness', value: '', icon: 'fitness' },
    { label: 'Distance', value: '', icon: 'route' },
    { label: 'Pace', value: '', icon: 'clock' },
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
    push('Meeting Point', trek.meetingLocation && !/^https?:\/\//i.test(String(trek.meetingLocation).trim()) ? trek.meetingLocation : '', 'map-pin');
    push('Age Limit', trek.ageRestrictions, 'age');
    push('Fitness', trek.fitnessRequirements, 'fitness');

    return legacy;
}

/** Map pin query + optional Google Maps link for LazyMap. */
export function resolveTrekMapPin(trek) {
    if (!trek) return { query: '', mapUrl: '', caption: '' };
    const meeting = String(trek.meetingLocation || '').trim();
    const options = Array.isArray(trek.registration?.locationOptions)
        ? trek.registration.locationOptions.map((s) => String(s || '').trim()).filter(Boolean)
        : [];
    const firstOption = options[0] || '';

    // meetingLocation can be a Google Maps share/pin link
    if (/^https?:\/\//i.test(meeting)) {
        const caption = firstOption || trek.startingPoint || trek.city || 'Meeting point';
        return { query: firstOption || trek.city || trek.destination || '', mapUrl: meeting, caption };
    }

    const query = meeting || firstOption || trek.startingPoint || trek.destination || trek.city || '';
    const caption = meeting || firstOption || [trek.city, trek.destination].filter(Boolean).join(', ');
    return { query, mapUrl: '', caption };
}

/** Same editor shape for sports / run events — falls back to classic run fields. */
export function normalizeRunDetailBoxes(list, event = null) {
    if (Array.isArray(list) && list.length > 0) {
        return normalizeDetailBoxes(list, null);
    }
    if (!event) return [];

    const legacy = [];
    const push = (label, value, icon) => {
        if (value === undefined || value === null || value === '') return;
        if (typeof value === 'number' && value <= 0) return;
        legacy.push({ id: `legacy_${legacy.length}`, label, value: String(value), icon, order: legacy.length });
    };

    push('Max People', event.maxParticipants > 0 ? event.maxParticipants : '', 'people');
    push('Run Timing', event.reportingTime, 'sun');
    push('Return Time', event.returnTime, 'moon');
    push('Meeting Point', event.meetingPoint, 'map-pin');
    push('Age Limit', event.ageLimit, 'age');
    push('Fitness', event.fitnessLevel, 'fitness');

    return legacy;
}

export function sanitizeDetailBoxesPayload(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((box, index) => ({
            id: String(box?.id || `box_${index}`).trim(),
            label: String(box?.label || '').trim(),
            value: String(box?.value || '').trim(),
            icon: String(box?.icon || guessIconForLabel(box?.label) || 'default').trim() || 'default',
            order: Number.isFinite(Number(box?.order)) ? Number(box.order) : index,
        }))
        .filter((box) => box.label || box.value)
        .map((box, index) => ({ ...box, order: index }));
}
