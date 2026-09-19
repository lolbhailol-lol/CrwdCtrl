'use strict';

const mongoose = require('mongoose');

/**
 * Atomic per-category seat counters for MindSpark Auditorium.
 * claim: findOneAndUpdate filled < seats, $inc filled
 */
const counterSchema = new mongoose.Schema({
  competitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true },
  categoryId: { type: String, required: true, trim: true },
  filled: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

counterSchema.index({ competitionId: 1, categoryId: 1 }, { unique: true });

module.exports = mongoose.models.AuditoriumSeatCounter
  || mongoose.model('AuditoriumSeatCounter', counterSchema);
