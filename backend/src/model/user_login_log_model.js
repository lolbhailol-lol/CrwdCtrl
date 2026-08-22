const mongoose = require('mongoose');

/**
 * Full login history — one document per successful sign-in.
 */
const userLoginLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        email: { type: String, trim: true, lowercase: true, default: '', index: true },
        name: { type: String, trim: true, default: '' },
        method: {
            type: String,
            enum: ['password', 'google', 'facebook', 'twitter', 'firebase'],
            default: 'password',
        },
        ip: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        device: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
        sessionId: { type: String, default: null, index: true },
        /** live = real sign-in; backfill = imported from user.lastLoginAt */
        source: { type: String, enum: ['live', 'backfill'], default: 'live' },
        lifetimeLoginCount: { type: Number, default: null },
    },
    { timestamps: true },
);

userLoginLogSchema.index({ createdAt: -1 });
userLoginLogSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('UserLoginLog', userLoginLogSchema);
