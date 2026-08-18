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
    { id: 'ice', label: 'Ice / Ice bath' },
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
    { label: 'Ice Bath', value: '', icon: 'ice' },
];

export const EVENT_DETAIL_BOX_PRESETS = [
    { label: 'Sport', value: '', icon: 'star' },
    { label: 'Game', value: '', icon: 'clock' },
    { label: 'Café', value: '', icon: 'food' },
    { label: 'Location partner', value: '', icon: 'map-pin' },
    { label: 'Café partner', value: '', icon: 'food' },
    { label: 'Event Timing', value: '', icon: 'sun' },
    { label: 'Start Time', value: '', icon: 'sun' },
    { label: 'Meeting Point', value: '', icon: 'map-pin' },
    { label: 'Duration', value: '', icon: 'clock' },
    { label: 'Max People', value: '', icon: 'people' },
    { label: 'Age Limit', value: '', icon: 'age' },
];

const EVENT_MAP_SIDE_RULES = [
    { key: 'sport', label: 'Sport', icon: 'star', match: /^(sport)$/i },
    { key: 'game', label: 'Game', icon: 'clock', match: /^(game|session|activity)$/i },
    { key: 'cafe', label: 'Café', icon: 'food', match: /^(caf[eé]|hang)$/i },
];

export function isEventMapSideDetailBox(box) {
    const label = String(box?.label || '').trim();
    return EVENT_MAP_SIDE_RULES.some((rule) => rule.match.test(label));
}

/** Keep Game as a time range even if an older box still prefixes the sport name. */
function gameTimeOnly(value, sport) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const sportName = String(sport || '').trim();
    if (sportName && raw.toLowerCase() === sportName.toLowerCase()) return '';
    if (/[·•|]/.test(raw)) {
        const parts = raw.split(/[·•|]/).map((part) => part.trim()).filter(Boolean);
        const timed = parts.find((part) => /\d/.test(part) && /(am|pm|:|–|-)/i.test(part));
        if (timed) return timed;
        return parts
            .filter((part) => !sportName || part.toLowerCase() !== sportName.toLowerCase())
            .join(' · ');
    }
    return raw;
}

/** Sport + Game time + Café time beside the map on event community pages. */
export function isBoardMeetupEvent(event) {
    const blob = [
        event?.title,
        event?.displayType,
        event?.runCategory,
        event?.organizer,
        event?.runClub?.name,
        event?.runClub?.title,
        event?.runClub?.tagline,
    ].filter(Boolean).join(' ').toLowerCase();
    return /board\s*game|boardgame|board\s*meetup|board\s*night|board\s*club/.test(blob);
}

function formatCommunityEventDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).trim();
    return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });
}

function displayVenueName(event) {
    const venue = String(event?.venue || '').trim();
    if (/^https?:\/\//i.test(venue)) {
        return String(event?.meetingPoint || event?.city || '').trim();
    }
    return venue || String(event?.meetingPoint || event?.city || '').trim();
}

export function eventMapSideFacts(event) {
    if (!event) return [];
    const boxes = normalizeRunDetailBoxes(event.detailBoxes, event);
    const findBox = (re) => boxes.find((box) => re.test(String(box.label || '').trim()));

    if (isBoardMeetupEvent(event)) {
        const date = String(findBox(/^(date)$/i)?.value || formatCommunityEventDate(event.eventDate) || '').trim();
        const time = String(
            findBox(/^(time|timing|event timing)$/i)?.value || event.reportingTime || '',
        ).trim();
        const venue = String(
            findBox(/^(venue|location)$/i)?.value || displayVenueName(event) || '',
        ).trim();
        return [
            date ? { key: 'date', label: 'Date', value: date, icon: 'calendar' } : null,
            time ? { key: 'time', label: 'Time', value: time, icon: 'clock' } : null,
            venue ? { key: 'venue', label: 'Venue', value: venue, icon: 'map-pin' } : null,
        ].filter(Boolean);
    }

    const fallbacks = {
        sport: String(event.displayType || event.runCategory || '').trim(),
        game: String(event.reportingTime || '').trim(),
        cafe: String(event.returnTime || '').trim(),
    };
    const sport = String(findBox(/^(sport)$/i)?.value || fallbacks.sport || '').trim();

    return EVENT_MAP_SIDE_RULES.map((rule) => {
        const box = findBox(rule.match);
        let value = String(box?.value || fallbacks[rule.key] || '').trim();
        if (rule.key === 'game') value = gameTimeOnly(value, sport);
        if (!value) return null;
        return {
            key: rule.key,
            label: box?.label || rule.label,
            value,
            icon: box?.icon || rule.icon,
        };
    }).filter(Boolean);
}

/** Details-tab cards — Game / Café times stay beside the map only. */
export function eventDetailTabBoxes(event) {
    return normalizeRunDetailBoxes(event?.detailBoxes, event).filter((box) => !isEventMapSideDetailBox(box));
}

const LABEL_ICON_RULES = [
    { match: /people|participant|group|seat/i, icon: 'people' },
    { match: /depart|start|timing|morning/i, icon: 'sun' },
    { match: /return|end|evening/i, icon: 'moon' },
    { match: /location partner/i, icon: 'map-pin' },
    { match: /caf[eé] partner/i, icon: 'food' },
    { match: /meet|location|point|pick/i, icon: 'map-pin' },
    { match: /age/i, icon: 'age' },
    { match: /fitness|health|stamina/i, icon: 'fitness' },
    { match: /date|batch/i, icon: 'calendar' },
    { match: /time|hour|am|pm/i, icon: 'clock' },
    { match: /altitude|elevation|mountain|peak/i, icon: 'mountain' },
    { match: /distance|route|km/i, icon: 'route' },
    { match: /camp|tent|stay/i, icon: 'tent' },
    { match: /meal|food|breakfast|lunch|dinner|caf[eé]|brunch|coffee/i, icon: 'food' },
    { match: /game|sport|badminton|session/i, icon: 'star' },
    { match: /weather|rain|season/i, icon: 'weather' },
    { match: /ice|cold.?plunge|cryo|snow/i, icon: 'ice' },
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

/** Map pin for run detail pages — venue/city text + optional pasted Google Maps link. */
export function resolveRunMapPin(event) {
    if (!event) return { query: '', mapUrl: '', caption: '' };
    const routeMap = String(event.routeMap || '').trim();
    const venue = String(event.venue || '').trim();
    const city = String(event.city || '').trim();
    const meetingPoint = String(event.meetingPoint || '').trim();
    const clubBase = String(event.runClub?.basedIn || '').trim();

    if (/^https?:\/\//i.test(routeMap)) {
        const caption = venue || meetingPoint || city || clubBase || 'Open map';
        return { query: venue || meetingPoint || city || clubBase, mapUrl: routeMap, caption };
    }
    // Organizers sometimes paste the Maps link into Venue instead of Route Map
    if (/^https?:\/\//i.test(venue)) {
        const caption = meetingPoint || city || clubBase || 'Meeting point';
        return { query: meetingPoint || city || clubBase, mapUrl: venue, caption };
    }
    if (/^https?:\/\//i.test(meetingPoint)) {
        const caption = venue || city || clubBase || 'Meeting point';
        return { query: venue || city || clubBase, mapUrl: meetingPoint, caption };
    }

    const query = venue || meetingPoint || city || clubBase;
    return { query, mapUrl: '', caption: query };
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
