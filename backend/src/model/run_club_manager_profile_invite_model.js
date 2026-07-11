const mongoose = require('mongoose');

/**
 * Emails allowed to see "Club manager" in the consumer Profile sidebar.
 * Separate from organizer account approval (username/password signup).
 */
const runClubManagerProfileInviteSchema = new mongoose.Schema(
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

runClubManagerProfileInviteSchema.index({ email: 1, isActive: 1 });

module.exports =
    mongoose.models.RunClubManagerProfileInvite
    || mongoose.model('RunClubManagerProfileInvite', runClubManagerProfileInviteSchema);
