/** Shared defaults for competition.registration.personFields (MindSpark roster forms) */

const MINDSPARK_FEST_ID = '6a7f1010ed26d983b34e55c2';

const DEFAULT_PERSON_FIELDS = [
    { id: 'pf_name', key: 'name', label: 'Full name', type: 'text', placeholder: 'Full name', required: true },
    { id: 'pf_email', key: 'email', label: 'Email', type: 'email', placeholder: 'email@college.edu', required: true },
    { id: 'pf_phone', key: 'phone', label: 'Phone number', type: 'tel', placeholder: '10-digit mobile', required: true },
    { id: 'pf_college', key: 'college', label: 'College name', type: 'text', placeholder: 'College / institution', required: true },
];

function isMindSparkFestId(festId) {
    return String(festId || '') === MINDSPARK_FEST_ID;
}

function slugKey(label, fallback = 'field') {
    const base = String(label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 32);
    return base || fallback;
}

function parseOptions(raw) {
    if (Array.isArray(raw)) {
        return raw.map((o) => String(o || '').trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
        return raw.split(/\r?\n|,/).map((o) => o.trim()).filter(Boolean);
    }
    return [];
}

function normalizePersonField(raw, index = 0) {
    const id = String(raw?.id || `pf_${index}`);
    const label = String(raw?.label || '').trim() || `Field ${index + 1}`;
    let key = String(raw?.key || raw?.fieldName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');
    if (!key) key = slugKey(label, `field_${index + 1}`);
    const allowed = new Set(['text', 'email', 'tel', 'select', 'radio']);
    const type = allowed.has(raw?.type) ? raw.type : 'text';
    const scope = raw?.scope === 'team' ? 'team' : 'person';
    const options = type === 'select' || type === 'radio' ? parseOptions(raw?.options) : [];
    return {
        id,
        key,
        label,
        type,
        scope,
        options,
        placeholder: String(raw?.placeholder || '').trim(),
        required: raw?.required !== false,
    };
}

function normalizePersonFields(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return DEFAULT_PERSON_FIELDS.map((f, i) => normalizePersonField(f, i));
    }
    const seen = new Set();
    return list.map((raw, i) => {
        let field = normalizePersonField(raw, i);
        let key = field.key;
        let n = 2;
        while (seen.has(key)) {
            key = `${field.key}_${n}`;
            n += 1;
        }
        seen.add(key);
        return { ...field, key };
    });
}

/**
 * MindSpark: always ensure personFields.
 * Other fests: only normalize if personFields already present; never inject defaults.
 */
function withNormalizedPersonFields(registration = {}, opts = {}) {
    const next = { ...(registration || {}) };
    const force = opts.force === true || isMindSparkFestId(opts.festId);
    const hasFields = Array.isArray(next.personFields) && next.personFields.length > 0;
    if (force || hasFields) {
        next.personFields = normalizePersonFields(next.personFields);
    } else if ('personFields' in next && (!next.personFields || next.personFields.length === 0)) {
        delete next.personFields;
    }
    return next;
}

module.exports = {
    MINDSPARK_FEST_ID,
    DEFAULT_PERSON_FIELDS,
    isMindSparkFestId,
    normalizePersonFields,
    withNormalizedPersonFields,
};
