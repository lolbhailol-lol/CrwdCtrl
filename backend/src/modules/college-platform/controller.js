const mongoose = require('mongoose');
const User = require('../../model/usermodel');
const {
  College,
  CollegeGame,
  GameRegistration,
  GameInvite,
  GameResult,
  HostGameRequest,
  GamePreRegistration,
  GameAnnouncement,
  GameRefundRequest,
  GameResultDispute,
} = require('./models');
const {
  sha256,
  collegeAcceptsEmail,
  placementPoints,
  teamReadyForCheckIn,
  isWithinCheckInWindow,
  reserveTeamSlot,
  confirmFreeRegistration,
  verifyPassToken,
  buildRankings,
} = require('./service');
const { decryptCredential } = require('../campus-hunt/utils/credentialCipher');
const CampusHuntTeam = require('../campus-hunt/models/CampusHuntTeam');
const CampusHuntEvent = require('../campus-hunt/models/CampusHuntEvent');
const CampusHuntOfflineInstall = require('../campus-hunt/models/CampusHuntOfflineInstall');

function asId(value) {
  return mongoose.isValidObjectId(value) ? value : null;
}

function cleanStrings(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function gamePublic(game) {
  return {
    id: String(game._id),
    title: game.title,
    slug: game.slug,
    tagline: game.tagline,
    description: game.description,
    coverImage: game.coverImage,
    city: game.city,
    venue: game.venue,
    meetingPoint: game.meetingPoint,
    hostCollege: game.hostCollegeId || null,
    participationMode: game.participationMode,
    gameType: game.gameType,
    startsAt: game.startsAt,
    endsAt: game.endsAt,
    registrationOpensAt: game.registrationOpensAt,
    registrationClosesAt: game.registrationClosesAt,
    teamSize: game.teamSize,
    capacity: game.capacity,
    spotsLeft: Math.max(0, Number(game.capacity) - Number(game.reservedSlots || 0)),
    feePerTeam: game.feePerTeam,
    minimumTeams: game.minimumTeams || 1,
    prizeAmount: game.prizeAmount || 0,
    requirements: game.requirements || [],
    safetyNotes: game.safetyNotes || [],
    operationalStatus: game.operationalStatus || game.status,
    host: game.ownerHostProfileId?._id ? {
      name: game.ownerHostProfileId.fullName,
      clubName: game.ownerHostProfileId.clubName,
      roleTitle: game.ownerHostProfileId.roleTitle,
      verified: game.ownerHostProfileId.status === 'approved',
    } : null,
    rules: game.rules || [],
    steps: game.steps || [],
    status: game.status,
    offlineEnabled: Boolean(game.offlineEnabled),
    engine: {
      type: game.engine?.type || 'none',
      eventId: game.engine?.eventId ? String(game.engine.eventId) : '',
      eventSlug: game.engine?.eventSlug || '',
    },
  };
}

function registrationPublic(registration, { includeQr = false } = {}) {
  const game = registration.gameId;
  const college = registration.collegeId;
  return {
    id: String(registration._id),
    status: registration.status,
    teamName: registration.teamName,
    captainName: registration.captainName,
    captainEmail: registration.captainEmail,
    members: (registration.members || []).map((member) => ({
      id: String(member._id),
      name: member.name,
      email: member.email,
      status: member.status,
      verifiedAt: member.verifiedAt,
    })),
    allMembersVerified: (registration.members || []).every((member) => ['verified', 'substitution_approved'].includes(member.status)),
    passId: registration.passId,
    amountPaid: registration.amountPaid,
    checkedInAt: registration.checkedInAt,
    createdAt: registration.createdAt,
    game: game?._id ? gamePublic(game) : { id: String(game) },
    college: college?._id ? {
      id: String(college._id),
      name: college.name,
      shortName: college.shortName,
      city: college.city,
    } : { id: String(college) },
    ...(includeQr && registration.qrToken ? { qrToken: registration.qrToken } : {}),
  };
}

exports.listColleges = async (req, res, next) => {
  try {
    const query = { status: 'active' };
    if (req.query.city) query.city = new RegExp(String(req.query.city), 'i');
    const colleges = await College.find(query).sort({ city: 1, name: 1 }).lean();
    return res.json({
      success: true,
      colleges: colleges.map((college) => ({
        id: String(college._id),
        name: college.name,
        shortName: college.shortName,
        slug: college.slug,
        city: college.city,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

exports.listGames = async (req, res, next) => {
  try {
    const query = { status: { $in: ['published', 'completed'] } };
    if (req.query.city) query.city = new RegExp(String(req.query.city), 'i');
    if (req.query.mode && ['on_campus', 'intercollege'].includes(req.query.mode)) query.participationMode = req.query.mode;
    if (req.query.q) {
      const pattern = new RegExp(String(req.query.q).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: pattern }, { city: pattern }, { venue: pattern }];
    }
    const games = await CollegeGame.find(query)
      .populate('hostCollegeId', 'name shortName city')
      .populate('ownerHostProfileId', 'fullName clubName roleTitle status publicContactMode publicContactValue')
      .sort({ startsAt: 1, createdAt: -1 })
      .lean();
    return res.json({ success: true, games: games.map(gamePublic) });
  } catch (err) {
    return next(err);
  }
};

exports.getGame = async (req, res, next) => {
  try {
    const selector = asId(req.params.id) ? { _id: req.params.id } : { slug: String(req.params.id).toLowerCase() };
    const game = await CollegeGame.findOne({ ...selector, status: { $in: ['published', 'completed'] } })
      .populate('hostCollegeId', 'name shortName city')
      .populate('ownerHostProfileId', 'fullName clubName roleTitle status publicContactMode publicContactValue')
      .lean();
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    return res.json({ success: true, game: gamePublic(game) });
  } catch (err) {
    return next(err);
  }
};

exports.reserveRegistration = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    const { game, college, registration } = await reserveTeamSlot({
      gameId: req.params.id,
      collegeId: req.body.collegeId,
      user,
      body: req.body,
    });
    let confirmed = null;
    if (Number(game.feePerTeam) <= 0) {
      confirmed = await confirmFreeRegistration(registration._id);
    }
    return res.status(201).json({
      success: true,
      free: Number(game.feePerTeam) <= 0,
      amount: Number(game.feePerTeam) || 0,
      game: gamePublic(game),
      college: { id: String(college._id), name: college.name, shortName: college.shortName },
      registration: registrationPublic(confirmed?.registration || registration),
    });
  } catch (err) {
    return next(err);
  }
};

exports.claimInvite = async (req, res, next) => {
  try {
    const tokenHash = sha256(req.params.token);
    const invite = await GameInvite.findOne({ tokenHash, status: 'pending', expiresAt: { $gt: new Date() } });
    if (!invite) return res.status(404).json({ success: false, message: 'Invite is invalid or expired' });
    const [user, registration] = await Promise.all([
      User.findById(req.user.userId),
      GameRegistration.findById(invite.registrationId).populate('collegeId'),
    ]);
    if (!user || !registration) return res.status(404).json({ success: false, message: 'Invite registration not found' });
    if (String(user.email || '').toLowerCase() !== invite.email || !user.isVerified) {
      return res.status(403).json({ success: false, message: `Sign in with the verified invite email ${invite.email}` });
    }
    if (!collegeAcceptsEmail(registration.collegeId, user.email)) {
      return res.status(403).json({ success: false, message: 'Your email does not match the team college' });
    }
    const member = registration.members.id(invite.memberId);
    if (!member) return res.status(404).json({ success: false, message: 'Team member slot not found' });
    member.userId = user._id;
    member.status = 'verified';
    member.verifiedAt = new Date();
    registration.audit.push({ action: 'teammate_verified', actor: String(user._id), detail: { email: user.email } });
    await registration.save();
    invite.status = 'claimed';
    invite.claimedByUserId = user._id;
    invite.claimedAt = new Date();
    await invite.save();
    await User.updateOne(
      { _id: user._id },
      { $set: { college: registration.collegeId.name, collegeId: registration.collegeId._id, collegeVerifiedAt: new Date(), collegeVerificationMethod: 'email_domain' } },
    );
    return res.json({ success: true, registration: registrationPublic(registration) });
  } catch (err) {
    return next(err);
  }
};

exports.myRegistrations = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('email').lean();
    const rows = await GameRegistration.find({
      $or: [{ captainUserId: req.user.userId }, { 'members.userId': req.user.userId }, { 'members.email': String(user?.email || '').toLowerCase() }],
      status: { $in: ['pending_payment', 'confirmed', 'checked_in', 'manual_review'] },
    })
      .populate('gameId')
      .populate('collegeId')
      .sort({ createdAt: -1 })
      .lean();
    const registrationIds = rows.map((row) => row._id);
    const gameIds = [...new Set(rows.map((row) => String(row.gameId?._id || row.gameId)))];
    const [announcements, refunds, disputes] = await Promise.all([
      GameAnnouncement.find({ gameId: { $in: gameIds } }).sort({ createdAt: -1 }).lean(),
      GameRefundRequest.find({ registrationId: { $in: registrationIds } }).sort({ createdAt: -1 }).lean(),
      GameResultDispute.find({ registrationId: { $in: registrationIds } }).sort({ createdAt: -1 }).lean(),
    ]);
    return res.json({
      success: true,
      registrations: rows.map((row) => ({
        ...registrationPublic(row),
        announcements: announcements.filter((item) => String(item.gameId) === String(row.gameId?._id || row.gameId)),
        refundRequests: refunds.filter((item) => String(item.registrationId) === String(row._id)),
        disputes: disputes.filter((item) => String(item.registrationId) === String(row._id)),
      })),
    });
  } catch (err) {
    return next(err);
  }
};

exports.getPass = async (req, res, next) => {
  try {
    const registration = await GameRegistration.findById(req.params.id)
      .select('+qrToken +encryptedHuntPassword')
      .populate('gameId')
      .populate('collegeId');
    if (!registration) return res.status(404).json({ success: false, message: 'Game pass not found' });
    const allowed = String(registration.captainUserId) === String(req.user.userId)
      || registration.members.some((member) => String(member.userId) === String(req.user.userId));
    if (!allowed) return res.status(403).json({ success: false, message: 'This pass belongs to another team' });
    const [announcements, refundRequests, disputes, huntTeam] = await Promise.all([
      GameAnnouncement.find({ gameId: registration.gameId._id }).sort({ createdAt: -1 }).limit(50).lean(),
      GameRefundRequest.find({ registrationId: registration._id }).sort({ createdAt: -1 }).lean(),
      GameResultDispute.find({ registrationId: registration._id }).sort({ createdAt: -1 }).lean(),
      registration.huntTeamId
        ? CampusHuntTeam.findById(registration.huntTeamId).select('teamCode eventId').lean()
        : null,
    ]);
    const huntEvent = huntTeam?.eventId
      ? await CampusHuntEvent.findById(huntTeam.eventId).select('slug offlineExportBatchId').lean()
      : null;
    const install = huntTeam?.teamCode && huntEvent?.offlineExportBatchId
      ? await CampusHuntOfflineInstall.findOne({
        eventId: huntTeam.eventId,
        teamCode: huntTeam.teamCode,
        exportBatchId: huntEvent.offlineExportBatchId,
        expiresAt: { $gt: new Date() },
      }).select('token expiresAt exportBatchId').lean()
      : null;
    if (registration.encryptedHuntPassword) {
      await GameRegistration.updateOne(
        { _id: registration._id },
        { $push: { audit: { action: 'hunt_credentials_revealed', actor: String(req.user.userId) } } },
      );
    }
    return res.json({
      success: true,
      registration: registrationPublic(registration, { includeQr: true }),
      huntAccess: registration.encryptedHuntPassword && huntTeam ? {
        teamCode: huntTeam.teamCode,
        password: decryptCredential(registration.encryptedHuntPassword),
        onlinePath: huntEvent?.slug ? `/campus-hunt/${huntEvent.slug}/team/${huntTeam.teamCode}` : '',
        offlineInstallPath: install?.token ? `/campus-hunt/offline/i/${install.token}` : '',
        offlinePackExpiresAt: install?.expiresAt || null,
        offlineExportBatchId: install?.exportBatchId || '',
      } : null,
      announcements,
      refundRequests,
      disputes,
    });
  } catch (err) {
    return next(err);
  }
};

exports.getMyCollegeProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).populate('collegeId', 'name shortName city').lean();
    if (!user) return res.status(404).json({ success: false, message: 'Profile not found' });
    const registrations = await GameRegistration.find({
      $or: [{ captainUserId: user._id }, { 'members.userId': user._id }],
      status: { $in: ['confirmed', 'checked_in'] },
    }).select('_id status gameId teamName collegeId').lean();
    const results = await GameResult.find({ registrationId: { $in: registrations.map((row) => row._id) }, finalized: true }).lean();
    return res.json({
      success: true,
      profile: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        college: user.collegeId || (user.college ? { name: user.college } : null),
        collegeVerifiedAt: user.collegeVerifiedAt,
        crwdCtrlId: `CC-ST-${String(user._id).slice(-6).toUpperCase()}`,
        gamesPlayed: results.length,
        teamPoints: results.reduce((sum, row) => sum + Number(row.points || 0), 0),
        activeRegistration: registrations[0] ? {
          id: String(registrations[0]._id),
          teamName: registrations[0].teamName,
        } : null,
      },
    });
  } catch (err) {
    return next(err);
  }
};

exports.rankings = async (req, res, next) => {
  try {
    const data = await buildRankings({ city: req.query.city, gameId: req.query.gameId, from: req.query.from, to: req.query.to });
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.json({ success: true, ...data });
  } catch (err) {
    return next(err);
  }
};

exports.createHostRequest = async (req, res, next) => {
  try {
    const fields = ['name', 'email', 'collegeName', 'clubName', 'city', 'gameName', 'gameIdea'];
    if (fields.some((field) => !String(req.body[field] || '').trim())) {
      return res.status(400).json({ success: false, message: 'Complete all required fields' });
    }
    const expectedTeams = req.body.expectedTeams === null || req.body.expectedTeams === undefined || req.body.expectedTeams === ''
      ? null
      : Number(req.body.expectedTeams);
    if (expectedTeams !== null && (!Number.isInteger(expectedTeams) || expectedTeams < 1)) {
      return res.status(400).json({ success: false, message: 'Expected teams must be a positive whole number' });
    }
    const request = await HostGameRequest.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      collegeName: req.body.collegeName,
      clubName: req.body.clubName,
      contactRole: req.body.contactRole,
      city: req.body.city,
      gameName: req.body.gameName,
      gameIdea: req.body.gameIdea,
      expectedTeams,
      preferredDate: req.body.preferredDate || null,
      submittedByUserId: req.user?.userId || null,
    });
    return res.status(201).json({ success: true, requestId: String(request._id) });
  } catch (err) {
    return next(err);
  }
};

const PRE_REGISTRATION_GAMES = {
  'mit-wpu-campus-hunt': { maxTeamSize: 4 },
};

function validatePreRegistration(body = {}) {
  const gameKey = String(body.gameKey || '').trim().toLowerCase();
  const game = PRE_REGISTRATION_GAMES[gameKey];
  if (!game) return { error: 'Pre-registration is not open for this game' };
  const teamName = String(body.teamName || '').trim().replace(/\s+/g, ' ');
  const captainName = String(body.captainName || '').trim().replace(/\s+/g, ' ');
  const email = String(body.email || '').trim().toLowerCase();
  const collegeName = String(body.collegeName || '').trim().replace(/\s+/g, ' ');
  const phone = String(body.phone || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  if (!teamName || teamName.length > 60) return { error: 'Enter a team name up to 60 characters' };
  if (!captainName || captainName.length > 80) return { error: 'Enter the captain name' };
  if (!/^[6-9]\d{9}$/.test(phone)) return { error: 'Enter a valid 10-digit mobile number' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return { error: 'Enter a valid email address' };
  if (!collegeName || collegeName.length > 120) return { error: 'Enter your college name' };
  let teamSize = null;
  if (body.teamSize !== undefined && body.teamSize !== null && body.teamSize !== '') {
    teamSize = Number(body.teamSize);
    if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > game.maxTeamSize) {
      return { error: `Team size must be between 1 and ${game.maxTeamSize}` };
    }
  }
  return { value: { gameKey, teamName, captainName, phone, email, collegeName, teamSize } };
}
exports.validatePreRegistration = validatePreRegistration;

exports.createPreRegistration = async (req, res, next) => {
  try {
    const { error, value } = validatePreRegistration(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const entry = await GamePreRegistration.create({ ...value, submittedByUserId: req.user?.userId || null });
    return res.status(201).json({ success: true, preRegistrationId: String(entry._id) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'This mobile number has already pre-registered a team' });
    }
    return next(err);
  }
};

function collegePayload(body = {}, { partial = false } = {}) {
  const output = {};
  const put = (key, value) => { if (!partial || body[key] !== undefined) output[key] = value; };
  put('name', String(body.name || '').trim());
  put('shortName', String(body.shortName || '').trim());
  if (!partial || body.slug !== undefined || body.shortName !== undefined || body.name !== undefined) {
    output.slug = String(body.slug || body.shortName || body.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  put('city', String(body.city || '').trim());
  put('emailDomains', cleanStrings(body.emailDomains).map((item) => item.toLowerCase().replace(/^@/, '')));
  put('status', body.status === 'inactive' ? 'inactive' : 'active');
  return output;
}

function gamePayload(body = {}) {
  const output = {};
  const strings = ['title', 'slug', 'tagline', 'description', 'coverImage', 'city', 'venue', 'meetingPoint', 'gameType'];
  for (const field of strings) if (body[field] !== undefined) output[field] = String(body[field] || '').trim();
  if (output.slug) output.slug = output.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const field of ['startsAt', 'endsAt', 'registrationOpensAt', 'registrationClosesAt', 'checkInOpensAt', 'checkInClosesAt']) {
    if (body[field] !== undefined) output[field] = body[field] ? new Date(body[field]) : null;
  }
  for (const field of ['teamSize', 'capacity', 'feePerTeam', 'platformFeePercent']) if (body[field] !== undefined) output[field] = Number(body[field]) || 0;
  if (body.hostCollegeId !== undefined) output.hostCollegeId = body.hostCollegeId || null;
  if (body.allowedCollegeIds !== undefined) output.allowedCollegeIds = cleanStrings(body.allowedCollegeIds);
  if (body.participationMode !== undefined) output.participationMode = body.participationMode === 'on_campus' ? 'on_campus' : 'intercollege';
  if (body.rules !== undefined) output.rules = cleanStrings(body.rules);
  if (body.steps !== undefined) output.steps = cleanStrings(body.steps);
  if (body.status !== undefined) output.status = ['draft', 'published', 'completed', 'cancelled'].includes(body.status) ? body.status : 'draft';
  if (body.engine !== undefined) output.engine = {
    type: body.engine?.type === 'campus_hunt' ? 'campus_hunt' : 'none',
    eventId: body.engine?.eventId || undefined,
    eventSlug: String(body.engine?.eventSlug || '').trim(),
  };
  if (body.offlineEnabled !== undefined) output.offlineEnabled = body.offlineEnabled === true;
  if (body.placementPoints !== undefined) output.placementPoints = (body.placementPoints || []).map(Number).filter((value) => Number.isFinite(value) && value >= 0);
  return output;
}

exports.adminList = async (req, res, next) => {
  try {
    const [games, colleges, hostRequests, registrations, preRegistrations] = await Promise.all([
      CollegeGame.find().populate('hostCollegeId', 'name shortName').sort({ createdAt: -1 }).lean(),
      College.find().sort({ name: 1 }).lean(),
      HostGameRequest.find().sort({ createdAt: -1 }).limit(100).lean(),
      GameRegistration.find().populate('gameId', 'title').populate('collegeId', 'name shortName').sort({ createdAt: -1 }).limit(200).lean(),
      GamePreRegistration.find().sort({ createdAt: -1 }).limit(500).lean(),
    ]);
    return res.json({ success: true, games, colleges, hostRequests, registrations, preRegistrations });
  } catch (err) {
    return next(err);
  }
};

exports.adminCreateCollege = async (req, res, next) => {
  try {
    const payload = collegePayload(req.body);
    if (!payload.name || !payload.slug || !payload.emailDomains.length) return res.status(400).json({ message: 'Name, slug and email domains are required' });
    const college = await College.findOneAndUpdate(
      { slug: payload.slug },
      { $set: payload },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.status(200).json({ success: true, college });
  } catch (err) { return next(err); }
};

exports.adminUpdateCollege = async (req, res, next) => {
  try {
    const college = await College.findByIdAndUpdate(req.params.id, collegePayload(req.body, { partial: true }), { new: true, runValidators: true });
    if (!college) return res.status(404).json({ message: 'College not found' });
    return res.json({ success: true, college });
  } catch (err) { return next(err); }
};

exports.adminCreateGame = async (req, res, next) => {
  try {
    const payload = gamePayload(req.body);
    if (!payload.title || !payload.slug) return res.status(400).json({ message: 'Title and slug are required' });
    return res.status(201).json({ success: true, game: await CollegeGame.create(payload) });
  } catch (err) { return next(err); }
};

exports.adminUpdateGame = async (req, res, next) => {
  try {
    const game = await CollegeGame.findByIdAndUpdate(req.params.id, gamePayload(req.body), { new: true, runValidators: true });
    if (!game) return res.status(404).json({ message: 'Game not found' });
    return res.json({ success: true, game });
  } catch (err) { return next(err); }
};

exports.adminUpdateHostRequest = async (req, res, next) => {
  try {
    const update = {};
    if (['new', 'reviewing', 'approved', 'rejected'].includes(req.body.status)) update.status = req.body.status;
    if (req.body.adminNotes !== undefined) update.adminNotes = String(req.body.adminNotes || '').trim();
    const request = await HostGameRequest.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!request) return res.status(404).json({ message: 'Host request not found' });
    return res.json({ success: true, request });
  } catch (err) { return next(err); }
};

exports.adminUpdatePreRegistration = async (req, res, next) => {
  try {
    if (!['new', 'contacted', 'converted', 'cancelled'].includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const entry = await GamePreRegistration.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!entry) return res.status(404).json({ message: 'Pre-registration not found' });
    return res.json({ success: true, preRegistration: entry });
  } catch (err) { return next(err); }
};

exports.adminApproveSubstitution = async (req, res, next) => {
  try {
    const registration = await GameRegistration.findById(req.params.id).populate('collegeId');
    const member = registration?.members.id(req.params.memberId);
    if (!registration || !member) return res.status(404).json({ message: 'Team member not found' });
    const nextEmail = String(req.body.email || member.email).trim().toLowerCase();
    const nextName = String(req.body.name || member.name).trim();
    if (!nextName || !collegeAcceptsEmail(registration.collegeId, nextEmail)) {
      return res.status(400).json({ message: 'Substitute must use the registered college email domain' });
    }
    const duplicate = registration.captainEmail === nextEmail
      || registration.members.some((candidate) => String(candidate._id) !== String(member._id) && candidate.email === nextEmail);
    if (duplicate) return res.status(409).json({ message: 'This email is already on the team' });
    const before = { name: member.name, email: member.email, status: member.status };
    member.name = nextName;
    member.email = nextEmail;
    member.status = 'substitution_approved';
    member.verifiedAt = new Date();
    registration.audit.push({ action: 'substitution_approved', actor: String(req.user?.userId || 'admin'), detail: { memberId: String(member._id), before, after: { name: nextName, email: nextEmail } } });
    await registration.save();
    return res.json({ success: true, registration });
  } catch (err) { return next(err); }
};

exports.adminCheckIn = async (req, res, next) => {
  try {
    const parsed = verifyPassToken(req.body.qrToken);
    if (!parsed) return res.status(400).json({ success: false, message: 'Invalid game pass' });
    const registration = await GameRegistration.findById(parsed.registrationId).select('+qrTokenHash').populate('gameId');
    if (!registration || registration.passId !== parsed.passId || registration.qrTokenHash !== sha256(req.body.qrToken)) {
      return res.status(400).json({ success: false, message: 'Invalid game pass' });
    }
    if (registration.status === 'checked_in') return res.status(409).json({ success: false, message: 'Team is already checked in', checkedInAt: registration.checkedInAt });
    if (registration.status !== 'confirmed') return res.status(409).json({ success: false, message: 'Registration is not confirmed' });
    if (!teamReadyForCheckIn(registration.members)) {
      return res.status(409).json({ success: false, message: 'Every teammate must be verified before check-in' });
    }
    const game = registration.gameId;
    if (!isWithinCheckInWindow(game)) return res.status(409).json({ success: false, message: 'Check-in is outside the allowed time window' });
    registration.status = 'checked_in';
    registration.checkedInAt = new Date();
    registration.checkedInBy = String(req.user?.userId || 'admin');
    registration.audit.push({ action: 'checked_in', actor: registration.checkedInBy });
    await registration.save();
    return res.json({ success: true, registration: registrationPublic(registration) });
  } catch (err) { return next(err); }
};

exports.adminFinalizeResult = async (req, res, next) => {
  try {
    const registration = await GameRegistration.findById(req.body.registrationId).populate('gameId');
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    const rank = Math.max(1, Number(req.body.placement) || 1);
    const points = req.body.points == null ? placementPoints(registration.gameId, rank) : Math.max(0, Number(req.body.points) || 0);
    const before = await GameResult.findOne({ registrationId: registration._id }).lean();
    const result = await GameResult.findOneAndUpdate(
      { registrationId: registration._id },
      {
        $set: {
          gameId: registration.gameId._id,
          collegeId: registration.collegeId,
          teamName: registration.teamName,
          placement: rank,
          points,
          finalized: req.body.finalized !== false,
          finalizedAt: new Date(),
        },
        $push: { audit: { action: before ? 'result_updated' : 'result_finalized', actor: String(req.user?.userId || 'admin'), before, after: { placement: rank, points } } },
      },
      { new: true, upsert: true, runValidators: true },
    );
    return res.json({ success: true, result });
  } catch (err) { return next(err); }
};

exports.adminResults = async (req, res, next) => {
  try {
    const query = req.query.gameId ? { gameId: req.query.gameId } : {};
    const results = await GameResult.find(query).populate('gameId', 'title').populate('collegeId', 'name shortName').sort({ finalizedAt: -1 }).lean();
    return res.json({ success: true, results });
  } catch (err) { return next(err); }
};
