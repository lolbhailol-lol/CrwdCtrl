const mongoose = require('mongoose');
const { WORLD, RELIABILITY } = require('../constants');

// Each piece of evidence is a "node" belonging to one world (Physical/Digital/Human/Logic)
const evidenceNodeSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true, index: true },
    code: { type: String, required: true, trim: true }, // "EVD-CCTV-1703" — also shown to teams for reference

    world: { type: String, enum: Object.values(WORLD), required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true }, // the evidence content

    timestampLabel: { type: String, default: '' }, // "17:03" — for timeline reconstruction
    canonicalOrder: { type: Number, default: 0 }, // ground-truth sequence, for timeline scoring

    // ⚠️ Ground truth — never included in a player-facing response
    reliability: { type: String, enum: Object.values(RELIABILITY), required: true },

    // Discovery mechanism
    requiresQR: { type: Boolean, default: false },
    // Left unset (not null) for non-QR evidence — the sparse unique index only skips missing fields.
    qrSecret: { type: String },

    // Prerequisite chain — available only once these evidence are already unlocked
    unlockedByEvidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' }],
    // Set if this evidence is locked behind a branch choice
    unlockedByBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvestigationBranch', default: null },
    unlockedByLeadId: { type: String, default: null }, // which lead option within the branch

    // Ground truth — which evidence is "meaningfully connected" to this one (for connection scoring)
    connectsToEvidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' }],

    points: { type: Number, default: 10 },

    // "Mystery Fights Back" flag — this evidence can be invalidated mid-game
    canBeInvalidated: { type: Boolean, default: false },

    imageUrl: { type: String, default: '' },

    // Admin-only — where to stick/hide the QR (shown on the printed sheet, not to players)
    placementNote: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

evidenceNodeSchema.index({ caseId: 1, code: 1 }, { unique: true });
evidenceNodeSchema.index({ qrSecret: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.EvidenceNode || mongoose.model('EvidenceNode', evidenceNodeSchema);