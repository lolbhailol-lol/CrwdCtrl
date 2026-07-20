const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const trekOrganizerAccountSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        // Optional — empty string must NOT be stored (unique index treats "" as a duplicate).
        email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
        passwordHash: { type: String, required: true },
        phone: { type: String, trim: true, default: '' },
        communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrekCommunity', default: null },
        /** @deprecated Use communityId — kept for legacy accounts */
        assignedTrekIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Trek' }],
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        lastLoginAt: { type: Date, default: null },
    },
    { timestamps: true },
);

trekOrganizerAccountSchema.methods.comparePassword = function comparePassword(plain) {
    return bcrypt.compare(String(plain || ''), this.passwordHash);
};

trekOrganizerAccountSchema.statics.hashPassword = async function hashPassword(plain) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(String(plain), salt);
};

/** Normalize optional email — empty → undefined so sparse unique index allows many organizers without email. */
trekOrganizerAccountSchema.statics.normalizeOptionalEmail = function normalizeOptionalEmail(raw) {
    const email = String(raw || '').trim().toLowerCase();
    return email || undefined;
};

/**
 * One-time repair: Mongo unique index email_1 rejects multiple "".
 * Unset blank emails, then ensure sparse unique index.
 */
let emailIndexReady = false;
trekOrganizerAccountSchema.statics.ensureSparseEmailIndex = async function ensureSparseEmailIndex() {
    if (emailIndexReady) return;
    try {
        await this.updateMany(
            { $or: [{ email: '' }, { email: null }] },
            { $unset: { email: 1 } },
        );
        const indexes = await this.collection.indexes();
        const emailIdx = indexes.find((idx) => idx.name === 'email_1' || (idx.key && idx.key.email === 1));
        if (emailIdx && !emailIdx.sparse) {
            await this.collection.dropIndex(emailIdx.name);
        }
        await this.collection.createIndex({ email: 1 }, { unique: true, sparse: true, name: 'email_1' });
        emailIndexReady = true;
    } catch (err) {
        // Non-fatal — create path still omits empty email
        console.warn('[TrekOrganizerAccount] email index repair:', err.message);
    }
};

module.exports = mongoose.model('TrekOrganizerAccount', trekOrganizerAccountSchema);
