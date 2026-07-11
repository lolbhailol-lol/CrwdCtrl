const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected'];

const runClubOrganizerAccountSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        email: { type: String, trim: true, lowercase: true, default: '' },
        passwordHash: { type: String, required: true },
        phone: { type: String, trim: true, default: '' },
        runClubId: { type: mongoose.Schema.Types.ObjectId, ref: 'RunClub', default: null },
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

runClubOrganizerAccountSchema.methods.comparePassword = function comparePassword(plain) {
    return bcrypt.compare(String(plain || ''), this.passwordHash);
};

runClubOrganizerAccountSchema.statics.hashPassword = async function hashPassword(plain) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(String(plain), salt);
};

/**
 * Back-compat: older accounts have no status field.
 * Treat missing status + isActive as approved; inactive legacy as rejected.
 */
runClubOrganizerAccountSchema.statics.effectiveStatus = function effectiveStatus(org) {
    if (!org) return 'rejected';
    if (org.status && ACCOUNT_STATUSES.includes(org.status)) return org.status;
    return org.isActive !== false ? 'approved' : 'rejected';
};

runClubOrganizerAccountSchema.statics.canLogin = function canLogin(org) {
    if (!org) return false;
    const status = this.effectiveStatus(org);
    return status === 'approved' && org.isActive !== false;
};

module.exports = mongoose.model('RunClubOrganizerAccount', runClubOrganizerAccountSchema);
module.exports.ACCOUNT_STATUSES = ACCOUNT_STATUSES;
