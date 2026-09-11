const mongoose = require('mongoose');

/**
 * Who signed into the fest organizer portal — name typed on the login page.
 * Cumulative list (not live status). Shared accounts can each write their own name.
 */
const festOrganizerLoginLogSchema = new mongoose.Schema(
    {
        organizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizerAccount',
            required: true,
            index: true,
        },
        username: { type: String, trim: true, lowercase: true, default: '' },
        /** Name typed on the login form */
        displayName: { type: String, trim: true, required: true, maxlength: 80 },
        displayNameKey: { type: String, trim: true, lowercase: true, required: true, index: true },
        firstLoginAt: { type: Date, default: Date.now },
        lastLoginAt: { type: Date, default: Date.now, index: true },
        loginCount: { type: Number, default: 1, min: 1 },
    },
    { timestamps: true },
);

festOrganizerLoginLogSchema.index(
    { organizer: 1, displayNameKey: 1 },
    { unique: true },
);

module.exports = mongoose.model('FestOrganizerLoginLog', festOrganizerLoginLogSchema);
