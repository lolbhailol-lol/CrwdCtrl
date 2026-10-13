const mongoose = require('mongoose');
const { WORLD, RELIABILITY } = require('../constants');

// Har evidence ek "node" hai jo kisi ek world (Physical/Digital/Human/Logic) ka hissa hai
const evidenceNodeSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true, index: true },
    code: { type: String, required: true, trim: true }, // "EVD-CCTV-1703" — team ko bhi dikhta hai, reference ke liye

    world: { type: String, enum: Object.values(WORLD), required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true }, // evidence ka content

    timestampLabel: { type: String, default: '' }, // "17:03" — timeline-reconstruction ke liye
    canonicalOrder: { type: Number, default: 0 }, // ground-truth sequence, timeline-scoring ke liye

    // ⚠️ Ground truth — kabhi bhi player-facing response me nahi jaata
    reliability: { type: String, enum: Object.values(RELIABILITY), required: true },

    // Discovery mechanism
    requiresQR: { type: Boolean, default: false },
    qrSecret: { type: String, default: null },

    // Prerequisite chain — tabhi available hota hai jab ye evidence already unlocked ho
    unlockedByEvidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' }],
    // Agar kisi branch-choice ke peeche locked hai
    unlockedByBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvestigationBranch', default: null },
    unlockedByLeadId: { type: String, default: null }, // branch ke andar kaunsa lead option

    // Ground truth — kaunse evidence isse "meaningfully connected" hain (connection-scoring ke liye)
    connectsToEvidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' }],

    points: { type: Number, default: 10 },

    // "Mystery Fights Back" ke liye flag — isko invalidate kiya ja sakta hai beech game me
    canBeInvalidated: { type: Boolean, default: false },

    imageUrl: { type: String, default: '' },
  },
  { timestamps: true },
);

evidenceNodeSchema.index({ caseId: 1, code: 1 }, { unique: true });
evidenceNodeSchema.index({ qrSecret: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.EvidenceNode || mongoose.model('EvidenceNode', evidenceNodeSchema);