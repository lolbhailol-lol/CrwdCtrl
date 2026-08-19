function normalizeGuestPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length < 10) return '';
    const phone = digits.slice(-10);
    if (phone === '9999999999') return '';
    return phone;
}

function sanitizeSportsFormDraft(formData = {}, extras = {}) {
    const out = {};
    const src = formData && typeof formData === 'object' && !Array.isArray(formData)
        ? formData
        : {};

    for (const [key, value] of Object.entries(src)) {
        if (value == null || typeof value === 'object') continue;
        const s = String(value).trim();
        if (!s || s.length > 2000) continue;
        out[String(key).slice(0, 80)] = s;
    }

    const gender = String(extras.gender || out.gender || out.sex || '').trim();
    if (gender) {
        out.gender = gender;
        if (!out.sex) out.sex = gender;
    }

    const name = String(extras.customerName || out.full_name || out.name || '').trim();
    if (name) {
        if (!out.full_name) out.full_name = name;
        if (!out.name) out.name = name;
    }

    const email = String(extras.customerEmail || out.email || '').trim().toLowerCase();
    if (email) out.email = email;

    const phone = normalizeGuestPhone(extras.customerPhone || out.contact_no || out.phone);
    if (phone) {
        out.contact_no = phone;
        if (!out.phone) out.phone = phone;
    } else {
        delete out.contact_no;
        delete out.phone;
    }

    return out;
}

function mergeSportsFormResponses(primary = {}, fallback = {}) {
    return {
        ...(fallback && typeof fallback === 'object' ? fallback : {}),
        ...(primary && typeof primary === 'object' ? primary : {}),
    };
}

module.exports = {
    normalizeGuestPhone,
    sanitizeSportsFormDraft,
    mergeSportsFormResponses,
};
