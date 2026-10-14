const mongoose = require('mongoose');

const finalSubmissionSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryTeam', required: true, unique: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true },

    reconstructedTimeline: [
      { timeLabel: String, eventDescription: String, evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' } },
    ],

    // The team's final verdict on each collected evidence — compared with ground-truth reliability
    evidenceVerdicts: [
      {
        evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' },
        verdict: { type: String, enum: ['reliable', 'unreliable'] },
      },
    ],

    identityTheory: { type: String, required: true }, // "Who/what is A-17" — the team's theory
    fullExplanation: { type: String, required: true },
    confidenceLevel: { type: Number, min: 0, max: 100, default: 50 }, // for the risk/confidence bonus

    submittedAt: { type: Date, default: Date.now },

    // Scoring breakdown — mostly auto-calculated; theoryPoints are graded manually by an admin
    scoreBreakdown: {
      missionPoints: { type: Number, default: 0 }, // total earned from evidence discovery
      connectionPoints: { type: Number, default: 0 },
      timelinePoints: { type: Number, default: 0 },
      verdictPoints: { type: Number, default: 0 },
      theoryPoints: { type: Number, default: 0 }, // admin grades this
      confidenceBonus: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    graded: { type: Boolean, default: false },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.models.FinalSubmission || mongoose.model('FinalSubmission', finalSubmissionSchema);