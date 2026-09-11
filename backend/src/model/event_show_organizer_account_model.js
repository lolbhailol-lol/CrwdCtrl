const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected'];

const eventShowOrganizerAccountSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        email: { type: String, trim: true, lowercase: true, default: '' },
        passwordHash: { type: String, required: true },
        phone: { type: String, trim: true, default: '' },
        /** EventShows this organizer can manage */
        assignedEventShowIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EventShow' }],
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

eventShowOrganizerAccountSchema.methods.comparePassword = function comparePassword(plain) {
    return bcrypt.compare(String(plain || ''), this.passwordHash);
};

eventShowOrganizerAccountSchema.statics.hashPassword = async function hashPassword(plain) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(String(plain), salt);
};

eventShowOrganizerAccountSchema.statics.effectiveStatus = function effectiveStatus(org) {
    if (!org) return 'rejected';
    if (org.status && ACCOUNT_STATUSES.includes(org.status)) return org.status;
    return org.isActive !== false ? 'approved' : 'rejected';
};

eventShowOrganizerAccountSchema.statics.canLogin = function canLogin(org) {
    if (!org) return false;
    return this.effectiveStatus(org) === 'approved' && org.isActive !== false;
};

module.exports = mongoose.model('EventShowOrganizerAccount', eventShowOrganizerAccountSchema);
module.exports.ACCOUNT_STATUSES = ACCOUNT_STATUSES;
