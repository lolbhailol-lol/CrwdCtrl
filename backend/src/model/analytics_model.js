const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ['page_view', 'registration', 'fest_view', 'competition_view', 'search', 'login', 'signup'],
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  sessionId: {
    type: String,
    default: null,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

// Indexes for fast aggregation queries
analyticsSchema.index({ eventType: 1, createdAt: -1 });
analyticsSchema.index({ 'metadata.festId': 1 });
analyticsSchema.index({ 'metadata.competitionId': 1 });
analyticsSchema.index({ sessionId: 1, createdAt: -1 });
// TTL: auto-delete analytics older than 90 days
analyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Analytics', analyticsSchema);
