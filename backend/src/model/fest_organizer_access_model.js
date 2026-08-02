const mongoose = require('mongoose');

/**
 * Permanent log of organizers who have signed into / opened a fest dashboard.
 * Not live presence — cumulative “who has logged in” for the team.
 */
const festOrganizerAccessSchema = new mongoose.Schema(
    {
        fest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizer',
            required: true,
            index: true,
        },
        organizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizerAccount',
            required: true,
            index: true,
        },
        name: { type: String, trim: true, default: '' },
        username: { type: String, trim: true, lowercase: true, default: '' },
        firstAccessAt: { type: Date, default: Date.now },
        lastAccessAt: { type: Date, default: Date.now, index: true },
        accessCount: { type: Number, default: 1, min: 1 },
    },
    { timestamps: true },
);

festOrganizerAccessSchema.index({ fest: 1, organizer: 1 }, { unique: true });
festOrganizerAccessSchema.index({ fest: 1, lastAccessAt: -1 });

module.exports = mongoose.model('FestOrganizerAccess', festOrganizerAccessSchema);
