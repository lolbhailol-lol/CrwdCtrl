const mongoose = require('mongoose');

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

  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// ✅ PREVENT DUPLICATE REGISTRATIONS: Unique compound index
// A user can only register once per competition per fest
registrationSchema.index(
  { fest: 1, user: 1, competitionId: 1 }, 
  { unique: true, sparse: true }
);

module.exports = mongoose.model('Registration', registrationSchema);