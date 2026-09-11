/** Normalize run contact phone / Instagram lists (arrays + legacy single fields). */

export function normalizeStringList(list, legacy = '') {
    const fromArray = Array.isArray(list)
        ? list.map((s) => String(s || '').trim()).filter(Boolean)
        : [];
    if (fromArray.length) {
        return [...new Set(fromArray)];
    }
    const single = String(legacy || '').trim();
    return single ? [single] : [];
}

export function contactsFromEvent(event = {}) {
    return {
        contactPhones: normalizeStringList(event.contactPhones, event.contactPhone),
        contactInstagrams: normalizeStringList(event.contactInstagrams, event.contactInstagram),
    };
}

/** Payload shape: arrays + first item synced to legacy single fields. */
export function contactsToPayload(phones, instagrams) {
    const contactPhones = normalizeStringList(phones);
    const contactInstagrams = normalizeStringList(instagrams);
    return {
        contactPhones,
        contactInstagrams,
        contactPhone: contactPhones[0] || '',
        contactInstagram: contactInstagrams[0] || '',
    };
}

/** Strip @ / URL path for instagram.com links. */
export function instagramHandle(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) {
        try {
            s = new URL(s).pathname.replace(/^\/+|\/+$/g, '');
        } catch {
            /* keep as-is */
        }
    }
    return s.replace(/^@/, '').split(/[/?#]/)[0] || '';
}

/**
 * Resolve phones/Instagrams for the public run page.
 * Prefer event lists; fall back to club singles when event has none.
 */
export function resolveRunContacts(event, club = null) {
    const phones = normalizeStringList(event?.contactPhones, event?.contactPhone);
    const instagrams = normalizeStringList(event?.contactInstagrams, event?.contactInstagram);
    return {
        phones: phones.length
            ? phones
            : normalizeStringList(null, club?.contactPhone),
        instagrams: instagrams.length
            ? instagrams
            : normalizeStringList(null, club?.contactInstagram),
    };
}
