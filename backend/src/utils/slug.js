const mongoose = require('mongoose');

function toSlug(value = '') {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Strict 24-hex check — do not use mongoose.isValid (12-char strings can pass). */
function isObjectId(value) {
    return /^[a-f\d]{24}$/i.test(String(value || '').trim());
}

/**
 * Allocate a unique slug for a model (base, base-2, base-3, …).
 */
async function ensureUniqueSlug(Model, baseValue, { excludeId = null, filter = {} } = {}) {
    const base = toSlug(baseValue);
    if (!base) return '';

    let candidate = base;
    for (let n = 2; n < 200; n += 1) {
        const query = { ...filter, slug: candidate };
        if (excludeId) query._id = { $ne: excludeId };
        // eslint-disable-next-line no-await-in-loop
        const taken = await Model.exists(query);
        if (!taken) return candidate;
        candidate = `${base}-${n}`;
    }

    const suffix = String(excludeId || Date.now()).replace(/[^a-f\d]/gi, '').slice(-6);
    return suffix ? `${base}-${suffix}` : `${base}-${Date.now()}`;
}

/**
 * Resolve a document by Mongo id OR by name-like slug.
 * Uses in-memory matching fallback for legacy data without slug field.
 */
async function findByIdOrSlug(Model, idOrSlug, {
    baseFilter = {},
    pickName = () => '',
    lean = true,
    sort = null,
    select = null,
} = {}) {
    if (!idOrSlug) return null;
    const raw = String(idOrSlug).trim();
    if (!raw) return null;

    const applyQueryOpts = (q) => {
        if (select) q.select(select);
        if (sort) q.sort(sort);
        return q;
    };

    if (isObjectId(raw)) {
        try {
            const q = applyQueryOpts(Model.findOne({ ...baseFilter, _id: raw }));
            const doc = lean ? await q.lean() : await q;
            if (doc) return doc;
        } catch (err) {
            // Never surface CastError for bad ids — fall through to slug match
            if (err?.name !== 'CastError') throw err;
        }
    }

    const slug = toSlug(raw);
    if (!slug) return null;

    // Prefer persisted unique slug field when present
    try {
        const bySlugField = applyQueryOpts(Model.findOne({ ...baseFilter, slug }));
        const hit = lean ? await bySlugField.lean() : await bySlugField;
        if (hit) return hit;
    } catch (_) {
        // Model may not have a slug path — ignore
    }

    // Lightweight scan for legacy docs without slug.
    // Prefer newest when multiple names share a slug (cross-community collision).
    const scanSelect = select || 'title name festName trekName displayName slug createdAt';
    const rowsQuery = Model.find(baseFilter)
        .select(scanSelect)
        .sort(sort || { createdAt: -1 })
        .limit(500);
    const rows = lean ? await rowsQuery.lean() : await rowsQuery;
    const matched = rows.find((row) => {
        const named = toSlug(pickName(row));
        const stored = row.slug ? toSlug(row.slug) : '';
        return named === slug || stored === slug;
    });
    if (!matched) return null;

    // Return full document (scan used a narrow projection)
    if (select) {
        const q = applyQueryOpts(Model.findOne({ ...baseFilter, _id: matched._id }));
        return lean ? await q.lean() : await q;
    }
    const fullQ = Model.findOne({ ...baseFilter, _id: matched._id });
    return lean ? await fullQ.lean() : await fullQ;
}

module.exports = {
    toSlug,
    isObjectId,
    ensureUniqueSlug,
    findByIdOrSlug,
};
