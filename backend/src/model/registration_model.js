const mongoose = require('mongoose');
const crypto = require('crypto');

const registrationSchema = new mongoose.Schema({
  fest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FestOrganizer',
    required: true,
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  competitionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competition',
    required: false, // Optional - only for competition registrations
  },

  /** Pro Show / Pro Night ticket (not a competition entry) */
  isProShow: {
    type: Boolean,
    default: false,
    index: true,
  },
  proShowTierId: {
    type: String,
    trim: true,
    default: '',
  },
  /** online = paid/public; offline/vip/guest/press/crew = issued at desk */
  proShowPassType: {
    type: String,
    enum: ['online', 'offline', 'vip', 'guest', 'press', 'crew'],
    default: 'online',
  },

  responses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed, // Can store any type of value
    default: {}
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  // QR Code check-in fields
  qrCodeData: {
    type: String,
    unique: true,
    sparse: true,
  },
  checkedIn: {
    type: Boolean,
    default: false,
  },
  checkedInAt: {
    type: Date,
    default: null,
  },

  /** Organizer-marked: joined this competition's WhatsApp group */
  whatsappGroupJoined: {
    type: Boolean,
    default: false,
  },
  whatsappGroupJoinedAt: {
    type: Date,
    default: null,
  },

  // Reminder tracking
  reminderSent: {
    type: Boolean,
    default: false,
  },

  payment_order_id: {
    type: String,
    default: null,
  },
  payment_id: {
    type: String,
    default: null,
  },
  payment_gateway: {
    type: String,
    default: null,
  },
  paymentStatus: {
    type: String,
    enum: ['free', 'pending', 'paid', 'failed'],
    default: 'free',
  },
  amountPaid: {
    type: Number,
    default: 0, // in INR
  },
  /** Estimated Cashfree cut (1.6% of amountPaid). Not overwritten onto amountPaid. */
  gatewayFee: {
    type: Number,
    default: 0,
  },
  /** amountPaid minus estimated Cashfree gateway fee (manual paid keeps amountPaid). */
  netToOrganizer: {
    type: Number,
    default: 0,
  },

  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Non-unique index for fast lookups. Users are allowed to register multiple
// times for the same fest/competition — duplicate-payment protection is handled
// by payment_order_id-scoped idempotency in the controllers instead.
registrationSchema.index({ fest: 1, user: 1, competitionId: 1 });
registrationSchema.index({ user: 1, submittedAt: -1 });
registrationSchema.index({ fest: 1, status: 1 });
registrationSchema.index({ fest: 1, isProShow: 1, status: 1 });
registrationSchema.index({ reminderSent: 1, status: 1 });
registrationSchema.index(
  { payment_order_id: 1 },
  {
    unique: true,
    name: 'payment_order_id_unique_paid',
    partialFilterExpression: {
      payment_order_id: { $type: 'string', $gt: '' },
    },
  },
);

registrationSchema.pre('save', function assignQrCodeData(next) {
  if (!this.qrCodeData) {
    this.qrCodeData = crypto.randomBytes(16).toString('hex');
  }
  next();
});

const Registration = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);

// Drop the legacy unique index if it exists so repeat registrations are allowed.
// Without this, a second registration insert throws E11000 → 500 → user bounced
// back to the form even after a successful payment.
const dropLegacyRegistrationUniqueIndex = async () => {
  try {
    const indexes = await Registration.collection.indexes();
    const legacy = indexes.find(
      (idx) => idx.unique && idx.key && idx.key.fest === 1 && idx.key.user === 1 && idx.key.competitionId === 1
    );
    if (legacy) {
      await Registration.collection.dropIndex(legacy.name);
      console.log('ℹ️ Dropped legacy unique index on Registration:', legacy.name);
    }
  } catch {
    // Index may not exist — nothing to drop
  }
  try {
    await Registration.collection.createIndex({ fest: 1, user: 1, competitionId: 1 });
  } catch {
    /* ignore */
  }
  try {
    await Registration.collection.createIndex(
      { payment_order_id: 1 },
      {
        unique: true,
        name: 'payment_order_id_unique_paid',
        partialFilterExpression: {
          payment_order_id: { $type: 'string', $gt: '' },
        },
      },
    );
  } catch {
    /* duplicates or already exists — controllers still de-dupe by findOne */
  }
};

if (mongoose.connection.readyState === 1) {
  dropLegacyRegistrationUniqueIndex();
} else {
  mongoose.connection.once('open', dropLegacyRegistrationUniqueIndex);
}

module.exports = Registration;