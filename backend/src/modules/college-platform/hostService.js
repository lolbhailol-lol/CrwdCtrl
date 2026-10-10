const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../../model/usermodel');
const PaymentOrder = require('../../model/payment_order_model');
const PaymentRefund = require('../../model/payment_refund_model');
const CashfreeSettlement = require('../../model/cashfree_settlement_model');
const OrganizerPayout = require('../../model/organizer_payout_model');
const {
  College,
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
  CampusHuntHostCheckInPack,
} = require('./models');
const CampusHuntEvent = require('../campus-hunt/models/CampusHuntEvent');
const CampusHuntRound = require('../campus-hunt/models/CampusHuntRound');
const CampusHuntTeam = require('../campus-hunt/models/CampusHuntTeam');
const CampusHuntVolunteerAccess = require('../campus-hunt/models/CampusHuntVolunteerAccess');
const CampusHuntCheckpoint = require('../campus-hunt/models/CampusHuntCheckpoint');
const CampusHuntRoute = require('../campus-hunt/models/CampusHuntRoute');
const CampusHuntStartingPoint = require('../campus-hunt/models/CampusHuntStartingPoint');
const CampusHuntChallenge = require('../campus-hunt/models/CampusHuntChallenge');
const { bootstrapRound1Defaults } = require('../campus-hunt/services/round1BootstrapService');
const { exportOfflinePacks } = require('../campus-hunt/services/offlineExportService');
const { generateSchedule, lockSchedule } = require('../campus-hunt/services/startScheduleService');
const { readTeamPassword } = require('../campus-hunt/services/teamGateService');
const { buildLeaderboard } = require('../campus-hunt/services/leaderboardService');
const { completeCheckpoint } = require('../campus-hunt/services/checkpointService');
const { markTeamReachedAtStart } = require('../campus-hunt/services/finishService');
const { applyManualPenalty } = require('../campus-hunt/services/scoringService');
const { writeAudit } = require('../campus-hunt/services/auditService');
const { encryptCredential, decryptCredential } = require('../campus-hunt/utils/credentialCipher');
const { placementPoints } = require('./service');
const { CASHFREE_GATEWAY_FEE_RATE, round2 } = require('../../utils/cashfreeGatewayFee');

const HOST_TEMPLATE_VERSION = 'round1-v1';
const PLATFORM_FEE_RATE = 0.40;
const MAX_TEAMS = 20;
const MAX_BROADCASTS_PER_DAY = 5;
const HOST_VERIFY_DAYS = 365;
const PAYOUT_HOLD_MS = 48 * 60 * 60 * 1000;

function hostingEnabled() {
  return String(process.env.CAMPUS_HUNT_HOSTING_ENABLED || '').trim().toLowerCase() === 'true';
}

function httpError(message, status = 400, code = '') {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function clean(value) {
  return String(value || '').trim();
}

function cleanList(value, max = 30) {
  return (Array.isArray(value) ? value : [])
    .map((item) => clean(item))
    .filter(Boolean)
    .slice(0, max);
}

function slugify(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function nextYear() {
  return new Date(Date.now() + (HOST_VERIFY_DAYS * 24 * 60 * 60 * 1000));
}

function hostIsApproved(profile) {
  return Boolean(profile?.status === 'approved'
    && profile.phoneVerifiedAt
    && profile.verifiedUntil
    && new Date(profile.verifiedUntil).getTime() > Date.now());
}

function publicHost(profile) {
  if (!profile) return null;
  return {
    id: String(profile._id),
    fullName: profile.fullName,
    college: profile.collegeId,
    clubName: profile.clubName,
    roleTitle: profile.roleTitle,
    status: profile.status,
    verifiedUntil: profile.verifiedUntil,
    publicContactMode: profile.publicContactMode,
    publicContactValue: profile.publicContactMode === 'platform' ? '' : profile.publicContactValue,
  };
}

async function loadHostForUser(userId, { approved = false } = {}) {
  const profile = await CampusHostProfile.findOne({ userId }).populate('collegeId', 'name shortName city emailDomains status');
  if (!profile) throw httpError('Create your Campus Hunt Host profile first', 403, 'HOST_PROFILE_REQUIRED');
  if (approved && !hostIsApproved(profile)) {
    throw httpError('Your Campus Hunt Host profile is not currently approved', 403, 'HOST_APPROVAL_REQUIRED');
  }
  return profile;
}

async function upsertHostProfile(userId, body = {}) {
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);
  if (!user.isVerified || !user.email) throw httpError('Verify your email before applying to host', 403, 'EMAIL_VERIFICATION_REQUIRED');
  const collegeName = clean(body.collegeName);
  if (!collegeName) throw httpError('Enter your college name');
  const collegeSlug = slugify(collegeName);
  if (!collegeSlug) throw httpError('Enter a valid college name');
  const college = await College.findOneAndUpdate(
    { slug: collegeSlug },
    { $setOnInsert: { name: collegeName, slug: collegeSlug, emailDomains: [], status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const phone = clean(body.phone || user.phoneNumber).replace(/\s+/g, '');
  if (phone.replace(/\D/g, '').length < 10) throw httpError('Enter a verified phone number');
  if (!body.responsibilityAccepted || !body.conductAccepted) {
    throw httpError('Accept the host responsibility and participant conduct terms');
  }
  const existing = await CampusHostProfile.findOne({ userId });
  const changedIdentity = existing && (
    String(existing.collegeId) !== String(college._id)
    || existing.phone !== phone
    || existing.roleTitle !== clean(body.roleTitle)
  );
  const now = new Date();
  const update = {
    collegeId: college._id,
    fullName: clean(body.fullName || user.name),
    email: clean(user.email).toLowerCase(),
    phone,
    clubName: clean(body.clubName),
    roleTitle: clean(body.roleTitle),
    publicContactMode: ['platform', 'email', 'phone'].includes(body.publicContactMode) ? body.publicContactMode : 'platform',
    publicContactValue: clean(body.publicContactValue),
    responsibilityAcceptedAt: existing?.responsibilityAcceptedAt || now,
    conductAcceptedAt: existing?.conductAcceptedAt || now,
  };
  if (!update.fullName || !update.roleTitle) throw httpError('Name and college role are required');
  if (!existing || changedIdentity || ['rejected', 'expired'].includes(existing.status)) {
    update.status = 'pending';
    update.approvedAt = null;
    update.verifiedUntil = null;
    update.approvedBy = '';
    update.phoneVerifiedAt = null;
  }
  const profile = await CampusHostProfile.findOneAndUpdate(
    { userId },
    {
      $set: update,
      $push: { audit: { action: existing ? 'profile_updated' : 'profile_created', actor: String(userId) } },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).populate('collegeId', 'name shortName city emailDomains status');
  await User.updateOne(
    { _id: user._id },
    { $set: { college: college.name, collegeId: college._id, collegeVerifiedAt: null, collegeVerificationMethod: null, phoneNumber: phone } },
  );
  return profile;
}

function normalizeStarts(value) {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, 4).map((item, index) => ({
    code: String.fromCharCode(65 + index),
    name: clean(item?.name),
  })).filter((item) => item.name);
}

function normalizeStations(value) {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, 20).map((item, index) => ({
    code: `S${String(index + 1).padStart(2, '0')}`,
    name: clean(item?.name),
    zone: clean(item?.zone),
    riddle: clean(item?.riddle),
    joinedWord: clean(item?.joinedWord).toUpperCase(),
  })).filter((item) => item.name && item.riddle);
}

function normalizeDraft(body = {}) {
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  return {
    title: clean(body.title),
    tagline: clean(body.tagline),
    description: clean(body.description),
    coverImage: clean(body.coverImage),
    city: clean(body.city),
    venue: clean(body.venue),
    meetingPoint: clean(body.meetingPoint),
    startsAt,
    endsAt,
    registrationOpensAt: body.registrationOpensAt ? new Date(body.registrationOpensAt) : null,
    registrationClosesAt: body.registrationClosesAt ? new Date(body.registrationClosesAt) : null,
    checkInOpensAt: body.checkInOpensAt ? new Date(body.checkInOpensAt) : startsAt,
    checkInClosesAt: body.checkInClosesAt ? new Date(body.checkInClosesAt) : endsAt,
    teamSize: Math.max(2, Math.min(12, Number(body.teamSize) || 4)),
    capacity: Math.max(2, Math.min(MAX_TEAMS, Number(body.capacity) || 10)),
    minimumTeams: Math.max(1, Math.min(MAX_TEAMS, Number(body.minimumTeams) || 1)),
    feePerTeam: Math.max(0, round2(body.feePerTeam)),
    prizeAmount: Math.max(0, round2(body.prizeAmount)),
    rules: cleanList(body.rules),
    requirements: cleanList(body.requirements),
    safetyNotes: cleanList(body.safetyNotes),
    campusStarts: normalizeStarts(body.campusStarts),
    campusStations: normalizeStations(body.campusStations),
    destinationName: clean(body.destinationName),
  };
}

function economicsForDraft(draft) {
  const projectedCollection = round2(draft.feePerTeam * draft.capacity);
  const minimumCollection = round2(draft.feePerTeam * draft.minimumTeams);
  const projectedGatewayFee = round2(projectedCollection * CASHFREE_GATEWAY_FEE_RATE);
  const projectedPlatformFee = round2(projectedCollection * PLATFORM_FEE_RATE);
  const projectedHostPayout = round2(Math.max(0, projectedCollection - projectedGatewayFee - projectedPlatformFee - draft.prizeAmount));
  const minimumCosts = round2((minimumCollection * CASHFREE_GATEWAY_FEE_RATE) + (minimumCollection * PLATFORM_FEE_RATE) + draft.prizeAmount);
  return {
    projectedCollection,
    minimumCollection,
    projectedGatewayFee,
    projectedPlatformFee,
    projectedHostPayout,
    minimumCoversPrize: minimumCollection >= minimumCosts,
    platformFeePercent: PLATFORM_FEE_RATE * 100,
    gatewayFeeEstimatePercent: CASHFREE_GATEWAY_FEE_RATE * 100,
  };
}

function validateDraft(draft, { submit = false } = {}) {
  if (!draft.title || !draft.description || !draft.city || !draft.venue) throw httpError('Complete the hunt title, description, city and venue');
  if (!draft.startsAt || !Number.isFinite(draft.startsAt.getTime())) throw httpError('Choose a valid hunt date and time');
  if (!draft.registrationClosesAt || draft.registrationClosesAt >= draft.startsAt) throw httpError('Registration must close before the hunt starts');
  if (draft.minimumTeams > draft.capacity) throw httpError('Minimum teams cannot exceed capacity');
  if (submit) {
    if (draft.campusStarts.length < 1 || draft.campusStarts.length > 4) throw httpError('Add between one and four starting points');
    if (draft.campusStations.length < 6 || draft.campusStations.length > 20) throw httpError('Add between six and twenty complete stations');
    if (!draft.destinationName) throw httpError('Add the finish destination');
    if (!draft.rules.length || !draft.safetyNotes.length) throw httpError('Add rules and safety notes');
    if (!economicsForDraft(draft).minimumCoversPrize) {
      throw httpError('Minimum-team collection must cover gateway fees, CrwdCtrl fee and the full prize', 409, 'PRIZE_NOT_FUNDED');
    }
  }
  return draft;
}

function gameFieldsFromDraft(draft) {
  return {
    title: draft.title,
    tagline: draft.tagline,
    description: draft.description,
    coverImage: draft.coverImage,
    city: draft.city,
    venue: draft.venue,
    meetingPoint: draft.meetingPoint,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    registrationOpensAt: draft.registrationOpensAt,
    registrationClosesAt: draft.registrationClosesAt,
    checkInOpensAt: draft.checkInOpensAt,
    checkInClosesAt: draft.checkInClosesAt,
    teamSize: draft.teamSize,
    capacity: draft.capacity,
    minimumTeams: draft.minimumTeams,
    feePerTeam: draft.feePerTeam,
    platformFeePercent: PLATFORM_FEE_RATE * 100,
    prizeAmount: draft.prizeAmount,
    rules: draft.rules,
    requirements: draft.requirements,
    safetyNotes: draft.safetyNotes,
    participationMode: 'on_campus',
    gameType: 'campus_hunt',
    templateVersion: HOST_TEMPLATE_VERSION,
    offlineEnabled: true,
  };
}

async function uniqueSlug(title) {
  const base = slugify(title) || 'campus-hunt';
  let slug = base;
  let suffix = 1;
  while (await CollegeGame.exists({ slug })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

async function createHostedGame(hostProfile, body) {
  const draft = validateDraft(normalizeDraft(body));
  const slug = await uniqueSlug(draft.title);
  return CollegeGame.create({
    ...gameFieldsFromDraft(draft),
    slug,
    hostCollegeId: hostProfile.collegeId?._id || hostProfile.collegeId,
    allowedCollegeIds: [hostProfile.collegeId?._id || hostProfile.collegeId],
    ownerHostProfileId: hostProfile._id,
    hostDraft: draft,
    status: 'draft',
    approvalStatus: 'draft',
    operationalStatus: 'draft',
    engine: { type: 'campus_hunt', eventSlug: slug },
    financeAudit: [{ action: 'host_draft_created', actor: String(hostProfile.userId), detail: economicsForDraft(draft) }],
  });
}

async function ownedGame(hostProfile, gameId) {
  const game = await CollegeGame.findOne({ _id: gameId, ownerHostProfileId: hostProfile._id });
  if (!game) throw httpError('Hosted Campus Hunt not found', 404);
  return game;
}

async function hostSetup(hostProfile, gameId) {
  const game = await ownedGame(hostProfile, gameId);
  if (!game.engine?.eventId) throw httpError('Hunt must be approved and provisioned before setup is available', 409);
  const [event, rounds, routes, startingPoints, checkpoints, challenges] = await Promise.all([
    CampusHuntEvent.findById(game.engine.eventId).lean(),
    CampusHuntRound.find({ eventId: game.engine.eventId }).sort({ roundNumber: 1 }).lean(),
    CampusHuntRoute.find({ eventId: game.engine.eventId }).sort({ routeKey: 1 }).lean(),
    CampusHuntStartingPoint.find({ eventId: game.engine.eventId, active: { $ne: false } }).sort({ code: 1 }).lean(),
    CampusHuntCheckpoint.find({ eventId: game.engine.eventId }).sort({ progressionKey: 1, locationName: 1 }).lean(),
    CampusHuntChallenge.find({ eventId: game.engine.eventId, active: true })
      .select('-answer -acceptedAnswers -hintText')
      .sort({ challengeNumber: 1, variantKey: 1 }).lean(),
  ]);
  const gameView = game.toObject ? game.toObject() : game;
  return {
    game: { ...gameView, id: String(gameView._id), economics: economicsForDraft(normalizeDraft(gameView.pendingRevision || gameView.hostDraft || gameView)) },
    event, rounds, routes, startingPoints, checkpoints, challenges,
  };
}

async function updateHostSetup(hostProfile, gameId, body = {}) {
  const game = await ownedGame(hostProfile, gameId);
  if (!game.engine?.eventId) throw httpError('Hunt must be approved and provisioned before setup is available', 409);
  if (['live', 'completed', 'cancelled'].includes(game.operationalStatus)) throw httpError('Live hunts cannot change setup', 409);
  const event = await CampusHuntEvent.findOne({ _id: game.engine.eventId, hostProfileId: hostProfile._id });
  if (!event) throw httpError('Hosted Hunt event not found', 404);
  if (Array.isArray(body.campusStations)) {
    event.campusStations = body.campusStations.slice(0, 20).map((station, index) => ({
      code: `S${String(index + 1).padStart(2, '0')}`,
      name: clean(station?.name),
      zone: clean(station?.zone),
      riddle: clean(station?.riddle),
      joinedWord: clean(station?.joinedWord).toUpperCase(),
    })).filter((station) => station.name);
    event.stationCount = event.campusStations.length;
  }
  if (Array.isArray(body.campusStarts)) {
    event.campusStarts = body.campusStarts.slice(0, 4).map((start, index) => ({
      code: String.fromCharCode(65 + index), name: clean(start?.name),
    })).filter((start) => start.name);
    event.startCount = event.campusStarts.length;
  }
  if (body.destinationName !== undefined) event.destinationName = clean(body.destinationName);
  await event.save();
  return hostSetup(hostProfile, gameId);
}

async function updateHostChallenge(hostProfile, gameId, challengeId, body = {}) {
  const game = await ownedGame(hostProfile, gameId);
  if (!game.engine?.eventId) throw httpError('Hunt must be approved and provisioned before setup is available', 409);
  if (['live', 'completed', 'cancelled'].includes(game.operationalStatus)) throw httpError('Live hunts cannot change clues', 409);
  const challenge = await CampusHuntChallenge.findOne({ _id: challengeId, eventId: game.engine.eventId, active: true });
  if (!challenge) throw httpError('Clue not found for this Hunt', 404);
  for (const field of ['prompt', 'destinationInstruction', 'variantKey', 'difficulty']) {
    if (body[field] !== undefined) challenge[field] = clean(body[field]);
  }
  if (Array.isArray(body.memberPrompts)) challenge.memberPrompts = body.memberPrompts.map(clean).slice(0, 12);
  if (body.hintCost !== undefined) challenge.hintCost = Math.max(0, Number(body.hintCost) || 0);
  if (body.maxAttempts !== undefined) challenge.maxAttempts = Math.max(1, Math.min(10, Number(body.maxAttempts) || 3));
  if (body.timerSeconds !== undefined) challenge.timerSeconds = Math.max(0, Number(body.timerSeconds) || 0);
  if (body.basePoints !== undefined) challenge.basePoints = Math.max(0, Number(body.basePoints) || 0);
  await challenge.save();
  return hostSetup(hostProfile, gameId);
}

async function updateHostedGame(hostProfile, gameId, body) {
  const game = await ownedGame(hostProfile, gameId);
  if (['live', 'completed', 'cancelled'].includes(game.operationalStatus)) throw httpError('This hunt can no longer be edited', 409);
  const draft = validateDraft(normalizeDraft({ ...(game.hostDraft || {}), ...body }));
  if (game.approvalStatus === 'approved') {
    game.pendingRevision = draft;
    game.approvalStatus = 'pending_approval';
    game.financeAudit.push({ action: 'revision_submitted', actor: String(hostProfile.userId), detail: economicsForDraft(draft) });
  } else {
    game.hostDraft = draft;
    Object.assign(game, gameFieldsFromDraft(draft));
    if (game.approvalStatus !== 'changes_required') game.approvalStatus = 'draft';
    game.financeAudit.push({ action: 'draft_updated', actor: String(hostProfile.userId) });
  }
  await game.save();
  return game;
}

async function upsertPermission(hostProfile, gameId, body) {
  const game = await ownedGame(hostProfile, gameId);
  const existing = await CampusHuntPermission.findOne({ gameId: game._id }).select('+encryptedDocumentUrl');
  const required = ['authorityName', 'authorityEmail', 'venue', 'approvedEventDate', 'expiresAt', 'emergencyName', 'emergencyPhone'];
  if (required.some((field) => !clean(body[field]))) throw httpError('Complete all permission and emergency fields');
  if (!body.safetyAccepted || !body.responsibilityAccepted) throw httpError('Accept safety and permission responsibility');
  const confirmationMode = body.confirmationMode === 'authority_email' ? 'authority_email' : 'noc_upload';
  if (confirmationMode === 'noc_upload' && !body.documentUrl && !existing?.encryptedDocumentUrl) throw httpError('Upload the permission letter or choose authority email confirmation');
  const authorityToken = confirmationMode === 'authority_email' ? crypto.randomBytes(24).toString('base64url') : '';
  const permission = await CampusHuntPermission.findOneAndUpdate(
    { gameId: game._id },
    {
      $set: {
        hostProfileId: hostProfile._id,
        authorityName: clean(body.authorityName),
        authorityEmail: clean(body.authorityEmail).toLowerCase(),
        authorityPhone: clean(body.authorityPhone),
        confirmationMode,
        authorityConfirmedAt: confirmationMode === 'authority_email' ? null : existing?.authorityConfirmedAt || null,
        authorityConfirmationTokenHash: authorityToken ? sha256(authorityToken) : '',
        authorityConfirmationExpiresAt: authorityToken ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
        ...(body.documentUrl ? { encryptedDocumentUrl: encryptCredential(clean(body.documentUrl)) } : {}),
        documentName: clean(body.documentName),
        venue: clean(body.venue),
        approvedEventDate: new Date(body.approvedEventDate),
        expiresAt: new Date(body.expiresAt),
        emergencyName: clean(body.emergencyName),
        emergencyPhone: clean(body.emergencyPhone),
        safetyAcceptedAt: existing?.safetyAcceptedAt || new Date(),
        responsibilityAcceptedAt: existing?.responsibilityAcceptedAt || new Date(),
        status: 'pending',
        approvedAt: null,
        approvedBy: '',
      },
      $push: { audit: { action: existing ? 'permission_updated' : 'permission_created', actor: String(hostProfile.userId) } },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  game.permissionId = permission._id;
  await game.save();
  if (authorityToken) {
    const { sendCampusHuntAuthorityConfirmationEmail } = require('../../services/emailService');
    await sendCampusHuntAuthorityConfirmationEmail({
      email: permission.authorityEmail,
      authorityName: permission.authorityName,
      gameTitle: game.title,
      hostName: hostProfile.fullName,
      venue: permission.venue,
      eventDate: permission.approvedEventDate,
      token: authorityToken,
    });
  }
  return permission;
}

async function submitHostedGame(hostProfile, gameId) {
  const game = await ownedGame(hostProfile, gameId);
  const event = game.engine?.eventId ? await CampusHuntEvent.findById(game.engine.eventId).lean() : null;
  const draft = validateDraft(normalizeDraft({
    ...(game.pendingRevision || game.hostDraft || game.toObject()),
    ...(event ? {
      campusStarts: event.campusStarts,
      campusStations: event.campusStations,
      destinationName: event.destinationName,
    } : {}),
  }), { submit: true });
  game.hostDraft = draft;
  game.approvalStatus = 'pending_approval';
  game.financeAudit.push({ action: 'submitted_for_approval', actor: String(hostProfile.userId), detail: economicsForDraft(draft) });
  await game.save();
  return game;
}

async function provisionHostedHunt(game, actor, { allowIncomplete = false } = {}) {
  if (game.engine?.eventId) return CampusHuntEvent.findById(game.engine.eventId);
  const draft = validateDraft(normalizeDraft(game.pendingRevision || game.hostDraft || game.toObject()), { submit: !allowIncomplete });
  const campusStarts = draft.campusStarts.length ? draft.campusStarts : [{ code: 'A', name: 'Starting Point 1' }];
  const campusStations = draft.campusStations.length >= 6 ? draft.campusStations : Array.from({ length: 6 }, (_, index) => ({
    code: `S${String(index + 1).padStart(2, '0')}`,
    name: `Campus Place ${index + 1}`,
    zone: '',
    riddle: `Add the clue for Campus Place ${index + 1}`,
    joinedWord: '',
  }));
  let event = await CampusHuntEvent.findOne({ gameId: game._id });
  if (!event) {
    event = await CampusHuntEvent.create({
      gameId: game._id,
      hostProfileId: game.ownerHostProfileId,
      hosted: true,
      templateVersion: HOST_TEMPLATE_VERSION,
      name: draft.title,
      college: game.hostCollegeId?.name || draft.venue,
      slug: game.slug,
      date: draft.startsAt,
      status: 'draft',
      teamCapacity: draft.capacity,
      teamSize: draft.teamSize,
      startCount: campusStarts.length,
      stationCount: campusStations.length,
      campusStarts,
      campusStations,
      destinationName: draft.destinationName || 'Finish Point',
      organizerStartCode: crypto.randomBytes(3).toString('hex').toUpperCase(),
      organizerFinishCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      publicLeaderboardLive: false,
      publicLoginLive: false,
      roundPlan: { round1Name: 'Campus Hunt', round2Name: '', round3Name: '', finaleName: '', qualifyFromRound1: 0, qualifyFromRound2: 0, qualifyFromRound3: 0 },
    });
  }
  await bootstrapRound1Defaults({
    eventId: event._id,
    actor: { type: 'admin', id: actor, label: actor },
    createTeams: false,
    enablePublicLeaderboard: false,
  });
  game.engine = { type: 'campus_hunt', eventId: event._id, eventSlug: event.slug };
  await game.save();
  return event;
}

async function approveHostedGame(gameId, actor) {
  const game = await CollegeGame.findById(gameId).populate('ownerHostProfileId').populate('hostCollegeId', 'name shortName');
  if (!game?.ownerHostProfileId) throw httpError('Hosted game not found', 404);
  if (!hostIsApproved(game.ownerHostProfileId)) throw httpError('Host approval is missing or expired', 409);
  const draft = validateDraft(normalizeDraft(game.pendingRevision || game.hostDraft || game.toObject()), { submit: true });
  Object.assign(game, gameFieldsFromDraft(draft));
  game.hostDraft = draft;
  game.pendingRevision = null;
  const event = await provisionHostedHunt(game, actor);
  game.approvalStatus = 'approved';
  game.operationalStatus = 'published';
  game.status = 'published';
  game.approvedAt = new Date();
  game.approvedBy = actor;
  game.financeAudit.push({ action: 'approved_and_published', actor, detail: { eventId: String(event._id), ...economicsForDraft(draft) } });
  await game.save();
  return { game, event };
}

async function financeSummary(gameId) {
  const game = await CollegeGame.findById(gameId).lean();
  if (!game) throw httpError('Game not found', 404);
  const registrations = await GameRegistration.find({ gameId, status: { $in: ['confirmed', 'checked_in', 'cancelled'] } }).select('_id paymentOrderId amountPaid status').lean();
  const orderIds = registrations.map((row) => row.paymentOrderId).filter(Boolean);
  const [orders, refunds, settlements, prizes, disputes, refundRequests, payout] = await Promise.all([
    PaymentOrder.find({ orderId: { $in: orderIds }, status: 'PAID' }).lean(),
    PaymentRefund.find({ orderId: { $in: orderIds }, status: { $in: ['SUCCESS', 'REFUNDED'] } }).lean(),
    CashfreeSettlement.find({ orderId: { $in: orderIds } }).lean(),
    GamePrizeDisbursement.find({ gameId }).lean(),
    GameResultDispute.countDocuments({ gameId, status: 'open' }),
    GameRefundRequest.countDocuments({ gameId, status: { $in: ['pending', 'approved', 'processing', 'failed'] } }),
    OrganizerPayout.findOne({ organizerType: 'college_game', eventId: String(gameId) }).sort({ createdAt: -1 }).lean(),
  ]);
  const grossPaid = round2(orders.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0));
  const successfulRefunds = round2(refunds.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const netCollected = round2(Math.max(0, grossPaid - successfulRefunds));
  const settlementByOrder = new Map(settlements.map((row) => [row.orderId, row]));
  const gatewayFees = round2(orders.reduce((sum, order) => {
    const settlement = settlementByOrder.get(order.orderId);
    const actual = Number(settlement?.serviceCharge || 0) + Number(settlement?.serviceTax || 0);
    return sum + (actual > 0 ? actual : Number(order.totalAmount || 0) * CASHFREE_GATEWAY_FEE_RATE);
  }, 0));
  const platformFee = round2(netCollected * PLATFORM_FEE_RATE);
  const prizePaid = round2(prizes.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const prizeFunded = round2(Math.min(Number(game.prizeAmount || 0), Math.max(0, netCollected - gatewayFees - platformFee + Number(game.financeTopUp || 0))));
  const hostPayout = round2(Math.max(0, netCollected - gatewayFees - platformFee - prizeFunded));
  const settled = orders.length > 0 && orders.every((order) => String(settlementByOrder.get(order.orderId)?.status || '').toUpperCase() === 'SUCCESS');
  const holdReasons = [];
  if (disputes) holdReasons.push('open_disputes');
  if (refundRequests) holdReasons.push('open_refunds');
  if (prizeFunded < Number(game.prizeAmount || 0)) holdReasons.push('prize_shortfall');
  if (!settled && grossPaid > 0) holdReasons.push('gateway_settlement_pending');
  if (game.payoutEligibleAt && new Date(game.payoutEligibleAt).getTime() > Date.now()) holdReasons.push('dispute_window');
  return {
    grossPaid,
    successfulRefunds,
    netCollected,
    gatewayFees,
    platformFee,
    prizeAmount: Number(game.prizeAmount || 0),
    prizeFunded,
    prizePaid,
    hostPayout,
    paidTeams: registrations.filter((row) => ['confirmed', 'checked_in'].includes(row.status)).length,
    settled,
    holdReasons,
    payoutStatus: payout?.status || (holdReasons.length ? 'pending' : 'ready'),
    payout,
  };
}

async function readinessForGame(game) {
  const [profile, registrations, operatorCount, event, finance, round, routeCount, checkpointCount, startCount, teams] = await Promise.all([
    CampusHostProfile.findById(game.ownerHostProfileId).lean(),
    GameRegistration.find({ gameId: game._id, status: { $in: ['confirmed', 'checked_in'] } }).select('members').lean(),
    CampusHuntOperatorGrant.countDocuments({ gameId: game._id, role: 'emergency_operator', enabled: true, expiresAt: { $gt: new Date() } }),
    game.engine?.eventId ? CampusHuntEvent.findById(game.engine.eventId).lean() : null,
    financeSummary(game._id),
    game.engine?.eventId ? CampusHuntRound.findOne({ eventId: game.engine.eventId, roundNumber: 1 }).select('scheduleStatus').lean() : null,
    game.engine?.eventId ? CampusHuntRoute.countDocuments({ eventId: game.engine.eventId, active: { $ne: false } }) : 0,
    game.engine?.eventId ? CampusHuntCheckpoint.countDocuments({ eventId: game.engine.eventId, active: { $ne: false } }) : 0,
    game.engine?.eventId ? CampusHuntStartingPoint.countDocuments({ eventId: game.engine.eventId, active: { $ne: false } }) : 0,
    game.engine?.eventId ? CampusHuntTeam.find({ eventId: game.engine.eventId, startStatus: { $ne: 'CANCELLED' } }).select('routeId scheduledStartAt firstCheckpointId secondCheckpointId thirdCheckpointId fourthCheckpointId fifthCheckpointId').lean() : [],
  ]);
  const scheduledTeamsReady = teams.length === registrations.length && teams.every((team) => (
    team.routeId && team.scheduledStartAt && team.firstCheckpointId && team.secondCheckpointId
    && team.thirdCheckpointId && team.fourthCheckpointId && team.fifthCheckpointId
  ));
  const checks = {
    hostApproved: hostIsApproved(profile),
    minimumPaidTeams: finance.paidTeams >= Number(game.minimumTeams || 1) || Number(game.financeTopUp || 0) > 0,
    teammatesVerified: registrations.every((registration) => (registration.members || []).every((member) => ['verified', 'substitution_approved'].includes(member.status))),
    eventProvisioned: Boolean(event),
    infrastructureReady: Boolean(round?.scheduleStatus === 'locked' && routeCount && checkpointCount && startCount && scheduledTeamsReady),
    offlinePackCurrent: Boolean(event?.offlineExportBatchId),
    emergencyOperator: operatorCount > 0,
    notEmergencyStopped: !game.emergencyStoppedAt && !event?.emergencyStoppedAt,
  };
  return { ready: Object.values(checks).every(Boolean), checks, finance };
}

async function createOperatorGrant(hostProfile, gameId, body) {
  const game = await ownedGame(hostProfile, gameId);
  if (!game.engine?.eventId) throw httpError('The hunt must be approved before adding operators', 409);
  const role = body.role === 'checkpoint_volunteer' ? 'checkpoint_volunteer' : 'emergency_operator';
  const label = clean(body.label);
  if (!label) throw httpError('Operator name is required');
  const password = clean(body.password) || crypto.randomBytes(5).toString('base64url');
  if (password.length < 8) throw httpError('Operator password must be at least 8 characters');
  const code = `${role === 'emergency_operator' ? 'OPS' : 'VOL'}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : new Date(new Date(game.endsAt || game.startsAt).getTime() + 12 * 60 * 60 * 1000);
  const grant = await CampusHuntOperatorGrant.create({
    gameId: game._id,
    eventId: game.engine.eventId,
    hostProfileId: hostProfile._id,
    role,
    label,
    code,
    passwordHash: await bcrypt.hash(password, 10),
    checkpointIds: role === 'checkpoint_volunteer' ? cleanList(body.checkpointIds).filter((id) => /^[a-f\d]{24}$/i.test(id)) : [],
    expiresAt,
    audit: [{ action: 'grant_created', actor: String(hostProfile.userId) }],
  });
  if (role === 'checkpoint_volunteer') {
    if (grant.checkpointIds.length !== 1) {
      await CampusHuntOperatorGrant.deleteOne({ _id: grant._id });
      throw httpError('Choose exactly one checkpoint for this volunteer');
    }
    const checkpoint = await CampusHuntCheckpoint.findOne({
      _id: grant.checkpointIds[0],
      eventId: game.engine.eventId,
      active: { $ne: false },
    });
    if (!checkpoint) {
      await CampusHuntOperatorGrant.deleteOne({ _id: grant._id });
      throw httpError('Checkpoint is not part of this hunt');
    }
    await CampusHuntVolunteerAccess.findOneAndUpdate(
      { eventId: game.engine.eventId, code },
      {
        $set: {
          passwordHash: grant.passwordHash,
          label,
          checkpointIds: grant.checkpointIds,
          enabled: true,
          scope: 'checkpoint',
          expiresAt,
          deviceIdHash: '',
          createdByHostProfileId: hostProfile._id,
          revokedAt: null,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }
  await writeAudit({ eventId: game.engine.eventId, actorType: 'host', actorId: hostProfile.userId, action: 'operator_grant_created', targetType: 'operator_grant', targetId: grant._id, metadata: { role, label } });
  return { grant, password };
}

async function closeRegistration(hostProfile, game) {
  if (game.operationalStatus !== 'published') throw httpError('Registration can only close from the published state', 409);
  if (!game.engine?.eventId) throw httpError('Campus Hunt event is not provisioned', 409);
  const registrations = await GameRegistration.find({ gameId: game._id, status: { $in: ['confirmed', 'checked_in'] } }).select('members huntTeamId');
  if (registrations.some((registration) => (registration.members || []).some((member) => !['verified', 'substitution_approved'].includes(member.status)))) {
    throw httpError('Every paid teammate must verify before the final roster can lock', 409, 'TEAM_VERIFICATION_REQUIRED');
  }
  const round = await CampusHuntRound.findOne({ eventId: game.engine.eventId, roundNumber: 1 });
  if (!round) throw httpError('Round 1 is not provisioned', 409);
  const scheduleActor = { actorType: 'host', actorId: String(hostProfile.userId), actorLabel: hostProfile.fullName };
  await generateSchedule({
    eventId: game.engine.eventId,
    roundId: round._id,
    startsAt: game.startsAt,
    releaseIntervalMinutes: round.releaseIntervalMinutes || 5,
    assignmentStrategy: 'route_balanced',
    actor: scheduleActor,
    reason: 'Final hosted Hunt roster locked',
  });
  await lockSchedule({ eventId: game.engine.eventId, roundId: round._id, actor: scheduleActor, reason: 'Final hosted Hunt roster locked' });
  for (const registration of registrations) {
    // eslint-disable-next-line no-await-in-loop
    const team = await CampusHuntTeam.findById(registration.huntTeamId)
      .select('+accessPack.encryptedTeamPassword +accessPack.encryptedSharedScannerPassword +accessPack.leader.encryptedPassword');
    if (!team) throw httpError('A paid registration is missing its Campus Hunt team', 409);
    let password = readTeamPassword(team);
    if (!password) {
      password = crypto.randomBytes(6).toString('base64url');
      team.accessPack = team.accessPack || {};
      team.accessPack.encryptedTeamPassword = encryptCredential(password);
      team.accessPack.encryptedSharedScannerPassword = encryptCredential(password);
      team.accessPack.leader = { ...(team.accessPack.leader?.toObject?.() || team.accessPack.leader || {}), name: team.leaderName, encryptedPassword: encryptCredential(password) };
      team.accessPack.scanners = (team.memberNames || []).map((name) => ({ name, encryptedPassword: encryptCredential(password) }));
      team.markModified('accessPack');
      // eslint-disable-next-line no-await-in-loop
      await team.save();
    }
    // eslint-disable-next-line no-await-in-loop
    await GameRegistration.updateOne({ _id: registration._id }, { $set: { encryptedHuntPassword: encryptCredential(password) } });
  }
  const exported = await exportOfflinePacks(game.engine.eventId);
  if (exported.incompleteTeams?.length || exported.bundles?.length !== registrations.length) {
    throw httpError('Final offline batch is incomplete; CrwdCtrl must review route provisioning', 409, 'OFFLINE_PACK_INCOMPLETE');
  }
  game.operationalStatus = 'registration_closed';
  await game.save();
  await CampusHuntEvent.updateOne({ _id: game.engine.eventId }, { $set: { status: 'registration_closed', publicLoginLive: false } });
  await writeAudit({ eventId: game.engine.eventId, actorType: 'host', actorId: hostProfile.userId, action: 'registration_closed', metadata: { exportBatchId: exported.exportBatchId, bundleCount: exported.bundles?.length || 0 } });
  return { game, exportBatchId: exported.exportBatchId, bundleCount: exported.bundles?.length || 0, warnings: exported.warnings || [] };
}

async function hostTeamOperation(hostProfile, gameId, teamId, action, body = {}) {
  const game = await ownedGame(hostProfile, gameId);
  if (game.operationalStatus !== 'live') throw httpError('Team controls are available only while the hunt is live', 409);
  if (game.emergencyStoppedAt) throw httpError('Admin emergency stop is active', 409);
  const team = await CampusHuntTeam.findOne({ _id: teamId, eventId: game.engine?.eventId });
  if (!team) throw httpError('Team not found for this hunt', 404);
  const reason = clean(body.reason);
  if (!reason) throw httpError('A reason is required for every manual event-day action');

  if (action === 'checkpoint') {
    const checkpoint = await CampusHuntCheckpoint.findOne({
      _id: body.checkpointId,
      eventId: game.engine.eventId,
      active: { $ne: false },
    });
    if (!checkpoint || String(checkpoint.routeId || '') !== String(team.routeId || '')) {
      throw httpError('Checkpoint must belong to this team route');
    }
    return completeCheckpoint({
      team,
      checkpoint,
      volunteer: { actorType: 'host', actorId: String(hostProfile.userId), actorLabel: hostProfile.fullName },
      source: 'manual',
      notes: reason,
      forceMemberIds: team.allMemberIds(),
    });
  }
  if (action === 'penalty') {
    const amount = Math.abs(Number(body.amount) || 0);
    if (!amount) throw httpError('Penalty amount is required');
    if (team.currentStage === 'SCORE_LOCKED') throw httpError('Final scores can only be amended through an audited dispute', 409);
    const before = team.currentScore;
    team.currentScore = applyManualPenalty(team.currentScore, amount);
    team.stats = team.stats || {};
    team.stats.manualPenalty = (team.stats.manualPenalty || 0) + amount;
    await team.save();
    await writeAudit({
      eventId: team.eventId,
      actorType: 'host',
      actorId: hostProfile.userId,
      actorLabel: hostProfile.fullName,
      action: 'manual_penalty',
      targetType: 'team',
      targetId: team._id,
      reason,
      before: { score: before },
      after: { score: team.currentScore, amount },
    });
    return { team };
  }
  if (action === 'finish') {
    return markTeamReachedAtStart({
      teamId: team._id,
      actor: { actorType: 'host', actorId: String(hostProfile.userId), actorLabel: hostProfile.fullName },
      reason,
    });
  }
  throw httpError('Unsupported team operation');
}

async function activateHostCheckInPack(hostProfile, gameId, deviceId) {
  const game = await ownedGame(hostProfile, gameId);
  if (!['registration_closed', 'ready', 'live'].includes(game.operationalStatus)) {
    throw httpError('Lock the roster before activating offline check-in', 409);
  }
  if (!game.engine?.eventId || !clean(deviceId)) throw httpError('A provisioned hunt and device ID are required');
  const event = await CampusHuntEvent.findById(game.engine.eventId).lean();
  if (!event?.offlineExportBatchId) throw httpError('Generate the final offline batch first', 409);
  const registrations = await GameRegistration.find({
    gameId: game._id,
    status: { $in: ['confirmed', 'checked_in'] },
    qrTokenHash: { $ne: '' },
  }).select('teamName +qrTokenHash').lean();
  const deviceIdHash = sha256(deviceId);
  const eventEnd = new Date(game.endsAt || game.startsAt).getTime();
  const expiresAt = new Date(Math.max(Date.now() + 60 * 60 * 1000, eventEnd + 24 * 60 * 60 * 1000));
  const passEntries = registrations.map((row) => ({ registrationId: row._id, teamName: row.teamName, passHash: row.qrTokenHash }));
  const pack = await CampusHuntHostCheckInPack.findOneAndUpdate(
    { gameId: game._id, deviceIdHash, exportBatchId: event.offlineExportBatchId },
    {
      $set: { eventId: event._id, hostProfileId: hostProfile._id, passEntries, expiresAt, revokedAt: null },
      $setOnInsert: { lastSequence: 0, activatedAt: new Date() },
      $push: { audit: { action: 'pack_activated', actor: String(hostProfile.userId) } },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).select('+passEntries');
  return {
    id: String(pack._id),
    exportBatchId: pack.exportBatchId,
    expiresAt: pack.expiresAt,
    lastSequence: pack.lastSequence,
    passes: passEntries.map((entry) => ({ registrationId: String(entry.registrationId), teamName: entry.teamName, passHash: entry.passHash })),
  };
}

async function syncHostCheckIns(hostProfile, gameId, body = {}) {
  const game = await ownedGame(hostProfile, gameId);
  const pack = await CampusHuntHostCheckInPack.findOne({ _id: body.packId, gameId: game._id }).select('+passEntries');
  if (!pack || pack.revokedAt || new Date(pack.expiresAt).getTime() <= Date.now()) {
    throw httpError('Offline check-in pack is expired or revoked', 409);
  }
  if (pack.deviceIdHash !== sha256(body.deviceId)) throw httpError('Offline check-in pack belongs to another device', 403);
  const event = await CampusHuntEvent.findById(game.engine?.eventId).lean();
  if (!event || event.offlineExportBatchId !== pack.exportBatchId) throw httpError('Offline check-in pack is stale; activate the latest batch', 409);
  const actions = (Array.isArray(body.actions) ? body.actions : []).slice(0, 100)
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));
  const accepted = [];
  const conflicts = [];
  let lastSequence = Number(pack.lastSequence) || 0;
  for (const action of actions) {
    const sequence = Number(action.sequence) || 0;
    const passHash = clean(action.passHash);
    if (sequence <= lastSequence || !passHash) {
      conflicts.push({ sequence, reason: 'duplicate_or_invalid_sequence' });
      continue;
    }
    const allowed = pack.passEntries.find((entry) => entry.passHash === passHash);
    if (!allowed) {
      conflicts.push({ sequence, reason: 'unknown_pass' });
      lastSequence = sequence;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const registration = await GameRegistration.findOneAndUpdate(
      { _id: allowed.registrationId, gameId: game._id, qrTokenHash: passHash, status: 'confirmed', checkedInAt: null },
      { $set: { status: 'checked_in', checkedInAt: new Date() }, $push: { audit: { action: 'offline_host_check_in', actor: String(hostProfile.userId), detail: { packId: String(pack._id), sequence } } } },
      { new: true },
    );
    if (registration) accepted.push({ sequence, registrationId: String(registration._id), teamName: registration.teamName });
    else conflicts.push({ sequence, reason: 'already_checked_in_or_revoked' });
    lastSequence = sequence;
  }
  pack.lastSequence = lastSequence;
  pack.audit.push({ action: 'pack_synced', actor: String(hostProfile.userId), detail: { accepted: accepted.length, conflicts: conflicts.length, lastSequence } });
  await pack.save();
  return { accepted, conflicts, lastSequence };
}

async function performHostOperation(hostProfile, gameId, action, body = {}) {
  const game = await ownedGame(hostProfile, gameId);
  if (action === 'close-registration') return closeRegistration(hostProfile, game);
  if (['request-continuation', 'request-cancellation'].includes(action)) {
    if (!['registration_closed', 'ready'].includes(game.operationalStatus)) throw httpError('Turnout decisions are available after registration closes', 409);
    const finance = await financeSummary(game._id);
    if (finance.paidTeams >= Number(game.minimumTeams || 1)) throw httpError('Minimum turnout is already met', 409);
    const reason = clean(body.reason);
    if (!reason) throw httpError('Explain the turnout decision request');
    game.turnoutDecisionRequested = action === 'request-continuation' ? 'continuation' : 'cancellation';
    game.turnoutDecisionReason = reason;
    game.turnoutDecisionRequestedAt = new Date();
    game.financeHoldReasons = [...new Set([...(game.financeHoldReasons || []), 'turnout_decision_pending'])];
    game.financeAudit.push({ action, actor: String(hostProfile.userId), detail: { reason, paidTeams: finance.paidTeams } });
    await game.save();
    return { game, finance };
  }
  if (!game.engine?.eventId) throw httpError('Campus Hunt event is not provisioned', 409);
  const round = await CampusHuntRound.findOne({ eventId: game.engine.eventId, roundNumber: 1 });
  const event = await CampusHuntEvent.findById(game.engine.eventId);
  if (!round || !event) throw httpError('Campus Hunt setup is incomplete', 409);
  if (action === 'ready') {
    const readiness = await readinessForGame(game);
    if (!readiness.ready) throw httpError('Complete every launch-readiness check first', 409, 'HUNT_NOT_READY');
    game.operationalStatus = 'ready';
    await game.save();
    return { game, readiness };
  }
  if (action === 'start') {
    const readiness = await readinessForGame(game);
    if (!readiness.ready) throw httpError('The hunt is not ready to launch', 409, 'HUNT_NOT_READY');
    game.operationalStatus = 'live';
    event.status = 'live';
    event.publicLoginLive = true;
    event.publicLeaderboardLive = true;
    event.emergencyStoppedAt = null;
    event.emergencyStopReason = '';
    round.status = 'live';
    round.releasesPaused = false;
    await Promise.all([game.save(), event.save(), round.save()]);
  } else if (action === 'pause') {
    round.releasesPaused = true;
    await round.save();
  } else if (action === 'resume') {
    if (game.emergencyStoppedAt || event.emergencyStoppedAt) throw httpError('Admin must clear the emergency stop', 409);
    round.releasesPaused = false;
    await round.save();
  } else if (action === 'complete') {
    const board = await buildLeaderboard(event._id, { includeUnfinished: true });
    const registrationByTeam = new Map((await GameRegistration.find({ gameId: game._id, huntTeamId: { $ne: null } }).lean()).map((row) => [String(row.huntTeamId), row]));
    for (const row of board) {
      const registration = registrationByTeam.get(String(row.teamId));
      if (!registration) continue;
      const outcome = row.currentStage === 'SCORE_LOCKED' ? 'ranked' : row.status === 'disqualified' ? 'dq' : 'participated';
      const points = outcome === 'ranked' ? placementPoints(game, row.rank) : 0;
      const before = await GameResult.findOne({ registrationId: registration._id }).lean();
      await GameResult.findOneAndUpdate(
        { registrationId: registration._id },
        {
          $set: { gameId: game._id, collegeId: registration.collegeId, teamName: registration.teamName, placement: row.rank, points, finalized: true, finalizedAt: new Date(), outcome },
          $push: { audit: { action: before ? 'host_result_updated' : 'host_result_finalized', actor: String(hostProfile.userId), before, after: { placement: row.rank, points, outcome, score: row.score } } },
        },
        { upsert: true, new: true, runValidators: true },
      );
    }
    const completedAt = new Date();
    game.operationalStatus = 'completed';
    game.status = 'completed';
    game.completedAt = completedAt;
    game.payoutEligibleAt = new Date(completedAt.getTime() + PAYOUT_HOLD_MS);
    event.status = 'completed';
    event.publicLoginLive = false;
    round.status = 'finalized';
    round.finalizedAt = completedAt;
    round.releasesPaused = true;
    await Promise.all([game.save(), event.save(), round.save()]);
    return { game, leaderboard: board };
  } else {
    throw httpError('Unsupported host operation', 400);
  }
  await writeAudit({ eventId: event._id, actorType: 'host', actorId: hostProfile.userId, action: `host_${action}`, reason: clean(body.reason) });
  return { game, event, round };
}

async function sendAnnouncement(hostProfile, gameId, body) {
  const game = await ownedGame(hostProfile, gameId);
  const title = clean(body.title);
  const message = clean(body.message);
  if (!title || !message) throw httpError('Announcement title and message are required');
  if (/javascript:|data:text\/html/i.test(message)) throw httpError('Announcement contains an unsafe link');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentToday = await GameAnnouncement.countDocuments({ gameId: game._id, createdAt: { $gte: since } });
  if (sentToday >= MAX_BROADCASTS_PER_DAY) throw httpError('Daily announcement limit reached', 429, 'BROADCAST_LIMIT');
  const registrations = await GameRegistration.find({ gameId: game._id, status: { $in: ['confirmed', 'checked_in'] } }).select('captainEmail captainName teamName').lean();
  const announcement = await GameAnnouncement.create({
    gameId: game._id,
    hostProfileId: hostProfile._id,
    title,
    message,
    transactional: body.transactional === true,
    recipientCount: registrations.length,
    createdBy: String(hostProfile.userId),
  });
  const { sendCampusHuntHostAnnouncementEmail } = require('../../services/emailService');
  const results = await Promise.allSettled(registrations.map((registration) => sendCampusHuntHostAnnouncementEmail({
    email: registration.captainEmail,
    name: registration.captainName,
    gameTitle: game.title,
    teamName: registration.teamName,
    title,
    message,
  })));
  announcement.emailAttempted = results.length;
  announcement.emailSent = results.filter((result) => result.status === 'fulfilled').length;
  announcement.emailFailed = results.length - announcement.emailSent;
  await announcement.save();
  return announcement;
}

async function createRefundRequest({ userId, hostProfile, registrationId, reason }) {
  if (!clean(reason)) throw httpError('Refund reason is required');
  const registration = await GameRegistration.findById(registrationId);
  if (!registration) throw httpError('Registration not found', 404);
  if (userId && String(registration.captainUserId) !== String(userId)) throw httpError('Only the team captain can request a refund', 403);
  if (hostProfile) await ownedGame(hostProfile, registration.gameId);
  const existing = await GameRefundRequest.findOne({ registrationId, status: { $in: ['pending', 'approved', 'processing', 'refunded'] } });
  if (existing) return existing;
  return GameRefundRequest.create({
    gameId: registration.gameId,
    registrationId: registration._id,
    requestedByUserId: userId || null,
    requestedByHostProfileId: hostProfile?._id || null,
    reason: clean(reason),
    orderId: registration.paymentOrderId,
    amount: registration.amountPaid,
    audit: [{ action: 'refund_requested', actor: String(userId || hostProfile?.userId || '') }],
  });
}

async function createDispute(userId, registrationId, reason) {
  if (!clean(reason)) throw httpError('Dispute reason is required');
  const registration = await GameRegistration.findById(registrationId).populate('gameId');
  if (!registration || (String(registration.captainUserId) !== String(userId) && !(registration.members || []).some((member) => String(member.userId) === String(userId)))) {
    throw httpError('Registration not found', 404);
  }
  const game = registration.gameId;
  if (!game.completedAt || Date.now() > new Date(game.completedAt).getTime() + PAYOUT_HOLD_MS) throw httpError('The result dispute window is closed', 409);
  const existing = await GameResultDispute.findOne({ registrationId: registration._id, status: 'open' });
  if (existing) return existing;
  return GameResultDispute.create({ gameId: game._id, registrationId: registration._id, userId, reason: clean(reason), audit: [{ action: 'dispute_opened', actor: String(userId) }] });
}

async function createHostReport(userId, gameId, body) {
  if (!clean(body.message)) throw httpError('Describe the issue');
  return CampusHuntHostReport.create({
    gameId,
    userId,
    type: ['host', 'content', 'safety', 'payment', 'cancellation'].includes(body.type) ? body.type : 'host',
    message: clean(body.message),
  });
}

async function reconcileHostedGame(gameId) {
  const game = await CollegeGame.findById(gameId).lean();
  if (!game?.ownerHostProfileId) throw httpError('Hosted game not found', 404);
  const issues = [];
  const [event, registrations, finance] = await Promise.all([
    game.engine?.eventId ? CampusHuntEvent.findById(game.engine.eventId).lean() : null,
    GameRegistration.find({ gameId }).select('_id status huntTeamId paymentOrderId').lean(),
    financeSummary(gameId),
  ]);
  if (!event) issues.push('missing_execution_event');
  if (event && String(event.gameId) !== String(game._id)) issues.push('event_game_link_mismatch');
  for (const registration of registrations) {
    if (['confirmed', 'checked_in'].includes(registration.status) && !registration.huntTeamId) issues.push(`registration_without_team:${registration._id}`);
    if (registration.paymentOrderId && !await PaymentOrder.exists({ orderId: registration.paymentOrderId })) issues.push(`missing_payment_order:${registration._id}`);
  }
  return { gameId: String(game._id), eventId: event?._id ? String(event._id) : '', issues, finance, checkedAt: new Date().toISOString() };
}

module.exports = {
  HOST_TEMPLATE_VERSION,
  PLATFORM_FEE_RATE,
  MAX_TEAMS,
  hostingEnabled,
  httpError,
  sha256,
  hostIsApproved,
  publicHost,
  loadHostForUser,
  upsertHostProfile,
  normalizeDraft,
  economicsForDraft,
  validateDraft,
  createHostedGame,
  ownedGame,
  hostSetup,
  updateHostSetup,
  updateHostChallenge,
  updateHostedGame,
  upsertPermission,
  submitHostedGame,
  provisionHostedHunt,
  approveHostedGame,
  financeSummary,
  readinessForGame,
  createOperatorGrant,
  hostTeamOperation,
  activateHostCheckInPack,
  syncHostCheckIns,
  performHostOperation,
  sendAnnouncement,
  createRefundRequest,
  createDispute,
  createHostReport,
  reconcileHostedGame,
  nextYear,
  decryptCredential,
};
