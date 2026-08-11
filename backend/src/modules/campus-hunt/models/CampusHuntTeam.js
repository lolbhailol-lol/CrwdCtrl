const mongoose = require('mongoose');
const { TEAM_STAGES, TEAM_STATUSES } = require('../constants');

const campusHuntTeamSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      required: true,
      index: true,
    },
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntRound',
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntRoute',
      index: true,
    },
    startingPointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntStartingPoint',
      index: true,
    },
    scheduledStartAt: { type: Date, index: true },
    actualStartAt: { type: Date },
    startStatus: {
      type: String,
      enum: ['WAITING', 'READY', 'RELEASED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'WAITING',
      index: true,
    },
    clue1ChallengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntChallenge',
      index: true,
    },
    firstCheckpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntCheckpoint',
      index: true,
    },
    clue2ChallengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntChallenge',
      index: true,
    },
    secondCheckpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntCheckpoint',
      index: true,
    },
    clue3ChallengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntChallenge',
      index: true,
    },
    thirdCheckpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntCheckpoint',
      index: true,
    },
    teamCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    teamName: { type: String, required: true, trim: true },
    leaderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    memberUserIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length <= 3;
        },
        message: 'A team may have at most 3 members besides the leader',
      },
    },
    /** Leader display name */
    leaderName: { type: String, default: '', trim: true },
    leaderContactEmail: { type: String, default: '', trim: true, lowercase: true },
    /** Display names for the 3 scanner members (ops / UI) */
    memberNames: {
      type: [String],
      default: [],
    },
    /**
     * Ops access pack — login emails/passwords for this team (admin + printed slips).
     * Not exposed on public player APIs.
     */
    accessPack: {
      leader: {
        name: { type: String, default: '' },
        loginEmail: { type: String, default: '' },
        contactEmail: { type: String, default: '' },
        password: { type: String, default: '', select: false },
        encryptedPassword: { type: String, default: '', select: false },
        note: { type: String, default: '' },
      },
      scanners: [{
        name: { type: String, default: '' },
        loginEmail: { type: String, default: '' },
        password: { type: String, default: '', select: false },
        encryptedPassword: { type: String, default: '', select: false },
      }],
      sharedScannerPassword: { type: String, default: '', select: false },
      encryptedSharedScannerPassword: { type: String, default: '', select: false },
      /** One password for the whole team (code + this password → pick who you are). */
      encryptedTeamPassword: { type: String, default: '', select: false },
    },
    startingScore: { type: Number, default: 100 },
    currentScore: { type: Number, default: 100 },
    finalScore: { type: Number },
    status: {
      type: String,
      enum: TEAM_STATUSES,
      default: 'registered',
      index: true,
    },
    currentStage: {
      type: String,
      enum: TEAM_STAGES,
      default: 'WAITING',
      index: true,
    },
    scoreLockedAt: { type: Date },
    finishedAt: { type: Date },
    stats: {
      hintsUsed: { type: Number, default: 0 },
      failedAttempts: { type: Number, default: 0 },
      totalCompletionMs: { type: Number },
      manualPenalty: { type: Number, default: 0 },
    },
    suddenDeathRank: { type: Number },
    lastCheckpointNumber: { type: Number },
    competitionPhase: {
      type: String,
      enum: ['round1', 'finale'],
      default: 'round1',
      index: true,
    },
    finaleEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntFinaleEntry',
      index: true,
    },
  },
  { timestamps: true },
);

campusHuntTeamSchema.index({ eventId: 1, teamCode: 1 }, { unique: true });
campusHuntTeamSchema.index({ eventId: 1, leaderUserId: 1 });
campusHuntTeamSchema.index({ eventId: 1, memberUserIds: 1 });
campusHuntTeamSchema.index({ eventId: 1, currentStage: 1 });
campusHuntTeamSchema.index({ eventId: 1, currentScore: -1 });
campusHuntTeamSchema.index({ eventId: 1, startingPointId: 1, scheduledStartAt: 1 });
campusHuntTeamSchema.index({ eventId: 1, startStatus: 1, scheduledStartAt: 1 });

campusHuntTeamSchema.methods.allMemberIds = function allMemberIds() {
  const ids = [this.leaderUserId, ...(this.memberUserIds || [])];
  return ids.map((id) => String(id));
};

/** Distinct roster IDs (leader + members), order not guaranteed. */
campusHuntTeamSchema.methods.uniqueMemberIds = function uniqueMemberIds() {
  return [...new Set(this.allMemberIds())];
};

campusHuntTeamSchema.methods.includesUser = function includesUser(userId) {
  return this.allMemberIds().includes(String(userId));
};

campusHuntTeamSchema.methods.isLeader = function isLeader(userId) {
  return String(this.leaderUserId) === String(userId);
};

module.exports = mongoose.models.CampusHuntTeam
  || mongoose.model('CampusHuntTeam', campusHuntTeamSchema);
