const mongoose = require('mongoose');

const ACTIVITY_EVENT_TYPES = [
    'page_view',
    'page_engagement',
    'fest_view',
    'competition_view',
    'registration',
    'search',
    'login',
    'signup',
    'book_now_click',
];

/**
 * Per-user activity — page views, engagement time, and key actions.
 */
const userActivityLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        email: { type: String, trim: true, lowercase: true, default: '', index: true },
        sessionId: { type: String, default: null, index: true },
        eventType: {
            type: String,
            enum: ACTIVITY_EVENT_TYPES,
            required: true,
            index: true,
        },
        page: { type: String, default: '', index: true },
        previousPage: { type: String, default: '' },
        durationSeconds: { type: Number, default: 0, min: 0 },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        ip: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        device: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
        /** live = tracked in real time; backfill = imported from legacy Analytics */
        source: { type: String, enum: ['live', 'backfill'], default: 'live' },
        sourceAnalyticsId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    { timestamps: true },
);

userActivityLogSchema.index({ sourceAnalyticsId: 1 }, { unique: true, sparse: true });

userActivityLogSchema.index({ createdAt: -1 });
userActivityLogSchema.index({ email: 1, createdAt: -1 });
userActivityLogSchema.index({ sessionId: 1, createdAt: -1 });
// Keep activity logs for 1 year
userActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('UserActivityLog', userActivityLogSchema);
module.exports.ACTIVITY_EVENT_TYPES = ACTIVITY_EVENT_TYPES;
