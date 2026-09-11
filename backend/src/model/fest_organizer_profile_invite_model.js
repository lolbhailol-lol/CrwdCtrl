const mongoose = require('mongoose');

const festOrganizerProfileInviteSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, trim: true, lowercase: true, unique: true },
        note: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true },
);

module.exports = mongoose.model('FestOrganizerProfileInvite', festOrganizerProfileInviteSchema);
