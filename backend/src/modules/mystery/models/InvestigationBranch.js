const mongoose = require('mongoose');

// "Teams choose which lead to pursue" — ek decision-point jo evidence-branches unlock karta hai
const investigationBranchSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true, index: true },
    order: { type: Number, required: true }, // kab is branch ka option dikhna chahiye (narrative ke hisaab se)
    prompt: { type: String, required: true }, // "Which lead do you pursue?"

    // Har lead ek "world/direction" hai — CCTV / Witness / Digital / Physical jaisa
    leads: [
      {
        id: { type: String, required: true }, // "cctv", "witness", "digital", "physical"
        label: { type: String, required: true },
        description: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true },
);

investigationBranchSchema.index({ caseId: 1, order: 1 });

module.exports = mongoose.models.InvestigationBranch || mongoose.model('InvestigationBranch', investigationBranchSchema);