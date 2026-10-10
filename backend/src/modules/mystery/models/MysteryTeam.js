const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { TEAM_MODE } = require('../constants');

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    contactNo: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    collegeStudentId: { type: String, default: '', trim: true },
    idProofUrl: { type: String, default: '' },
    isCaptain: { type: Boolean, default: false },
  },
  { _id: false },
);

const mysteryTeamSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryEvent', default: null },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true },

    teamName: { type: String, required: true, trim: true },
    captainUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },

    mode: { type: String, enum: Object.values(TEAM_MODE), required: true },

    // NEW — standalone Mystery login (team-code + password, campus-hunt jaisa)
    teamCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    passwordHash: { type: String, default: null, select: false },

    paymentStatus: { type: String, enum: ['not_required', 'pending', 'paid', 'failed'], default: 'not_required' },
    amountPaid: { type: Number, default: 0 },

    gamePassCode: { type: String, unique: true, sparse: true },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true },
);

mysteryTeamSchema.index(
  { eventId: 1, captainUserId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $type: 'objectId' } } },
);

mysteryTeamSchema.methods.setPassword = async function setPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(String(plain), salt);
};

mysteryTeamSchema.methods.comparePassword = async function comparePassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(String(plain), this.passwordHash);
};

module.exports = mongoose.models.MysteryTeam || mongoose.model('MysteryTeam', mysteryTeamSchema);