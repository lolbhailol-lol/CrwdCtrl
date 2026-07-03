const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const runClubOrganizerAccountSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        email: { type: String, trim: true, lowercase: true, default: '' },
        passwordHash: { type: String, required: true },
        phone: { type: String, trim: true, default: '' },
        runClubId: { type: mongoose.Schema.Types.ObjectId, ref: 'RunClub', default: null },
        isActive: { type: Boolean, default: true },
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

module.exports = mongoose.model('RunClubOrganizerAccount', runClubOrganizerAccountSchema);
