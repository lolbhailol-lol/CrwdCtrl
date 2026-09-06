const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected'];

const trekOrganizerAccountSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        // Optional — empty string must NOT be stored (unique index treats "" as a duplicate).
        // Required on self-serve signup (profile invite email).
        email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
        passwordHash: { type: String, required: true },
        phone: { type: String, trim: true, default: '' },
        communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrekCommunity', default: null },
        /** @deprecated Use communityId — kept for legacy accounts */
        assignedTrekIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Trek' }],
        /** pending = awaiting admin; approved = can log in; rejected = denied */
        status: {
            type: String,
            enum: ACCOUNT_STATUSES,
            default: 'pending',
            index: true,
        },
        isActive: { type: Boolean, default: false },
        approvedAt: { type: Date, default: null },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejectedReason: { type: String, trim: true, default: '' },
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
 * Back-compat: older accounts have no status field.
 * Treat missing status + isActive as approved; inactive legacy as rejected.
 */
trekOrganizerAccountSchema.statics.effectiveStatus = function effectiveStatus(org) {
    if (!org) return 'rejected';
    if (org.status && ACCOUNT_STATUSES.includes(org.status)) return org.status;
    return org.isActive !== false ? 'approved' : 'rejected';
};

trekOrganizerAccountSchema.statics.canLogin = function canLogin(org) {
    if (!org) return false;
    const status = this.effectiveStatus(org);
    return status === 'approved' && org.isActive !== false;
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
        // Legacy admin-created accounts: active with no status → approved
        await this.updateMany(
            {
                isActive: true,
                $or: [{ status: { $exists: false } }, { status: null }],
            },
            {
                $set: {
                    status: 'approved',
                    approvedAt: new Date(),
                },
            },
        );
        const indexes = await this.collection.indexes();
        const emailIdx = indexes.find((idx) => idx.name === 'email_1' || (idx.key && idx.key.email === 1));
        if (emailIdx && !emailIdx.sparse) {
            await this.collection.dropIndex(emailIdx.name);
        }
        await this.collection.createIndex({ email: 1 }, { unique: true, sparse: true, name: 'email_1' });
        emailIndexReady = true;
    } catch (err) {
        console.warn('[TrekOrganizerAccount] email index repair:', err.message);
    }
};

module.exports = mongoose.model('TrekOrganizerAccount', trekOrganizerAccountSchema);
module.exports.ACCOUNT_STATUSES = ACCOUNT_STATUSES;
