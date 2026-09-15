const mongoose = require('mongoose');

const organizerPayoutSchema = new mongoose.Schema(
  {
    organizerType: {
      type: String,
      enum: ['fest', 'run_club', 'trek_community', 'event_show', 'unknown'],
      required: true,
    },
    organizerId: { type: String, required: true, trim: true },
    organizerName: { type: String, default: '', trim: true },
    bucket: {
      type: String,
      enum: ['mindspark', 'touch_grass', 'other'],
      default: 'other',
    },
    eventId: { type: String, default: '', trim: true },
    eventName: { type: String, default: '', trim: true },
    amount: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'ready', 'paid'],
      default: 'pending',
    },
    /** Ledger batch metadata so transaction rows stay marked paid after Monday clear / T+2 mark-paid. */
    batchKind: {
      type: String,
      enum: ['monday_clear', 'tplus_ready', 'tplus_waiting', 'organizer', ''],
      default: '',
    },
    clearMondayYmd: { type: String, default: '', trim: true },
    orderIds: { type: [String], default: [] },
    paidAt: { type: Date, default: null },
    note: { type: String, default: '', trim: true },
    createdBy: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

organizerPayoutSchema.index({ organizerType: 1, organizerId: 1, eventId: 1, bucket: 1 });
organizerPayoutSchema.index({ status: 1, updatedAt: -1 });
organizerPayoutSchema.index({ clearMondayYmd: 1, bucket: 1, status: 1 });

module.exports =
  mongoose.models.OrganizerPayout || mongoose.model('OrganizerPayout', organizerPayoutSchema);
