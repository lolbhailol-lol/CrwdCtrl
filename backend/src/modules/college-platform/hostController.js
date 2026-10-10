const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { getJwtSecret } = require('../../config/jwtSecret');
const OrganizerPayout = require('../../model/organizer_payout_model');
const PaymentRefund = require('../../model/payment_refund_model');
const { createCashfreeRefund } = require('../../services/cashfreeService');
const { normalizeRefundPayload, upsertRefund } = require('../../services/cashfreeSettlementSync');
const CampusHuntEvent = require('../campus-hunt/models/CampusHuntEvent');
const CampusHuntRound = require('../campus-hunt/models/CampusHuntRound');
const CampusHuntTeam = require('../campus-hunt/models/CampusHuntTeam');
const CampusHuntVolunteerAccess = require('../campus-hunt/models/CampusHuntVolunteerAccess');
const CampusHuntCheckpoint = require('../campus-hunt/models/CampusHuntCheckpoint');
const CampusHuntOfflineInstall = require('../campus-hunt/models/CampusHuntOfflineInstall');
const {
  CollegeGame,
  GameRegistration,
  GameResult,
  CampusHostProfile,
  CampusHuntPermission,
  CampusHuntOperatorGrant,
  GameAnnouncement,
  GameRefundRequest,
  GameResultDispute,
  GamePrizeDisbursement,
  CampusHuntHostReport,
} = require('./models');
const hostService = require('./hostService');

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const permissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = String(file.mimetype || '').startsWith('image/') || file.mimetype === 'application/pdf';
    callback(allowed ? null : hostService.httpError('Only PDF or image permission documents are allowed'), allowed);
  },
});

exports.permissionUploadMiddleware = permissionUpload.single('file');

function actor(req) {
  return String(req.user?.userId || req.admin?.username || req.user?.username || 'admin');
}

function gameOwnerView(game) {
  const source = game?.toObject ? game.toObject() : game;
  return {
    ...source,
    id: String(source._id),
    economics: hostService.economicsForDraft(hostService.normalizeDraft(source.pendingRevision || source.hostDraft || source)),
  };
}

exports.requireHostingEnabled = (req, res, next) => {
  if (hostService.hostingEnabled()) return next();
  return res.status(404).json({ success: false, message: 'Campus Hunt hosting is not enabled yet', code: 'HOSTING_DISABLED' });
};

exports.confirmAuthorityPermission = async (req, res, next) => {
  try {
    const tokenHash = hostService.sha256(req.params.token);
    const permission = await CampusHuntPermission.findOneAndUpdate(
      { authorityConfirmationTokenHash: tokenHash, authorityConfirmationExpiresAt: { $gt: new Date() }, confirmationMode: 'authority_email' },
      { $set: { authorityConfirmedAt: new Date(), authorityConfirmationTokenHash: '', authorityConfirmationExpiresAt: null }, $push: { audit: { action: 'authority_email_confirmed', actor: 'college_authority' } } },
      { new: true },
    ).select('+authorityConfirmationTokenHash');
    if (!permission) return res.status(404).send('Permission confirmation link is invalid or expired.');
    return res.send('Campus Hunt permission confirmed. CrwdCtrl will still complete its safety and event review.');
  } catch (error) { return next(error); }
};

exports.operatorLogin = async (req, res, next) => {
  try {
    const deviceId = String(req.body.deviceId || '').trim();
    if (!req.body.gameId || !req.body.code || !req.body.password || !deviceId) {
      return res.status(400).json({ success: false, message: 'Game, code, password and device ID are required' });
    }
    const grant = await CampusHuntOperatorGrant.findOne({
      gameId: req.body.gameId,
      code: String(req.body.code).trim().toUpperCase(),
      role: 'emergency_operator',
      enabled: true,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).select('+passwordHash');
    if (!grant || !(await bcrypt.compare(String(req.body.password), grant.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Invalid operator credentials' });
    }
    const deviceIdHash = hostService.sha256(deviceId);
    if (grant.deviceIdHash && grant.deviceIdHash !== deviceIdHash) {
      return res.status(403).json({ success: false, message: 'This operator code is bound to another device' });
    }
    grant.deviceIdHash = grant.deviceIdHash || deviceIdHash;
    grant.lastUsedAt = new Date();
    await grant.save();
    const seconds = Math.max(300, Math.min(12 * 60 * 60, Math.floor((new Date(grant.expiresAt).getTime() - Date.now()) / 1000)));
    const token = jwt.sign({ role: 'campus_hunt_emergency_operator', grantId: String(grant._id), gameId: String(grant.gameId), deviceIdHash }, getJwtSecret(), { expiresIn: seconds });
    return res.json({ success: true, token, operator: { label: grant.label, gameId: String(grant.gameId), expiresAt: grant.expiresAt } });
  } catch (error) { return next(error); }
};

exports.operatorOperation = async (req, res, next) => {
  try {
    const raw = String(req.headers.authorization || '');
    if (!raw.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Operator login required' });
    let decoded;
    try { decoded = jwt.verify(raw.slice(7), getJwtSecret()); } catch { return res.status(401).json({ success: false, message: 'Invalid operator session' }); }
    const grant = await CampusHuntOperatorGrant.findOne({
      _id: decoded.grantId,
      gameId: req.params.gameId,
      role: 'emergency_operator',
      enabled: true,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!grant || grant.deviceIdHash !== decoded.deviceIdHash) return res.status(403).json({ success: false, message: 'Operator access expired or revoked' });
    if (!['start', 'pause', 'resume', 'complete'].includes(req.params.action)) return res.status(403).json({ success: false, message: 'Operator action is not allowed' });
    const profile = await CampusHostProfile.findById(grant.hostProfileId);
    if (!profile || !hostService.hostIsApproved(profile)) return res.status(403).json({ success: false, message: 'Host approval is not active' });
    const result = await hostService.performHostOperation(profile, req.params.gameId, req.params.action, { reason: `Emergency operator: ${grant.label}` });
    return res.json({ success: true, ...result });
  } catch (error) { return next(error); }
};

exports.getHostProfile = async (req, res, next) => {
  try {
    const profile = await CampusHostProfile.findOne({ userId: req.user.userId }).populate('collegeId', 'name shortName city');
    return res.json({ success: true, profile: profile ? hostService.publicHost(profile) : null });
  } catch (error) { return next(error); }
};

exports.saveHostProfile = async (req, res, next) => {
  try {
    if (!hostService.hostingEnabled() && !await CampusHostProfile.exists({ userId: req.user.userId })) {
      return res.status(404).json({ success: false, message: 'Campus Hunt hosting is not accepting new hosts', code: 'HOSTING_DISABLED' });
    }
    const profile = await hostService.upsertHostProfile(req.user.userId, req.body);
    return res.json({ success: true, profile: hostService.publicHost(profile) });
  } catch (error) { return next(error); }
};

exports.listHostedGames = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId);
    const games = await CollegeGame.find({ ownerHostProfileId: profile._id }).sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, profile: hostService.publicHost(profile), games: games.map(gameOwnerView) });
  } catch (error) { return next(error); }
};

exports.createHostedGame = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const game = await hostService.createHostedGame(profile, req.body);
    return res.status(201).json({ success: true, game: gameOwnerView(game) });
  } catch (error) { return next(error); }
};

exports.updateHostedGame = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const game = await hostService.updateHostedGame(profile, req.params.gameId, req.body);
    return res.json({ success: true, game: gameOwnerView(game) });
  } catch (error) { return next(error); }
};

exports.uploadPermissionDocument = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const game = await hostService.ownedGame(profile, req.params.gameId);
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose a permission document' });
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ success: false, message: 'Private document storage is not configured' });
    }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const payload = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(payload, {
      folder: `crwdctrl/private/campus-hunt-permissions/${game._id}`,
      resource_type: req.file.mimetype.startsWith('image/') ? 'image' : 'raw',
      type: 'authenticated',
      access_mode: 'authenticated',
    });
    const documentRef = JSON.stringify({ publicId: result.public_id, resourceType: result.resource_type, format: result.format || '' });
    return res.status(201).json({ success: true, documentRef, documentName: req.file.originalname });
  } catch (error) { return next(error); }
};

exports.savePermission = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const permission = await hostService.upsertPermission(profile, req.params.gameId, req.body);
    const output = permission.toObject();
    delete output.encryptedDocumentUrl;
    return res.json({ success: true, permission: output });
  } catch (error) { return next(error); }
};

exports.submitHostedGame = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const game = await hostService.submitHostedGame(profile, req.params.gameId);
    return res.json({ success: true, game: gameOwnerView(game) });
  } catch (error) { return next(error); }
};

exports.getHostDashboard = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const game = await hostService.ownedGame(profile, req.params.gameId);
    const [permission, registrations, announcements, operators, refunds, disputes, prizes, readiness, event, checkpoints, teams] = await Promise.all([
      CampusHuntPermission.findOne({ gameId: game._id }).select('-encryptedDocumentUrl').lean(),
      GameRegistration.find({ gameId: game._id }).select('teamName captainName captainEmail captainPhone status amountPaid checkedInAt members.status huntTeamId createdAt').sort({ createdAt: -1 }).lean(),
      GameAnnouncement.find({ gameId: game._id }).sort({ createdAt: -1 }).limit(50).lean(),
      CampusHuntOperatorGrant.find({ gameId: game._id }).select('-passwordHash').sort({ createdAt: -1 }).lean(),
      GameRefundRequest.find({ gameId: game._id }).sort({ createdAt: -1 }).lean(),
      GameResultDispute.find({ gameId: game._id }).sort({ createdAt: -1 }).lean(),
      GamePrizeDisbursement.find({ gameId: game._id }).sort({ createdAt: -1 }).lean(),
      hostService.readinessForGame(game),
      game.engine?.eventId ? CampusHuntEvent.findById(game.engine.eventId).select('-organizerStartCode -organizerFinishCode').lean() : null,
      game.engine?.eventId ? CampusHuntCheckpoint.find({ eventId: game.engine.eventId, active: { $ne: false } }).select('checkpointKey progressionKey locationName routeId stationCode').sort({ locationName: 1, progressionKey: 1 }).lean() : [],
      game.engine?.eventId ? CampusHuntTeam.find({ eventId: game.engine.eventId }).select('teamCode teamName currentStage currentScore status routeId finishedAt stats.manualPenalty').sort({ teamCode: 1 }).lean() : [],
    ]);
    return res.json({
      success: true,
      profile: hostService.publicHost(profile),
      game: gameOwnerView(game),
      permission,
      event,
      registrations: registrations.map((registration) => ({
        id: String(registration._id),
        teamName: registration.teamName,
        captainName: registration.captainName,
        captainEmail: registration.captainEmail,
        captainPhone: registration.captainPhone,
        status: registration.status,
        amountPaid: registration.amountPaid,
        checkedInAt: registration.checkedInAt,
        teammateCount: registration.members?.length || 0,
        verifiedTeammates: (registration.members || []).filter((member) => ['verified', 'substitution_approved'].includes(member.status)).length,
        huntTeamId: registration.huntTeamId,
        createdAt: registration.createdAt,
      })),
      announcements,
      operators,
      refunds,
      disputes,
      prizes,
      readiness,
      checkpoints,
      teams,
    });
  } catch (error) { return next(error); }
};

exports.createHostControlSession = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const game = await hostService.ownedGame(profile, req.params.gameId);
    const event = game.engine?.eventId
      ? await CampusHuntEvent.findById(game.engine.eventId)
      : await hostService.provisionHostedHunt(game, String(req.user.userId), { allowIncomplete: true });
    if (!event) return res.status(409).json({ success: false, message: 'Could not prepare the Hunt control room.' });
    const accessToken = jwt.sign({
      role: 'campus_hunt_host',
      scope: 'campus_hunt',
      userId: String(req.user.userId),
      gameId: String(game._id),
      eventId: String(event._id),
    }, getJwtSecret(), { expiresIn: '2h' });
    return res.json({ success: true, accessToken, eventId: String(event._id) });
  } catch (error) { return next(error); }
};

exports.getHostSetup = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    return res.json({ success: true, ...(await hostService.hostSetup(profile, req.params.gameId)) });
  } catch (error) { return next(error); }
};

exports.updateHostSetup = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    return res.json({ success: true, ...(await hostService.updateHostSetup(profile, req.params.gameId, req.body)) });
  } catch (error) { return next(error); }
};

exports.updateHostChallenge = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    return res.json({ success: true, ...(await hostService.updateHostChallenge(profile, req.params.gameId, req.params.challengeId, req.body)) });
  } catch (error) { return next(error); }
};

exports.createOperator = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const result = await hostService.createOperatorGrant(profile, req.params.gameId, req.body);
    return res.status(201).json({ success: true, grant: { ...result.grant.toObject(), passwordHash: undefined }, password: result.password });
  } catch (error) { return next(error); }
};

exports.revokeOperator = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const game = await hostService.ownedGame(profile, req.params.gameId);
    const grant = await CampusHuntOperatorGrant.findOneAndUpdate(
      { _id: req.params.grantId, gameId: game._id, hostProfileId: profile._id },
      { $set: { enabled: false, revokedAt: new Date() }, $push: { audit: { action: 'grant_revoked', actor: String(req.user.userId) } } },
      { new: true },
    ).select('-passwordHash');
    if (!grant) return res.status(404).json({ success: false, message: 'Operator grant not found' });
    if (grant.role === 'checkpoint_volunteer') {
      await CampusHuntVolunteerAccess.updateOne(
        { eventId: game.engine.eventId, code: grant.code },
        { $set: { enabled: false, revokedAt: new Date() } },
      );
    }
    return res.json({ success: true, grant });
  } catch (error) { return next(error); }
};

exports.hostOperation = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const result = await hostService.performHostOperation(profile, req.params.gameId, req.params.action, req.body);
    return res.json({ success: true, ...result });
  } catch (error) { return next(error); }
};

exports.hostTeamOperation = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const result = await hostService.hostTeamOperation(profile, req.params.gameId, req.params.teamId, req.params.action, req.body);
    return res.json({ success: true, ...result });
  } catch (error) { return next(error); }
};

exports.activateCheckInPack = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const pack = await hostService.activateHostCheckInPack(profile, req.params.gameId, req.body.deviceId);
    res.set('Cache-Control', 'no-store');
    return res.status(201).json({ success: true, pack });
  } catch (error) { return next(error); }
};

exports.syncCheckInPack = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const result = await hostService.syncHostCheckIns(profile, req.params.gameId, req.body);
    return res.json({ success: true, ...result });
  } catch (error) { return next(error); }
};

exports.sendAnnouncement = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const announcement = await hostService.sendAnnouncement(profile, req.params.gameId, req.body);
    return res.status(201).json({ success: true, announcement });
  } catch (error) { return next(error); }
};

exports.hostRefundRequest = async (req, res, next) => {
  try {
    const profile = await hostService.loadHostForUser(req.user.userId, { approved: true });
    const request = await hostService.createRefundRequest({ hostProfile: profile, registrationId: req.params.registrationId, reason: req.body.reason });
    return res.status(201).json({ success: true, request });
  } catch (error) { return next(error); }
};

exports.participantRefundRequest = async (req, res, next) => {
  try {
    const request = await hostService.createRefundRequest({ userId: req.user.userId, registrationId: req.params.registrationId, reason: req.body.reason });
    return res.status(201).json({ success: true, request });
  } catch (error) { return next(error); }
};

exports.createDispute = async (req, res, next) => {
  try {
    const dispute = await hostService.createDispute(req.user.userId, req.params.registrationId, req.body.reason);
    return res.status(201).json({ success: true, dispute });
  } catch (error) { return next(error); }
};

exports.createReport = async (req, res, next) => {
  try {
    const report = await hostService.createHostReport(req.user.userId, req.params.gameId, req.body);
    return res.status(201).json({ success: true, report });
  } catch (error) { return next(error); }
};

exports.adminHostPlatform = async (req, res, next) => {
  try {
    const [hosts, games, permissions, refunds, disputes, prizes, reports, payouts] = await Promise.all([
      CampusHostProfile.find().populate('collegeId', 'name shortName').sort({ updatedAt: -1 }).limit(200).lean(),
      CollegeGame.find({ ownerHostProfileId: { $ne: null } }).populate('ownerHostProfileId', 'fullName status').populate('hostCollegeId', 'name shortName').sort({ updatedAt: -1 }).limit(200).lean(),
      CampusHuntPermission.find().select('-encryptedDocumentUrl').sort({ updatedAt: -1 }).limit(200).lean(),
      GameRefundRequest.find().populate('registrationId', 'teamName captainName').sort({ createdAt: -1 }).limit(200).lean(),
      GameResultDispute.find().populate('registrationId', 'teamName').sort({ createdAt: -1 }).limit(200).lean(),
      GamePrizeDisbursement.find().sort({ createdAt: -1 }).limit(200).lean(),
      CampusHuntHostReport.find().sort({ createdAt: -1 }).limit(200).lean(),
      OrganizerPayout.find({ organizerType: 'college_game' }).sort({ createdAt: -1 }).limit(200).lean(),
    ]);
    return res.json({ success: true, hosts, games, permissions, refunds, disputes, prizes, reports, payouts });
  } catch (error) { return next(error); }
};

exports.adminReviewHost = async (req, res, next) => {
  try {
    const status = ['pending', 'changes_required', 'approved', 'suspended', 'expired', 'rejected'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ success: false, message: 'Invalid host status' });
    const update = {
      status,
      adminNotes: String(req.body.adminNotes || '').trim(),
      ...(status === 'approved' ? { approvedAt: new Date(), phoneVerifiedAt: new Date(), verifiedUntil: hostService.nextYear(), approvedBy: actor(req) } : {}),
    };
    const profile = await CampusHostProfile.findByIdAndUpdate(
      req.params.hostId,
      { $set: update, $push: { audit: { action: `host_${status}`, actor: actor(req), detail: { adminNotes: update.adminNotes } } } },
      { new: true, runValidators: true },
    );
    if (!profile) return res.status(404).json({ success: false, message: 'Host not found' });
    if (['suspended', 'expired', 'rejected'].includes(status)) {
      await CollegeGame.updateMany(
        { ownerHostProfileId: profile._id, operationalStatus: { $nin: ['live', 'completed', 'cancelled'] } },
        { $addToSet: { financeHoldReasons: 'host_not_approved' } },
      );
    }
    return res.json({ success: true, profile });
  } catch (error) { return next(error); }
};

exports.adminReviewPermission = async (req, res, next) => {
  try {
    const status = ['pending', 'changes_required', 'approved', 'rejected', 'expired'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ success: false, message: 'Invalid permission status' });
    const existing = await CampusHuntPermission.findById(req.params.permissionId).select('+encryptedDocumentUrl');
    if (!existing) return res.status(404).json({ success: false, message: 'Permission record not found' });
    if (status === 'approved' && existing.confirmationMode === 'authority_email' && !existing.authorityConfirmedAt) {
      return res.status(409).json({ success: false, message: 'College authority email confirmation is still pending' });
    }
    if (status === 'approved' && existing.confirmationMode === 'noc_upload' && !existing.encryptedDocumentUrl) {
      return res.status(409).json({ success: false, message: 'Permission document is missing' });
    }
    const permission = await CampusHuntPermission.findByIdAndUpdate(
      req.params.permissionId,
      {
        $set: {
          status,
          adminNotes: String(req.body.adminNotes || '').trim(),
          ...(status === 'approved' ? { approvedAt: new Date(), authorityConfirmedAt: new Date(), approvedBy: actor(req) } : {}),
        },
        $push: { audit: { action: `permission_${status}`, actor: actor(req) } },
      },
      { new: true, runValidators: true },
    );
    return res.json({ success: true, permission });
  } catch (error) { return next(error); }
};

exports.adminRevealPermissionDocument = async (req, res, next) => {
  try {
    const permission = await CampusHuntPermission.findById(req.params.permissionId).select('+encryptedDocumentUrl');
    if (!permission) return res.status(404).json({ success: false, message: 'Permission record not found' });
    const decrypted = hostService.decryptCredential(permission.encryptedDocumentUrl);
    let documentUrl = decrypted;
    try {
      const ref = JSON.parse(decrypted);
      documentUrl = cloudinary.url(ref.publicId, {
        resource_type: ref.resourceType || 'raw',
        type: 'authenticated',
        sign_url: true,
        secure: true,
        expires_at: Math.floor(Date.now() / 1000) + 300,
        ...(ref.format ? { format: ref.format } : {}),
      });
    } catch (_) { /* legacy encrypted URL */ }
    permission.audit.push({ action: 'permission_document_revealed', actor: actor(req) });
    await permission.save();
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, documentUrl, documentName: permission.documentName });
  } catch (error) { return next(error); }
};

exports.adminReviewHostedGame = async (req, res, next) => {
  try {
    if (req.body.status === 'approved') {
      const result = await hostService.approveHostedGame(req.params.gameId, actor(req));
      return res.json({ success: true, ...result });
    }
    const status = ['changes_required', 'rejected'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ success: false, message: 'Invalid review status' });
    const game = await CollegeGame.findOneAndUpdate(
      { _id: req.params.gameId, ownerHostProfileId: { $ne: null } },
      { $set: { approvalStatus: status }, $push: { financeAudit: { action: `review_${status}`, actor: actor(req), detail: { notes: String(req.body.adminNotes || '') } } } },
      { new: true },
    );
    if (!game) return res.status(404).json({ success: false, message: 'Hosted game not found' });
    return res.json({ success: true, game });
  } catch (error) { return next(error); }
};

exports.adminResolveTurnout = async (req, res, next) => {
  try {
    const game = await CollegeGame.findById(req.params.gameId);
    if (!game?.ownerHostProfileId) return res.status(404).json({ success: false, message: 'Hosted Hunt not found' });
    const decision = req.body.decision;
    if (!['continuation', 'cancellation'].includes(decision)) return res.status(400).json({ success: false, message: 'Choose continuation or cancellation' });
    const finance = await hostService.financeSummary(game._id);
    if (decision === 'continuation') {
      if (finance.paidTeams < 1) return res.status(409).json({ success: false, message: 'A Hunt cannot continue with zero paid teams' });
      const requiredTopUp = Math.max(0, Number(game.prizeAmount || 0) + finance.gatewayFees + finance.platformFee - finance.netCollected);
      const recordedTopUp = Math.max(0, Number(req.body.topUp) || 0);
      if (recordedTopUp < requiredTopUp) return res.status(409).json({ success: false, message: 'Recorded top-up does not fully fund fees and prize', requiredTopUp });
      game.financeTopUp = recordedTopUp;
      game.turnoutDecisionRequested = '';
      game.financeHoldReasons = (game.financeHoldReasons || []).filter((reason) => reason !== 'turnout_decision_pending');
      game.financeAudit.push({ action: 'continuation_approved', actor: actor(req), detail: { recordedTopUp, requiredTopUp, paymentReference: String(req.body.paymentReference || '').trim() } });
      await game.save();
      return res.json({ success: true, game, requiredTopUp });
    }

    const registrations = await GameRegistration.find({ gameId: game._id, status: { $in: ['confirmed', 'checked_in'] } }).lean();
    await Promise.all(registrations.map((registration) => GameRefundRequest.findOneAndUpdate(
      { registrationId: registration._id, status: { $in: ['pending', 'approved', 'processing', 'refunded'] } },
      { $setOnInsert: { gameId: game._id, requestedByHostProfileId: game.ownerHostProfileId, reason: 'Hunt cancelled after minimum turnout was not met', orderId: registration.paymentOrderId, amount: registration.amountPaid, status: 'pending', audit: [{ action: 'refund_queued_by_cancellation', actor: actor(req) }] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )));
    game.status = 'cancelled';
    game.operationalStatus = 'cancelled';
    game.turnoutDecisionRequested = '';
    game.financeHoldReasons = [...new Set([...(game.financeHoldReasons || []), 'refunds_pending'])];
    game.financeAudit.push({ action: 'cancellation_approved', actor: actor(req), detail: { refundCount: registrations.length } });
    await Promise.all([
      game.save(),
      game.engine?.eventId ? CampusHuntEvent.updateOne({ _id: game.engine.eventId }, { $set: { status: 'cancelled', publicLoginLive: false, publicLeaderboardLive: false } }) : Promise.resolve(),
    ]);
    return res.json({ success: true, game, refundCount: registrations.length });
  } catch (error) { return next(error); }
};

exports.adminEmergencyStop = async (req, res, next) => {
  try {
    const game = await CollegeGame.findById(req.params.gameId);
    if (!game?.engine?.eventId) return res.status(404).json({ success: false, message: 'Hosted Hunt not found' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, message: 'Emergency stop reason is required' });
    const now = new Date();
    game.emergencyStoppedAt = now;
    game.emergencyStopReason = reason;
    game.financeHoldReasons = [...new Set([...(game.financeHoldReasons || []), 'emergency_stop'])];
    await Promise.all([
      game.save(),
      CampusHuntEvent.updateOne({ _id: game.engine.eventId }, { $set: { emergencyStoppedAt: now, emergencyStopReason: reason, publicLoginLive: false } }),
      CampusHuntRound.updateMany({ eventId: game.engine.eventId }, { $set: { releasesPaused: true } }),
    ]);
    return res.json({ success: true, game });
  } catch (error) { return next(error); }
};

exports.adminClearEmergencyStop = async (req, res, next) => {
  try {
    const game = await CollegeGame.findById(req.params.gameId);
    if (!game?.engine?.eventId) return res.status(404).json({ success: false, message: 'Hosted Hunt not found' });
    game.emergencyStoppedAt = null;
    game.emergencyStopReason = '';
    game.financeHoldReasons = (game.financeHoldReasons || []).filter((reason) => reason !== 'emergency_stop');
    await Promise.all([
      game.save(),
      CampusHuntEvent.updateOne({ _id: game.engine.eventId }, { $set: { emergencyStoppedAt: null, emergencyStopReason: '' } }),
    ]);
    return res.json({ success: true, game });
  } catch (error) { return next(error); }
};

exports.adminProcessRefund = async (req, res, next) => {
  try {
    const request = await GameRefundRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Refund request not found' });
    if (req.body.status === 'rejected') {
      request.status = 'rejected';
      request.adminNotes = String(req.body.adminNotes || '').trim();
      request.audit.push({ action: 'refund_rejected', actor: actor(req) });
      await request.save();
      return res.json({ success: true, request });
    }
    const registration = await GameRegistration.findById(request.registrationId);
    if (!registration) return res.status(404).json({ success: false, message: 'Registration not found' });
    const existing = request.orderId ? await PaymentRefund.findOne({ orderId: request.orderId, status: { $in: ['SUCCESS', 'REFUNDED'] } }) : null;
    let refundSucceeded = Boolean(existing);
    request.status = 'processing';
    await request.save();
    if (!existing && request.amount > 0) {
      const refundId = `game_${sha256(`${request._id}:${request.orderId}`).slice(0, 24)}`;
      const raw = await createCashfreeRefund({
        orderId: request.orderId,
        amount: request.amount,
        refundId,
        idempotencyKey: crypto.randomUUID(),
        note: 'Campus Hunt full registration refund',
        merchant: 'platform',
      });
      const normalized = normalizeRefundPayload(Array.isArray(raw) ? raw[0] : raw, { orderId: request.orderId });
      await upsertRefund({ normalized, source: 'api', raw, actor: actor(req) });
      refundSucceeded = ['SUCCESS', 'REFUNDED'].includes(String(normalized.status || '').toUpperCase());
    }
    if (!refundSucceeded && request.amount > 0) {
      request.status = 'processing';
      request.audit.push({ action: 'refund_gateway_pending', actor: actor(req) });
      await request.save();
      return res.status(202).json({ success: true, request, pending: true });
    }
    const held = registration.slotHeld;
    registration.status = 'cancelled';
    registration.slotHeld = false;
    registration.qrToken = '';
    registration.qrTokenHash = '';
    registration.audit.push({ action: 'refunded', actor: actor(req), detail: { requestId: String(request._id) } });
    await registration.save();
    if (held) await CollegeGame.updateOne({ _id: registration.gameId, reservedSlots: { $gt: 0 } }, { $inc: { reservedSlots: -1 } });
    if (registration.huntTeamId) {
      const huntTeam = await CampusHuntTeam.findByIdAndUpdate(
        registration.huntTeamId,
        { $set: { status: 'disqualified', startStatus: 'CANCELLED' } },
        { new: true },
      ).select('eventId teamCode');
      if (huntTeam) await CampusHuntOfflineInstall.deleteMany({ eventId: huntTeam.eventId, teamCode: huntTeam.teamCode });
    }
    request.status = 'refunded';
    request.processedAt = new Date();
    request.adminNotes = String(req.body.adminNotes || '').trim();
    request.audit.push({ action: 'refund_completed', actor: actor(req) });
    await request.save();
    return res.json({ success: true, request });
  } catch (error) { return next(error); }
};

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

exports.adminResolveDispute = async (req, res, next) => {
  try {
    const status = ['upheld', 'amended', 'rejected'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ success: false, message: 'Invalid dispute resolution' });
    const dispute = await GameResultDispute.findById(req.params.disputeId);
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found' });
    if (status === 'amended' && req.body.result) {
      const result = await GameResult.findOne({ registrationId: dispute.registrationId });
      if (result) {
        const before = result.toObject();
        if (req.body.result.placement != null) result.placement = Math.max(1, Number(req.body.result.placement));
        if (req.body.result.points != null) result.points = Math.max(0, Number(req.body.result.points));
        if (['ranked', 'participated', 'dq', 'no_show'].includes(req.body.result.outcome)) result.outcome = req.body.result.outcome;
        result.audit.push({ action: 'dispute_amendment', actor: actor(req), before, after: req.body.result });
        await result.save();
      }
    }
    dispute.status = status;
    dispute.resolution = String(req.body.resolution || '').trim();
    dispute.resolvedAt = new Date();
    dispute.resolvedBy = actor(req);
    dispute.audit.push({ action: `dispute_${status}`, actor: actor(req) });
    await dispute.save();
    return res.json({ success: true, dispute });
  } catch (error) { return next(error); }
};

exports.adminResolveHostReport = async (req, res, next) => {
  try {
    const status = ['reviewing', 'resolved', 'dismissed'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ success: false, message: 'Invalid report status' });
    const report = await CampusHuntHostReport.findById(req.params.reportId);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    report.status = status;
    report.resolution = String(req.body.resolution || '').trim();
    await report.save();
    if (req.body.suspendHost === true) {
      const game = await CollegeGame.findById(report.gameId).select('ownerHostProfileId');
      if (game?.ownerHostProfileId) {
        await Promise.all([
          CampusHostProfile.updateOne({ _id: game.ownerHostProfileId }, { $set: { status: 'suspended', adminNotes: report.resolution }, $push: { audit: { action: 'suspended_from_report', actor: actor(req), detail: { reportId: String(report._id) } } } }),
          CollegeGame.updateMany({ ownerHostProfileId: game.ownerHostProfileId, operationalStatus: { $nin: ['live', 'completed', 'cancelled'] } }, { $addToSet: { financeHoldReasons: 'host_suspended' } }),
          OrganizerPayout.updateMany({ organizerType: 'college_game', organizerId: String(game.ownerHostProfileId), status: { $ne: 'paid' } }, { $set: { status: 'pending', note: 'Frozen after host safety report' } }),
        ]);
      }
    }
    return res.json({ success: true, report });
  } catch (error) { return next(error); }
};

exports.adminPrizeDisbursement = async (req, res, next) => {
  try {
    const game = await CollegeGame.findById(req.params.gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    const existingPaid = await GamePrizeDisbursement.aggregate([
      { $match: { gameId: game._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const amount = Math.max(0, Number(req.body.amount) || 0);
    if (req.body.status === 'paid' && !String(req.body.paymentReference || '').trim()) {
      return res.status(400).json({ success: false, message: 'Payment reference is required for a paid prize' });
    }
    if ((Number(existingPaid[0]?.total || 0) + amount) > Number(game.prizeAmount || 0)) {
      return res.status(409).json({ success: false, message: 'Prize disbursements exceed the approved prize allocation' });
    }
    const prize = await GamePrizeDisbursement.create({
      gameId: game._id,
      registrationId: req.body.registrationId || null,
      winnerLabel: String(req.body.winnerLabel || '').trim(),
      amount,
      status: req.body.status === 'paid' ? 'paid' : 'pending',
      paymentReference: String(req.body.paymentReference || '').trim(),
      paidAt: req.body.status === 'paid' ? new Date() : null,
      createdBy: actor(req),
      audit: [{ action: 'prize_recorded', actor: actor(req) }],
    });
    return res.status(201).json({ success: true, prize });
  } catch (error) { return next(error); }
};

exports.adminMarkPayout = async (req, res, next) => {
  try {
    const finance = await hostService.financeSummary(req.params.gameId);
    if (finance.holdReasons.length) return res.status(409).json({ success: false, message: 'Payout remains on hold', holdReasons: finance.holdReasons });
    const reconciliation = await hostService.reconcileHostedGame(req.params.gameId);
    if (reconciliation.issues.length) return res.status(409).json({ success: false, message: 'Resolve reconciliation mismatches before payout', issues: reconciliation.issues });
    if (req.body.status === 'paid' && !String(req.body.paymentReference || '').trim()) {
      return res.status(400).json({ success: false, message: 'Payment reference is required for a paid payout' });
    }
    const game = await CollegeGame.findById(req.params.gameId).populate('ownerHostProfileId', 'fullName');
    if (!game?.ownerHostProfileId) return res.status(404).json({ success: false, message: 'Hosted game not found' });
    const payout = await OrganizerPayout.findOneAndUpdate(
      { organizerType: 'college_game', organizerId: String(game.ownerHostProfileId._id), eventId: String(game._id), bucket: 'other' },
      {
        $set: {
          organizerName: game.ownerHostProfileId.fullName,
          eventName: game.title,
          amount: finance.hostPayout,
          status: req.body.status === 'paid' ? 'paid' : 'ready',
          paidAt: req.body.status === 'paid' ? new Date() : null,
          note: String(req.body.paymentReference || '').trim(),
          createdBy: actor(req),
          orderIds: [],
          batchKind: 'organizer',
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    return res.json({ success: true, payout, finance });
  } catch (error) { return next(error); }
};

exports.adminReconcileHostedGame = async (req, res, next) => {
  try {
    return res.json({ success: true, reconciliation: await hostService.reconcileHostedGame(req.params.gameId) });
  } catch (error) { return next(error); }
};
