const mongoose = require('mongoose');

// "Teams choose which lead to pursue" — a decision point that unlocks evidence branches
const investigationBranchSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true, index: true },
    order: { type: Number, required: true }, // when this branch's options should appear (per the narrative)
    prompt: { type: String, required: true }, // "Which lead do you pursue?"

    // Each lead is a "world/direction" — e.g. CCTV / Witness / Digital / Physical
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