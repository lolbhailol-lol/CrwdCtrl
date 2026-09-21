'use strict';

const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  competitionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  kind: { type: String, required: true, enum: ['user', 'mis', 'phone', 'email'] },
  value: { type: String, required: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

claimSchema.index(
  { competitionId: 1, kind: 1, value: 1 },
  { unique: true, name: 'auditorium_unique_identity' },
);

module.exports = mongoose.models.MindSparkAuditoriumTicketClaim
  || mongoose.model('MindSparkAuditoriumTicketClaim', claimSchema);
