const mongoose = require('mongoose');

const festTransferReceiptSchema = new mongoose.Schema(
  {
    festId: { type: mongoose.Schema.Types.ObjectId, ref: 'FestOrganizer', required: true, index: true },
    destination: { type: String, trim: true, default: 'COEP account' },
    amount: { type: Number, required: true, min: 0.01 },
    transferredAt: { type: Date, required: true, index: true },
    proofUrl: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: '', maxlength: 500 },
    status: { type: String, enum: ['successful'], default: 'successful' },
    createdBy: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

festTransferReceiptSchema.index(
  { festId: 1, transferredAt: 1, amount: 1 },
  { unique: true },
);

module.exports = mongoose.models.FestTransferReceipt
  || mongoose.model('FestTransferReceipt', festTransferReceiptSchema);
