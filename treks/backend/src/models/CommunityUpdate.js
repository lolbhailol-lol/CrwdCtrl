import mongoose from 'mongoose'

const communityUpdateSchema = new mongoose.Schema(
  {
    trekSlug: { type: String, required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 280 },
    statusTag: {
      type: String,
      enum: ['ok', 'info', 'warning', 'alert'],
      default: 'info',
    },
    displayName: { type: String, trim: true, maxlength: 60, default: '' },
    communityName: { type: String, trim: true, maxlength: 80, default: '' },
  },
  {
    collection: 'community_updates',
    timestamps: { createdAt: true, updatedAt: false },
  },
)

// Newest-per-trail is the only read pattern we have
communityUpdateSchema.index({ trekSlug: 1, createdAt: -1 })

export default mongoose.model('CommunityUpdate', communityUpdateSchema)
