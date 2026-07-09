const mongoose = require('mongoose');

function toSlug(value = '') {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function isObjectId(value) {
    return mongoose.Types.ObjectId.isValid(value);
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
} = {}) {
    if (!idOrSlug) return null;

    if (isObjectId(idOrSlug)) {
        const q = Model.findOne({ ...baseFilter, _id: idOrSlug });
        if (sort) q.sort(sort);
        return lean ? q.lean() : q;
    }

    const slug = toSlug(idOrSlug);
    if (!slug) return null;

    const q = Model.find(baseFilter);
    if (sort) q.sort(sort);
    const rows = lean ? await q.lean() : await q;
    return rows.find((row) => toSlug(pickName(row)) === slug) || null;
}

module.exports = {
    toSlug,
    isObjectId,
    findByIdOrSlug,
};
