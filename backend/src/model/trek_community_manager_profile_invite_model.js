const mongoose = require('mongoose');

/**
 * Emails allowed to see "Trek community" in the consumer Profile sidebar
 * and request trek organizer signup. Separate from account approval.
 */
const trekCommunityManagerProfileInviteSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        note: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true },
);

trekCommunityManagerProfileInviteSchema.index({ email: 1, isActive: 1 });

module.exports =
    mongoose.models.TrekCommunityManagerProfileInvite
    || mongoose.model('TrekCommunityManagerProfileInvite', trekCommunityManagerProfileInviteSchema);
