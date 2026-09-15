const mongoose = require('mongoose');

const reconRowSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['matched', 'unmatched_cashfree', 'unmatched_crwdctrl', 'amount_mismatch', 'duplicate'],
      required: true,
    },
    orderId: { type: String, default: '', trim: true },
    paymentId: { type: String, default: '', trim: true },
    cashfreeAmount: { type: Number, default: null },
    crwdctrlAmount: { type: Number, default: null },
    paymentStatus: { type: String, default: '', trim: true },
    note: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const reconciliationImportSchema = new mongoose.Schema(
  {
    fileName: { type: String, default: '', trim: true },
    uploadedBy: { type: String, default: '', trim: true },
    rowCount: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    unmatchedCashfreeCount: { type: Number, default: 0 },
    unmatchedCrwdctrlCount: { type: Number, default: 0 },
    amountMismatchCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    rows: { type: [reconRowSchema], default: [] },
  },
  { timestamps: true },
);

reconciliationImportSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.ReconciliationImport ||
  mongoose.model('ReconciliationImport', reconciliationImportSchema);
