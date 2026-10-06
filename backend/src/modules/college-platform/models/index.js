const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  shortName: { type: String, default: '', trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  city: { type: String, default: '', trim: true, index: true },
  emailDomains: { type: [String], default: [] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
}, { timestamps: true });

const gameSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  tagline: { type: String, default: '', trim: true },
  description: { type: String, default: '', trim: true },
  coverImage: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true, index: true },
  venue: { type: String, default: '', trim: true },
  meetingPoint: { type: String, default: '', trim: true },
  hostCollegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null, index: true },
  allowedCollegeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'College' }],
  participationMode: {
    type: String,
    enum: ['on_campus', 'intercollege'],
    default: 'intercollege',
  },
  gameType: { type: String, default: 'campus_game', trim: true },
  startsAt: { type: Date, default: null, index: true },
  endsAt: { type: Date, default: null },
  registrationOpensAt: { type: Date, default: null },
  registrationClosesAt: { type: Date, default: null },
  checkInOpensAt: { type: Date, default: null },
  checkInClosesAt: { type: Date, default: null },
  teamSize: { type: Number, default: 4, min: 2, max: 12 },
  capacity: { type: Number, default: 20, min: 1, max: 1000 },
  reservedSlots: { type: Number, default: 0, min: 0 },
  feePerTeam: { type: Number, default: 0, min: 0 },
  platformFeePercent: { type: Number, default: 0, min: 0, max: 100 },
  rules: { type: [String], default: [] },
  steps: { type: [String], default: [] },
  status: {
    type: String,
    enum: ['draft', 'published', 'completed', 'cancelled'],
    default: 'draft',
    index: true,
  },
  engine: {
    type: { type: String, enum: ['none', 'campus_hunt'], default: 'none' },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusHuntEvent', default: undefined },
    eventSlug: { type: String, default: '', trim: true },
  },
  offlineEnabled: { type: Boolean, default: false },
  placementPoints: { type: [Number], default: [100, 80, 60] },
}, { timestamps: true });

gameSchema.index({ status: 1, startsAt: 1 });
gameSchema.index({ 'engine.eventId': 1 }, { unique: true, sparse: true });

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['invited', 'verified', 'substitution_approved'], default: 'invited' },
  verifiedAt: { type: Date, default: null },
}, { _id: true });

const registrationSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, index: true },
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  captainUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  captainName: { type: String, required: true, trim: true },
  captainEmail: { type: String, required: true, trim: true, lowercase: true },
  captainPhone: { type: String, default: '', trim: true },
  captainVerifiedAt: { type: Date, required: true },
  teamName: { type: String, required: true, trim: true },
  participantKeys: { type: [String], default: undefined, select: false },
  members: { type: [memberSchema], default: [] },
  status: {
    type: String,
    enum: ['reserved', 'pending_payment', 'confirmed', 'checked_in', 'cancelled', 'expired', 'manual_review'],
    default: 'reserved',
    index: true,
  },
  reservationExpiresAt: { type: Date, default: null, index: true },
  slotHeld: { type: Boolean, default: true },
  paymentOrderId: { type: String, default: '', trim: true, index: true },
  amountPaid: { type: Number, default: 0 },
  fulfillmentState: {
    type: String,
    enum: ['idle', 'processing', 'complete', 'review'],
    default: 'idle',
  },
  fulfillmentStartedAt: { type: Date, default: null },
  passId: { type: String, default: undefined, trim: true, unique: true, sparse: true },
  qrToken: { type: String, default: '', select: false },
  qrTokenHash: { type: String, default: '', select: false },
  huntTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusHuntTeam', default: null },
  checkedInAt: { type: Date, default: null },
  checkedInBy: { type: String, default: '', trim: true },
  audit: [{
    action: { type: String, required: true },
    actor: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    detail: { type: mongoose.Schema.Types.Mixed, default: {} },
    _id: false,
  }],
}, { timestamps: true });

registrationSchema.index({ gameId: 1, captainUserId: 1, status: 1 });
registrationSchema.index({ gameId: 1, teamName: 1 });
registrationSchema.index({ participantKeys: 1 }, { unique: true, sparse: true });

const inviteSchema = new mongoose.Schema({
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRegistration', required: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, required: true },
  email: { type: String, required: true, trim: true, lowercase: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'claimed', 'expired', 'revoked'], default: 'pending', index: true },
  expiresAt: { type: Date, required: true, index: true },
  claimedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimedAt: { type: Date, default: null },
  emailSentAt: { type: Date, default: null },
}, { timestamps: true });

const resultSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRegistration', required: true, unique: true },
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  teamName: { type: String, required: true, trim: true },
  placement: { type: Number, required: true, min: 1 },
  points: { type: Number, required: true, min: 0 },
  finalized: { type: Boolean, default: true, index: true },
  finalizedAt: { type: Date, default: Date.now, index: true },
  audit: [{
    action: { type: String, required: true },
    actor: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    _id: false,
  }],
}, { timestamps: true });

const hostRequestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, default: '', trim: true },
  collegeName: { type: String, required: true, trim: true },
  clubName: { type: String, default: '', trim: true },
  contactRole: { type: String, default: '', trim: true },
  city: { type: String, required: true, trim: true },
  gameName: { type: String, default: '', trim: true },
  gameIdea: { type: String, required: true, trim: true },
  expectedTeams: { type: Number, min: 1, default: null },
  preferredDate: { type: Date, default: null },
  status: { type: String, enum: ['new', 'reviewing', 'approved', 'rejected'], default: 'new', index: true },
  adminNotes: { type: String, default: '', trim: true },
  submittedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

const College = mongoose.models.College || mongoose.model('College', collegeSchema);
const CollegeGame = mongoose.models.CollegeGame || mongoose.model('CollegeGame', gameSchema);
const GameRegistration = mongoose.models.GameRegistration || mongoose.model('GameRegistration', registrationSchema);
const GameInvite = mongoose.models.GameInvite || mongoose.model('GameInvite', inviteSchema);
const GameResult = mongoose.models.GameResult || mongoose.model('GameResult', resultSchema);
const HostGameRequest = mongoose.models.HostGameRequest || mongoose.model('HostGameRequest', hostRequestSchema);

module.exports = {
  College,
  CollegeGame,
  GameRegistration,
  GameInvite,
  GameResult,
  HostGameRequest,
};
