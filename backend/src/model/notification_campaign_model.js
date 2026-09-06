const mongoose = require('mongoose');

const notificationCampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    link: { type: String, default: '', trim: true, maxlength: 500 },
    channels: {
      type: [String],
      enum: ['inApp', 'push', 'email'],
      default: ['inApp'],
    },
    audience: {
      type: { type: String, required: true },
      filters: { type: mongoose.Schema.Types.Mixed, default: {} },
      label: { type: String, default: '' },
      resolvedCount: { type: Number, default: 0 },
      selectedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    status: {
      type: String,
      enum: ['draft', 'sending', 'completed', 'failed'],
      default: 'draft',
    },
    stats: {
      targeted: { type: Number, default: 0 },
      inApp: { type: Number, default: 0 },
      push: { type: Number, default: 0 },
      email: { type: Number, default: 0 },
      skippedPrefs: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    isTest: { type: Boolean, default: false },
    about: {
      kind: { type: String, default: '' },
      id: { type: String, default: '' },
    },
    eventContext: { type: mongoose.Schema.Types.Mixed, default: null },
    createdBy: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationCampaignSchema.index({ createdAt: -1 });
notificationCampaignSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationCampaign', notificationCampaignSchema);
