const mongoose = require('mongoose');

const auditEntrySchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true },
  actor: { type: String, default: '', trim: true },
  at: { type: Date, default: Date.now },
  detail: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const hostProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  phoneVerifiedAt: { type: Date, default: null },
  clubName: { type: String, default: '', trim: true },
  roleTitle: { type: String, required: true, trim: true },
  publicContactMode: { type: String, enum: ['platform', 'email', 'phone'], default: 'platform' },
  publicContactValue: { type: String, default: '', trim: true },
  status: {
    type: String,
    enum: ['pending', 'changes_required', 'approved', 'suspended', 'expired', 'rejected'],
    default: 'pending',
    index: true,
  },
  responsibilityAcceptedAt: { type: Date, required: true },
  conductAcceptedAt: { type: Date, required: true },
  approvedAt: { type: Date, default: null },
  verifiedUntil: { type: Date, default: null, index: true },
  approvedBy: { type: String, default: '', trim: true },
  adminNotes: { type: String, default: '', trim: true },
  sourceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostGameRequest', default: null },
  audit: { type: [auditEntrySchema], default: [] },
}, { timestamps: true });

const permissionSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, unique: true },
  hostProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusHostProfile', required: true, index: true },
  authorityName: { type: String, required: true, trim: true },
  authorityEmail: { type: String, required: true, trim: true, lowercase: true },
  authorityPhone: { type: String, default: '', trim: true },
  confirmationMode: { type: String, enum: ['noc_upload', 'authority_email'], required: true },
  authorityConfirmedAt: { type: Date, default: null },
  authorityConfirmationTokenHash: { type: String, default: '', select: false },
  authorityConfirmationExpiresAt: { type: Date, default: null },
  encryptedDocumentUrl: { type: String, default: '', select: false },
  documentName: { type: String, default: '', trim: true },
  venue: { type: String, required: true, trim: true },
  approvedEventDate: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: true },
  emergencyName: { type: String, required: true, trim: true },
  emergencyPhone: { type: String, required: true, trim: true },
  safetyAcceptedAt: { type: Date, required: true },
  responsibilityAcceptedAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'changes_required', 'approved', 'rejected', 'expired'],
    default: 'pending',
    index: true,
  },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: String, default: '', trim: true },
  adminNotes: { type: String, default: '', trim: true },
  audit: { type: [auditEntrySchema], default: [] },
}, { timestamps: true });

const operatorGrantSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusHuntEvent', default: null, index: true },
  hostProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusHostProfile', required: true, index: true },
  role: { type: String, enum: ['emergency_operator', 'checkpoint_volunteer'], required: true, index: true },
  label: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  passwordHash: { type: String, required: true, select: false },
  checkpointIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CampusHuntCheckpoint' }], default: [] },
  deviceIdHash: { type: String, default: '', trim: true },
  expiresAt: { type: Date, required: true, index: true },
  enabled: { type: Boolean, default: true, index: true },
  revokedAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: null },
  audit: { type: [auditEntrySchema], default: [] },
}, { timestamps: true });
operatorGrantSchema.index({ gameId: 1, code: 1 }, { unique: true });

const announcementSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, index: true },
  hostProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusHostProfile', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  message: { type: String, required: true, trim: true, maxlength: 1200 },
  transactional: { type: Boolean, default: false },
  recipientCount: { type: Number, default: 0, min: 0 },
  emailAttempted: { type: Number, default: 0, min: 0 },
  emailSent: { type: Number, default: 0, min: 0 },
  emailFailed: { type: Number, default: 0, min: 0 },
  createdBy: { type: String, required: true, trim: true },
}, { timestamps: true });
announcementSchema.index({ gameId: 1, createdAt: -1 });

const refundRequestSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRegistration', required: true, index: true },
  requestedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  requestedByHostProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusHostProfile', default: null },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'processing', 'refunded', 'failed'], default: 'pending', index: true },
  orderId: { type: String, default: '', trim: true, index: true },
  amount: { type: Number, default: 0, min: 0 },
  adminNotes: { type: String, default: '', trim: true },
  processedAt: { type: Date, default: null },
  audit: { type: [auditEntrySchema], default: [] },
}, { timestamps: true });
refundRequestSchema.index({ registrationId: 1, status: 1 });

const resultDisputeSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRegistration', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, required: true, trim: true, maxlength: 1200 },
  status: { type: String, enum: ['open', 'upheld', 'amended', 'rejected'], default: 'open', index: true },
  resolution: { type: String, default: '', trim: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: String, default: '', trim: true },
  audit: { type: [auditEntrySchema], default: [] },
}, { timestamps: true });
resultDisputeSchema.index({ gameId: 1, status: 1 });

const prizeDisbursementSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRegistration', default: null },
  winnerLabel: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending', index: true },
  paymentReference: { type: String, default: '', trim: true },
  paidAt: { type: Date, default: null },
  createdBy: { type: String, required: true, trim: true },
  audit: { type: [auditEntrySchema], default: [] },
}, { timestamps: true });

const hostReportSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['host', 'content', 'safety', 'payment', 'cancellation'], required: true },
  message: { type: String, required: true, trim: true, maxlength: 1500 },
  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open', index: true },
  resolution: { type: String, default: '', trim: true },
}, { timestamps: true });

const hostCheckInPackSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeGame', required: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusHuntEvent', required: true, index: true },
  hostProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusHostProfile', required: true, index: true },
  exportBatchId: { type: String, required: true, trim: true, index: true },
  deviceIdHash: { type: String, required: true, trim: true },
  passEntries: {
    type: [{
      registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRegistration', required: true },
      teamName: { type: String, required: true, trim: true },
      passHash: { type: String, required: true, trim: true },
    }],
    default: [],
    select: false,
  },
  lastSequence: { type: Number, default: 0, min: 0 },
  activatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  audit: { type: [auditEntrySchema], default: [] },
}, { timestamps: true });
hostCheckInPackSchema.index({ gameId: 1, deviceIdHash: 1, exportBatchId: 1 }, { unique: true });
hostCheckInPackSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CampusHostProfile = mongoose.models.CampusHostProfile || mongoose.model('CampusHostProfile', hostProfileSchema);
const CampusHuntPermission = mongoose.models.CampusHuntPermission || mongoose.model('CampusHuntPermission', permissionSchema);
const CampusHuntOperatorGrant = mongoose.models.CampusHuntOperatorGrant || mongoose.model('CampusHuntOperatorGrant', operatorGrantSchema);
const GameAnnouncement = mongoose.models.GameAnnouncement || mongoose.model('GameAnnouncement', announcementSchema);
const GameRefundRequest = mongoose.models.GameRefundRequest || mongoose.model('GameRefundRequest', refundRequestSchema);
const GameResultDispute = mongoose.models.GameResultDispute || mongoose.model('GameResultDispute', resultDisputeSchema);
const GamePrizeDisbursement = mongoose.models.GamePrizeDisbursement || mongoose.model('GamePrizeDisbursement', prizeDisbursementSchema);
const CampusHuntHostReport = mongoose.models.CampusHuntHostReport || mongoose.model('CampusHuntHostReport', hostReportSchema);
const CampusHuntHostCheckInPack = mongoose.models.CampusHuntHostCheckInPack || mongoose.model('CampusHuntHostCheckInPack', hostCheckInPackSchema);

module.exports = {
  CampusHostProfile,
  CampusHuntPermission,
  CampusHuntOperatorGrant,
  GameAnnouncement,
  GameRefundRequest,
  GameResultDispute,
  GamePrizeDisbursement,
  CampusHuntHostReport,
  CampusHuntHostCheckInPack,
};
