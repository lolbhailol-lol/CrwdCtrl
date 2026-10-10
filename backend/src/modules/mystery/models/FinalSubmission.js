const mongoose = require('mongoose');

const finalSubmissionSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryTeam', required: true, unique: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true },

    reconstructedTimeline: [
      { timeLabel: String, eventDescription: String, evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' } },
    ],

    // Har collect ki hui evidence pe team ka final verdict — ground-truth reliability se compare hoga
    evidenceVerdicts: [
      {
        evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode' },
        verdict: { type: String, enum: ['reliable', 'unreliable'] },
      },
    ],

    identityTheory: { type: String, required: true }, // "A-17 kaun/kya hai" — team ka theory
    fullExplanation: { type: String, required: true },
    confidenceLevel: { type: Number, min: 0, max: 100, default: 50 }, // risk/confidence bonus ke liye

    submittedAt: { type: Date, default: Date.now },

    // Scoring breakdown — kuch auto-calculate hota hai, theoryPoints admin manually grade karta hai
    scoreBreakdown: {
      missionPoints: { type: Number, default: 0 }, // evidence discovery se aaya hua total
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