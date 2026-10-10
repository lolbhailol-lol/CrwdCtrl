const mongoose = require('mongoose');

// "At a critical stage, teams receive a system update" — ek evidence ko false declare karna
const fightsBackEventSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true, index: true },
    triggerAfterEvidenceCount: { type: Number, required: true }, // team ke N evidence unlock karne ke baad trigger
    invalidatedEvidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode', required: true },
    systemMessage: { type: String, required: true }, // "UPDATE: Evidence EVD-CCTV-1703 has been flagged unreliable..."
  },
  { timestamps: true },
);

module.exports = mongoose.models.FightsBackEvent || mongoose.model('FightsBackEvent', fightsBackEventSchema);