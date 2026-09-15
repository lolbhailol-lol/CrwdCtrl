/** Normalize run contact phone / Instagram lists and sync legacy single fields. */

function normalizeStringList(list, legacy = '') {
    const fromArray = Array.isArray(list)
        ? list.map((s) => String(s || '').trim()).filter(Boolean)
        : [];
    if (fromArray.length) {
        return [...new Set(fromArray)];
    }
    const single = String(legacy || '').trim();
    return single ? [single] : [];
}

/**
 * Build contact fields from request body.
 * Accepts either arrays (contactPhones / contactInstagrams) or legacy singles.
 * Returns null when none of the contact keys are present.
 */
function contactsFromBody(body = {}) {
    const hasPhones = body.contactPhones !== undefined;
    const hasInstas = body.contactInstagrams !== undefined;
    const hasPhone = body.contactPhone !== undefined;
    const hasInsta = body.contactInstagram !== undefined;

    if (!hasPhones && !hasInstas && !hasPhone && !hasInsta) {
        return null;
    }

    const phones = hasPhones
        ? normalizeStringList(body.contactPhones)
        : normalizeStringList(null, body.contactPhone);

    const instagrams = hasInstas
        ? normalizeStringList(body.contactInstagrams)
        : normalizeStringList(null, body.contactInstagram);

    return {
        contactPhones: phones,
        contactInstagrams: instagrams,
        contactPhone: phones[0] || '',
        contactInstagram: instagrams[0] || '',
    };
}

module.exports = {
    normalizeStringList,
    contactsFromBody,
};
