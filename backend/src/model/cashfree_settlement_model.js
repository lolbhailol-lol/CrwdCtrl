const mongoose = require('mongoose');

/**
 * Cashfree settlement snapshot keyed by merchant order id.
 * Never overwrite PaymentOrder/registration amounts from this collection.
 */
const cashfreeSettlementSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    cfSettlementId: { type: String, default: null, trim: true },
    cfPaymentId: { type: String, default: null, trim: true },
    settlementAmount: { type: Number, default: null },
    serviceCharge: { type: Number, default: null },
    serviceTax: { type: Number, default: null },
    /** Cashfree settlement_details.status: SUCCESS, PENDING, FAILED, ... */
    status: { type: String, default: null, trim: true },
    statusDescription: { type: String, default: null, trim: true },
    /** Only set when Cashfree returns a transfer/settlement timestamp. Never invented. */
    transferTime: { type: Date, default: null },
    transferUtr: { type: String, default: null, trim: true },
    source: {
      type: String,
      enum: ['api', 'webhook', 'csv'],
      default: 'api',
    },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

cashfreeSettlementSchema.index({ cfSettlementId: 1 }, { sparse: true });
cashfreeSettlementSchema.index({ cfPaymentId: 1 }, { sparse: true });

module.exports =
  mongoose.models.CashfreeSettlement ||
  mongoose.model('CashfreeSettlement', cashfreeSettlementSchema);
