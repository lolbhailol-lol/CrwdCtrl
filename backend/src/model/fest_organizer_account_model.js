const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected'];

const festOrganizerAccountSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
        passwordHash: { type: String, required: true },
        phone: { type: String, trim: true, default: '' },
        assignedFestIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FestOrganizer' }],
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

festOrganizerAccountSchema.methods.comparePassword = function comparePassword(plain) {
    return bcrypt.compare(String(plain || ''), this.passwordHash);
};

festOrganizerAccountSchema.statics.hashPassword = async function hashPassword(plain) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(String(plain), salt);
};

festOrganizerAccountSchema.statics.normalizeOptionalEmail = function normalizeOptionalEmail(raw) {
    const email = String(raw || '').trim().toLowerCase();
    return email || undefined;
};

festOrganizerAccountSchema.statics.effectiveStatus = function effectiveStatus(org) {
    if (!org) return 'rejected';
    if (org.status && ACCOUNT_STATUSES.includes(org.status)) return org.status;
    return org.isActive !== false ? 'approved' : 'rejected';
};

festOrganizerAccountSchema.statics.canLogin = function canLogin(org) {
    if (!org) return false;
    return this.effectiveStatus(org) === 'approved' && org.isActive !== false;
};

let emailIndexReady = false;
festOrganizerAccountSchema.statics.ensureSparseEmailIndex = async function ensureSparseEmailIndex() {
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
        console.warn('[FestOrganizerAccount] email index repair:', err.message);
    }
};

module.exports = mongoose.model('FestOrganizerAccount', festOrganizerAccountSchema);
module.exports.ACCOUNT_STATUSES = ACCOUNT_STATUSES;
