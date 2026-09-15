const mongoose = require('mongoose');

/**
 * Emails allowed to see "Event organizer" in the consumer Profile sidebar.
 * Separate from organizer account approval (username/password signup).
 */
const eventShowManagerProfileInviteSchema = new mongoose.Schema(
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

eventShowManagerProfileInviteSchema.index({ email: 1, isActive: 1 });

module.exports =
    mongoose.models.EventShowManagerProfileInvite
    || mongoose.model('EventShowManagerProfileInvite', eventShowManagerProfileInviteSchema);
