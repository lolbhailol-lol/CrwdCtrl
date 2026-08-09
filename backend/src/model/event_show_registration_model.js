const mongoose = require('mongoose');

/** One re-register / extra-lap purchase attached to a primary registration. */
const additionalEntrySchema = new mongoose.Schema(
  {
    tierId: { type: String, default: null },
    tierName: { type: String, default: null },
    selectedAddOns: { type: [mongoose.Schema.Types.Mixed], default: [] },
    amountPaid: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['free', 'pending', 'paid', 'failed'], default: 'free' },
    payment_gateway: { type: String, default: null },
    paymentScreenshotUrl: { type: String, default: '' },
    transactionId: { type: String, default: '' },
    payment_order_id: { type: String, default: null },
    payment_id: { type: String, default: null },
    /** Snapshot of form answers for this submit */
    responses: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const eventShowRegistrationSchema = new mongoose.Schema(
  {
    eventShow: { type: mongoose.Schema.Types.ObjectId, ref: 'EventShow', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    responses: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    payment_order_id: { type: String, default: null },
    payment_id: { type: String, default: null },
    payment_gateway: { type: String, default: null },
    paymentScreenshotUrl: { type: String, default: '' },
    transactionId: { type: String, default: '' },
    paymentStatus: { type: String, enum: ['free', 'pending', 'paid', 'failed'], default: 'free' },
    /** Running total across primary + all additionalEntries */
    amountPaid: { type: Number, default: 0 },
    /** Selected package when event uses pricingMode: tiers (first registration) */
    tierId: { type: String, default: null },
    tierName: { type: String, default: null },
    /** Snapshot of optional experiences purchased with the primary package. */
    selectedAddOns: { type: [mongoose.Schema.Types.Mixed], default: [] },
    /** Later registrations (2nd, 3rd, … Nth) for the same email/user */
    additionalEntries: { type: [additionalEntrySchema], default: [] },
    /** Count of re-registers after the primary (= additionalEntries.length) */
    reRegistrationCount: { type: Number, default: 0 },
    qrCodeData: { type: String, default: null },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Non-unique index for fast lookups (users may register multiple times — merged into one doc)
eventShowRegistrationSchema.index({ eventShow: 1, user: 1 });

const EventShowRegistration =
  mongoose.models.EventShowRegistration ||
  mongoose.model('EventShowRegistration', eventShowRegistrationSchema);

// Drop the legacy unique index if it exists so repeat registrations are allowed
const dropLegacyUniqueIndex = async () => {
  try {
    await EventShowRegistration.collection.dropIndex('eventShow_1_user_1');
    console.log('ℹ️ Dropped legacy unique index on EventShowRegistration');
  } catch {
    // Index may not exist — nothing to drop
  }
  // Ensure a non-unique index exists for fast lookups
  try {
    await EventShowRegistration.collection.createIndex({ eventShow: 1, user: 1 });
  } catch {
    /* ignore */
  }
};

if (mongoose.connection.readyState === 1) {
  dropLegacyUniqueIndex();
} else {
  mongoose.connection.once('open', dropLegacyUniqueIndex);
}

module.exports = EventShowRegistration;
