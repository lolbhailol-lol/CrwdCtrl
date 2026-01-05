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

  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Allow multiple registrations per user per fest - no unique index

module.exports = mongoose.model('Registration', registrationSchema);