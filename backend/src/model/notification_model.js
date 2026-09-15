const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['event', 'reminder', 'registration', 'update', 'system', 'announcement'],
    default: 'system',
  },
  link: {
    type: String, // Optional URL to navigate to
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  metadata: {
    festId: { type: mongoose.Schema.Types.ObjectId, ref: 'FestOrganizer' },
    competitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition' },
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    trekId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trek' },
    source: { type: String },
  },
}, { timestamps: true });

// Indexes for fast queries
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
// TTL: auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
