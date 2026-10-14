const mongoose = require('mongoose');
const { UNLOCK_SOURCE, PROGRESS_STATUS } = require('../constants');

const teamInvestigationProgressSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryTeam', required: true, unique: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryEvent', default: null },

    unlockedEvidence: [
      {
        evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' },
        source: { type: String, enum: Object.values(UNLOCK_SOURCE) },
        unlockedAt: { type: Date, default: Date.now },
        // Set if later invalidated by "Mystery Fights Back"
        invalidatedAt: { type: Date, default: null },
      },
    ],

    // The team's own trust decision — "do we believe this evidence or not"
    trustDecisions: [
      {
        evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' },
        trusted: { type: Boolean },
        decidedAt: { type: Date, default: Date.now },
      },
    ],

    branchChoices: [
      {
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvestigationBranch' },
        chosenLeadId: { type: String },
        chosenAt: { type: Date, default: Date.now },
      },
    ],

    // Pairs of evidence the team marked as "connected" — compared with the ground truth during scoring
    connectionsMade: [
      {
        evidenceIdA: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' },
        evidenceIdB: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' },
        madeAt: { type: Date, default: Date.now },
      },
    ],

    fightsBackAcknowledged: [
      {
        fightsBackEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'FightsBackEvent' },
        acknowledgedAt: { type: Date, default: Date.now },
      },
    ],

    totalScore: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    status: { type: String, enum: Object.values(PROGRESS_STATUS), default: PROGRESS_STATUS.ACTIVE },
  },
  { timestamps: true },
);

module.exports = mongoose.models.TeamInvestigationProgress
  || mongoose.model('TeamInvestigationProgress', teamInvestigationProgressSchema);