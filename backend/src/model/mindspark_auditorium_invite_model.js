'use strict';

const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  fest: { type: mongoose.Schema.Types.ObjectId, ref: 'FestOrganizer', required: true, index: true },
  competitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  categoryId: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  maxUses: { type: Number, default: 1, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FestOrganizerAccount', default: null },
}, { timestamps: true });

inviteSchema.index({ competitionId: 1, code: 1 }, { unique: true });
inviteSchema.index({ fest: 1, active: 1 });

module.exports = mongoose.models.MindSparkAuditoriumInvite
  || mongoose.model('MindSparkAuditoriumInvite', inviteSchema);
