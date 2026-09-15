const mongoose = require('mongoose');

const ENTITY_TYPES = ['trek_community', 'run_club'];

const communityFollowSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        entityType: {
            type: String,
            enum: ENTITY_TYPES,
            required: true,
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
    },
    { timestamps: true },
);

communityFollowSchema.index(
    { userId: 1, entityType: 1, entityId: 1 },
    { unique: true },
);
communityFollowSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.models.CommunityFollow
    || mongoose.model('CommunityFollow', communityFollowSchema);
module.exports.ENTITY_TYPES = ENTITY_TYPES;
