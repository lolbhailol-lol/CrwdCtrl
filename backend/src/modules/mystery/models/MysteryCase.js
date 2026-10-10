const mongoose = require('mongoose');

// Ye poore case ka "header" hai — "The 17-Minute Gap" jaisa
const mysteryCaseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true }, // "CTRL Mystery"
    tagline: { type: String, default: '', trim: true }, // "The 17-Minute Gap"
    synopsis: { type: String, required: true }, // intro-narrative jo pehli screen pe dikhega

    // Central mystery-identity jo teams ko figure out karna hai (jaise "A-17")
    mysteryIdentityName: { type: String, default: '' }, // "A-17"
    mysteryIdentityPrompt: { type: String, default: 'Who or what is this identity?' },

    difficulty: { type: String, enum: ['rookie', 'detective', 'master'], default: 'detective' },
    estimatedMinutes: { type: Number, default: 90 },

    campusMode: { type: Boolean, default: true },
    college: { type: String, default: '', trim: true },

    // Final theory verdict evaluate karne ke liye admin ka "correct answer" reference (hidden from players)
    correctIdentityTheory: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByRole: { type: String, enum: ['admin', 'self_serve_organizer'], default: 'admin' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true },
);

mysteryCaseSchema.index({ status: 1, difficulty: 1 });

module.exports = mongoose.models.MysteryCase || mongoose.model('MysteryCase', mysteryCaseSchema);