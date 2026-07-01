const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const trekOrganizerAccountSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        email: { type: String, trim: true, lowercase: true, default: '' },
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
    return bcrypt.hash(String(plain), 10);
};

module.exports = mongoose.model('TrekOrganizerAccount', trekOrganizerAccountSchema);
