'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  competitionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  // Legacy authenticated challenges may carry a userId. New public OTP challenges
  // are bound to the verified college email instead, so Google login is unnecessary.
  userId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  emailHash: { type: String, required: true },
  categoryId: { type: String, required: true },
  codeHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  verifiedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ competitionId: 1, emailHash: 1, lastSentAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.models.MindSparkAuditoriumOtp
  || mongoose.model('MindSparkAuditoriumOtp', schema);
