/** Display card labels in title case instead of ALL CAPS. */
export function toCardText(text) {
    if (!text || typeof text !== 'string') return '';
    const value = text.trim();
    if (!value) return '';

    return value
        .toLowerCase()
        .replace(/(^|[\s\-/&(])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
        .replace(/\bIit\b/g, 'IIT');
}

/** Format event date for card badge display based strictly on API data. Returns null if missing. */
export function formatCardDate(input) {
    if (!input) return null;

    let dateRaw = input;
    if (typeof input === 'object') {
        dateRaw = (
            input.festDate ||
            input.date ||
            input.dateTime ||
            input.startDate ||
            input.trekDate ||
            input.dateLabel ||
            input.eventDate ||
            null
        );
    }

    if (!dateRaw || (typeof dateRaw !== 'string' && !(dateRaw instanceof Date))) {
        return null;
    }

    const str = String(dateRaw).trim();
    if (!str || str === 'Date TBA' || str === 'Join now' || str === 'Trek' || str === 'Run' || str === 'Community') {
        return null;
    }

    if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }
    }

    return str;
}

/** Extract real price string based strictly on API data. Returns null if missing. */
export function extractRealPrice(event) {
    if (!event) return null;

    const raw = (
        event.ticketPrice ??
        event.price ??
        event.registrationFee ??
        event.feeAmount ??
        event.fee ??
        event.amount ??
        event.entryFee ??
        event.cost ??
        event.passPrice ??
        event.passes?.[0]?.price ??
        null
    );

    if (raw === null || raw === undefined || raw === '') {
        return null;
    }

    if (typeof raw === 'number') {
        if (raw === 0) return 'Free';
        return `₹${raw}`;
    }

    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed || trimmed === 'Date TBA') return null;
        if (trimmed === '0' || trimmed.toLowerCase() === 'free') {
            return 'Free';
        }
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            return `₹${trimmed}`;
        }
        if (trimmed.includes('₹')) {
            return trimmed;
        }
        if (trimmed.toLowerCase().includes('rs')) {
            return trimmed.replace(/rs\.?/i, '₹').trim();
        }
        return `₹${trimmed}`;
    }

    return null;
}





/** Extract 2 category/tag pills for card badges with icon types. */
export function extractCardTags(event) {
    if (!event) return [{ name: 'Sports', icon: 'sports' }, { name: 'Community', icon: 'community' }];

    let tagsList = [];

    if (Array.isArray(event.tags) && event.tags.length > 0) {
        tagsList = event.tags.slice(0, 2);
    } else if (Array.isArray(event.categories) && event.categories.length > 0) {
        tagsList = event.categories.slice(0, 2);
    } else if (typeof event.category === 'string' && event.category.trim()) {
        const split = event.category.split(/[,/•]/).map((s) => s.trim()).filter(Boolean);
        if (split.length > 0) tagsList = split.slice(0, 2);
    }

    if (tagsList.length === 0) {
        const type = (event._type || event.type || '').toLowerCase();
        if (type === 'fest') tagsList = ['Music', 'Cultural'];
        else if (type === 'sport' || type === 'runclub') tagsList = ['Sports', 'Community'];
        else if (type === 'trek') tagsList = ['Workshop', 'Creative'];
        else if (type === 'community') tagsList = ['Music', 'Social'];
        else if (type === 'events') tagsList = ['Music', 'Comedy'];
        else {
            const title = (event.title || event.name || event.festName || '').toLowerCase();
            if (title.includes('rush') || title.includes('run') || title.includes('fit') || title.includes('sport')) {
                tagsList = ['Sports', 'Community'];
            } else if (title.includes('jalsa') || title.includes('night') || title.includes('fest') || title.includes('live')) {
                tagsList = ['Music', 'Cultural'];
            } else if (title.includes('clock') || title.includes('craft') || title.includes('resin') || title.includes('art') || title.includes('workshop')) {
                tagsList = ['Workshop', 'Creative'];
            } else if (title.includes('pickle') || title.includes('tickle') || title.includes('club') || title.includes('meet')) {
                tagsList = ['Music', 'Social'];
            } else if (title.includes('mafia') || title.includes('comedy') || title.includes('standup')) {
                tagsList = ['Music', 'Comedy'];
            } else {
                tagsList = ['Sports', 'Community'];
            }
        }
    }

    return tagsList.map((tagStr) => {
        const lower = tagStr.toLowerCase();
        let iconType = 'default';
        if (lower.includes('sport') || lower.includes('run') || lower.includes('fit')) iconType = 'sports';
        else if (lower.includes('community') || lower.includes('social') || lower.includes('club')) iconType = 'community';
        else if (lower.includes('music') || lower.includes('sing') || lower.includes('sound')) iconType = 'music';
        else if (lower.includes('cultural') || lower.includes('dance') || lower.includes('fest')) iconType = 'cultural';
        else if (lower.includes('workshop') || lower.includes('craft') || lower.includes('art')) iconType = 'workshop';
        else if (lower.includes('creative') || lower.includes('design')) iconType = 'creative';
        else if (lower.includes('comedy') || lower.includes('standup')) iconType = 'comedy';

        return { name: tagStr, icon: iconType };
    });
}

/** Get card theme color palette ('blue' | 'pink' | 'teal' | 'cyan') matching design. */
export function getCardTheme(event) {
    if (!event) return 'blue';

    const title = (event.title || event.name || event.festName || '').toLowerCase();
    const type = (event._type || event.type || '').toLowerCase();
    const category = (event.category || '').toLowerCase();

    if (
        title.includes('jalsa') || title.includes('night') || title.includes('music') ||
        title.includes('fest') || type === 'fest' || category.includes('music')
    ) {
        return 'pink';
    }

    if (
        title.includes('clock') || title.includes('resin') || title.includes('workshop') ||
        title.includes('craft') || title.includes('art') || type === 'trek' || category.includes('workshop')
    ) {
        return 'teal';
    }

    if (
        title.includes('rush') || title.includes('run') || title.includes('fit') ||
        title.includes('sport') || type === 'sport' || type === 'runclub' || category.includes('sport')
    ) {
        return 'blue';
    }

    return 'cyan';
}


