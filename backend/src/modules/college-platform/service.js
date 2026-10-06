const crypto = require('crypto');
const User = require('../../model/usermodel');
const PaymentOrder = require('../../model/payment_order_model');
const CampusHuntTeam = require('../campus-hunt/models/CampusHuntTeam');
const CampusHuntRound = require('../campus-hunt/models/CampusHuntRound');
const {
  College,
  CollegeGame,
  GameRegistration,
  GameInvite,
  GameResult,
} = require('./models');

const RESERVATION_MS = 15 * 60 * 1000;
const INVITE_MS = 14 * 24 * 60 * 60 * 1000;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function emailDomain(email) {
  return String(email || '').trim().toLowerCase().split('@')[1] || '';
}

function collegeAcceptsEmail(college, email) {
  const domain = emailDomain(email);
  return Boolean(domain && (college?.emailDomains || []).some((item) => String(item).toLowerCase() === domain));
}

function placementPoints(game, placement) {
  const rank = Math.max(1, Number(placement) || 1);
  const configured = (game?.placementPoints || []).map(Number).filter(Number.isFinite);
  if (configured[rank - 1] != null) return Math.max(0, configured[rank - 1]);
  if (rank === 1) return 100;
  if (rank === 2) return 80;
  if (rank === 3) return 60;
  return Math.max(10, 60 - ((rank - 3) * 10));
}

function teamReadyForCheckIn(members = []) {
  return members.every((member) => ['verified', 'substitution_approved'].includes(member.status));
}

function isWithinCheckInWindow(game, at = new Date()) {
  const timestamp = new Date(at).getTime();
  const opens = game.checkInOpensAt ? new Date(game.checkInOpensAt).getTime() : (game.startsAt ? new Date(game.startsAt).getTime() - (3 * 60 * 60 * 1000) : 0);
  const closes = game.checkInClosesAt ? new Date(game.checkInClosesAt).getTime() : (game.endsAt ? new Date(game.endsAt).getTime() + (60 * 60 * 1000) : Number.MAX_SAFE_INTEGER);
  return timestamp >= opens && timestamp <= closes;
}

async function releaseExpiredReservations(gameId = null) {
  const query = {
    status: { $in: ['reserved', 'pending_payment'] },
    slotHeld: true,
    reservationExpiresAt: { $lte: new Date() },
  };
  if (gameId) query.gameId = gameId;
  const expired = await GameRegistration.find(query).select('_id gameId').lean();
  for (const registration of expired) {
    const updated = await GameRegistration.findOneAndUpdate(
      { _id: registration._id, slotHeld: true, status: { $in: ['reserved', 'pending_payment'] } },
      { $set: { status: 'expired', slotHeld: false }, $unset: { participantKeys: 1 }, $push: { audit: { action: 'reservation_expired', actor: 'system' } } },
      { new: true },
    );
    if (updated) {
      await CollegeGame.updateOne(
        { _id: registration.gameId, reservedSlots: { $gt: 0 } },
        { $inc: { reservedSlots: -1 } },
      );
    }
  }
  return expired.length;
}

async function reserveTeamSlot({ gameId, collegeId, user, body }) {
  await releaseExpiredReservations(gameId);
  const [game, college] = await Promise.all([
    CollegeGame.findOne({ _id: gameId, status: 'published' }),
    College.findOne({ _id: collegeId, status: 'active' }),
  ]);
  if (!game) {
    const err = new Error('Game not found or registration is unavailable');
    err.status = 404;
    throw err;
  }
  if (!college) {
    const err = new Error('Select an approved college');
    err.status = 400;
    throw err;
  }
  const now = Date.now();
  if (game.registrationOpensAt && new Date(game.registrationOpensAt).getTime() > now) {
    const err = new Error('Registration has not opened yet');
    err.status = 409;
    throw err;
  }
  if (game.registrationClosesAt && new Date(game.registrationClosesAt).getTime() <= now) {
    const err = new Error('Registration is closed');
    err.status = 409;
    throw err;
  }
  if (game.allowedCollegeIds?.length && !game.allowedCollegeIds.some((id) => String(id) === String(college._id))) {
    const err = new Error('This college is not eligible for the game');
    err.status = 403;
    throw err;
  }
  if (!user.isVerified || !collegeAcceptsEmail(college, user.email)) {
    const err = new Error(`Sign in with a verified ${college.name} college email`);
    err.status = 403;
    err.code = 'COLLEGE_EMAIL_REQUIRED';
    throw err;
  }

  const members = Array.isArray(body.members) ? body.members : [];
  if (members.length !== Math.max(1, game.teamSize - 1)) {
    const err = new Error(`Add exactly ${Math.max(1, game.teamSize - 1)} teammate(s)`);
    err.status = 400;
    throw err;
  }
  const normalizedMembers = members.map((member) => ({
    name: String(member?.name || '').trim(),
    email: String(member?.email || '').trim().toLowerCase(),
  }));
  if (normalizedMembers.some((member) => !member.name || !member.email)) {
    const err = new Error('Every teammate needs a name and college email');
    err.status = 400;
    throw err;
  }
  const emails = [String(user.email || '').toLowerCase(), ...normalizedMembers.map((member) => member.email)];
  if (new Set(emails).size !== emails.length) {
    const err = new Error('Each team member must use a different email');
    err.status = 409;
    throw err;
  }
  if (normalizedMembers.some((member) => !collegeAcceptsEmail(college, member.email))) {
    const err = new Error(`All teammates must use a ${college.name} college email`);
    err.status = 403;
    err.code = 'TEAM_COLLEGE_EMAIL_REQUIRED';
    throw err;
  }
  const captainName = String(body.captainName || user.name || '').trim();
  const teamName = String(body.teamName || '').trim();
  if (!captainName || !teamName) {
    const err = new Error('Captain and team names are required');
    err.status = 400;
    throw err;
  }

  const existing = await GameRegistration.findOne({
    gameId: game._id,
    $or: [
      { captainUserId: user._id },
      { captainEmail: { $in: emails } },
      { 'members.email': { $in: emails } },
    ],
    status: { $in: ['reserved', 'pending_payment', 'confirmed', 'checked_in', 'manual_review'] },
  });
  if (existing) {
    const existingMemberEmails = (existing.members || []).map((member) => member.email).sort();
    const submittedMemberEmails = normalizedMembers.map((member) => member.email).sort();
    if (
      String(existing.captainUserId) === String(user._id)
      && ['reserved', 'pending_payment'].includes(existing.status)
      && (!existing.reservationExpiresAt || new Date(existing.reservationExpiresAt).getTime() > now)
      && existing.teamName === teamName
      && JSON.stringify(existingMemberEmails) === JSON.stringify(submittedMemberEmails)
    ) {
      return { game, college, registration: existing, reused: true };
    }
    const err = new Error('A team member is already registered for this game');
    err.status = 409;
    err.code = 'GAME_MEMBER_DUPLICATE';
    throw err;
  }

  const heldGame = await CollegeGame.findOneAndUpdate(
    { _id: game._id, status: 'published', $expr: { $lt: ['$reservedSlots', '$capacity'] } },
    { $inc: { reservedSlots: 1 } },
    { new: true },
  );
  if (!heldGame) {
    const err = new Error('This game is full');
    err.status = 409;
    err.code = 'GAME_FULL';
    throw err;
  }

  try {
    await User.updateOne(
      { _id: user._id },
      { $set: { college: college.name, collegeId: college._id, collegeVerifiedAt: new Date(), collegeVerificationMethod: 'email_domain' } },
    );
    const registration = await GameRegistration.create({
      gameId: game._id,
      collegeId: college._id,
      captainUserId: user._id,
      captainName,
      captainEmail: String(user.email || '').trim().toLowerCase(),
      captainPhone: String(body.captainPhone || user.phoneNumber || '').trim(),
      captainVerifiedAt: new Date(),
      teamName,
      participantKeys: emails.map((email) => `${game._id}:${email}`),
      members: normalizedMembers,
      status: Number(game.feePerTeam) > 0 ? 'pending_payment' : 'reserved',
      reservationExpiresAt: new Date(Date.now() + RESERVATION_MS),
      audit: [{ action: 'slot_reserved', actor: String(user._id) }],
    });
    return { game: heldGame, college, registration };
  } catch (err) {
    await CollegeGame.updateOne({ _id: game._id, reservedSlots: { $gt: 0 } }, { $inc: { reservedSlots: -1 } });
    throw err;
  }
}

function signedPassToken(registration) {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET is required for game passes');
  const payload = `${registration._id}.${registration.gameId}.${registration.passId}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyPassToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return null;
  const payload = parts.slice(0, 3).join('.');
  const expected = crypto.createHmac('sha256', String(process.env.JWT_SECRET || '')).update(payload).digest('base64url');
  const actual = parts[3];
  if (expected.length !== actual.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) return null;
  return { registrationId: parts[0], gameId: parts[1], passId: parts[2] };
}

async function ensureMemberUser(member, college) {
  let user = await User.findOne({ email: member.email });
  if (user) return user;
  user = await User.create({
    name: member.name,
    email: member.email,
    password: randomToken(18),
    role: 'student',
    college: college.name,
    isVerified: false,
    signupMethod: 'password',
  });
  return user;
}

async function provisionCampusHuntTeam(registration, game, college) {
  if (game.engine?.type !== 'campus_hunt' || !game.engine?.eventId) return null;
  if (registration.huntTeamId) return registration.huntTeamId;
  const memberUsers = [];
  for (const member of registration.members) {
    memberUsers.push(await ensureMemberUser(member, college));
  }
  const round = await CampusHuntRound.findOne({ eventId: game.engine.eventId, roundNumber: 1 }).select('_id');
  const teamCode = `CC${String(registration.passId).replace(/[^A-Z0-9]/gi, '').slice(-8)}`.toUpperCase();
  let team = await CampusHuntTeam.findOne({ eventId: game.engine.eventId, teamCode });
  if (!team) {
    team = await CampusHuntTeam.create({
      eventId: game.engine.eventId,
      roundId: round?._id || null,
      teamCode,
      teamName: registration.teamName,
      leaderUserId: registration.captainUserId,
      memberUserIds: memberUsers.map((user) => user._id),
      leaderName: registration.captainName,
      leaderContactEmail: registration.captainEmail,
      memberNames: registration.members.map((member) => member.name),
    });
  }
  registration.huntTeamId = team._id;
  return team._id;
}

async function createInvites(registration, game) {
  const { sendCollegeGameInviteEmail } = require('../../services/emailService');
  const created = [];
  for (const member of registration.members) {
    const exists = await GameInvite.findOne({ registrationId: registration._id, memberId: member._id });
    if (exists) continue;
    const token = randomToken();
    const invite = await GameInvite.create({
      registrationId: registration._id,
      memberId: member._id,
      email: member.email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + INVITE_MS),
    });
    try {
      await sendCollegeGameInviteEmail({
        email: member.email,
        name: member.name,
        captainName: registration.captainName,
        gameTitle: game.title,
        teamName: registration.teamName,
        token,
      });
      invite.emailSentAt = new Date();
      await invite.save();
    } catch (error) {
      console.error('[college-platform] Invite email failed:', member.email, error.message);
    }
    created.push({ email: member.email, token });
  }
  return created;
}

async function fulfillGameRegistration(paymentOrderInput) {
  const paymentOrder = typeof paymentOrderInput === 'string'
    ? await PaymentOrder.findOne({ orderId: paymentOrderInput })
    : paymentOrderInput;
  if (!paymentOrder || paymentOrder.entityType !== 'game_registration') {
    const err = new Error('Game payment order not found');
    err.status = 404;
    throw err;
  }
  const registrationId = paymentOrder.orderTags?.registrationId;
  const registration = await GameRegistration.findById(registrationId).select('+qrToken +qrTokenHash');
  if (!registration) throw new Error('Game registration reservation not found');
  if (registration.status === 'confirmed' || registration.status === 'checked_in') return { registration };

  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claimed = await GameRegistration.findOneAndUpdate(
    {
      _id: registration._id,
      $or: [
        { fulfillmentState: 'idle' },
        { fulfillmentState: { $exists: false } },
        { fulfillmentState: 'processing', fulfillmentStartedAt: { $lt: staleBefore } },
      ],
    },
    { $set: { fulfillmentState: 'processing', fulfillmentStartedAt: new Date(), paymentOrderId: paymentOrder.orderId } },
    { new: true },
  ).select('+qrToken +qrTokenHash');
  if (!claimed) return { registration: await GameRegistration.findById(registration._id) };

  try {
    let [game, college] = await Promise.all([
      CollegeGame.findById(claimed.gameId),
      College.findById(claimed.collegeId),
    ]);
    if (!game || !college) throw new Error('Game or college was removed');
    if (claimed.status === 'expired' && !claimed.slotHeld) {
      game = await CollegeGame.findOneAndUpdate(
        { _id: game._id, $expr: { $lt: ['$reservedSlots', '$capacity'] } },
        { $inc: { reservedSlots: 1 } },
        { new: true },
      );
      if (!game) {
        claimed.status = 'manual_review';
        claimed.fulfillmentState = 'review';
        claimed.paymentOrderId = paymentOrder.orderId;
        claimed.amountPaid = Number(paymentOrder.totalAmount) || 0;
        claimed.audit.push({ action: 'late_payment_capacity_full', actor: 'payment', detail: { orderId: paymentOrder.orderId } });
        await claimed.save();
        return { registration: claimed, manualReview: true };
      }
      claimed.slotHeld = true;
    }
    claimed.passId = claimed.passId || `CC-GP-${String(claimed._id).slice(-8).toUpperCase()}`;
    const token = signedPassToken(claimed);
    claimed.qrToken = token;
    claimed.qrTokenHash = sha256(token);
    await provisionCampusHuntTeam(claimed, game, college);
    claimed.status = 'confirmed';
    claimed.amountPaid = Number(paymentOrder.totalAmount) || 0;
    claimed.reservationExpiresAt = null;
    claimed.fulfillmentState = 'complete';
    claimed.fulfillmentStartedAt = null;
    claimed.audit.push({ action: 'payment_fulfilled', actor: 'payment', detail: { orderId: paymentOrder.orderId } });
    await claimed.save();
    const invites = await createInvites(claimed, game);
    return { registration: claimed, invites };
  } catch (err) {
    await GameRegistration.updateOne(
      { _id: claimed._id, fulfillmentState: 'processing' },
      { $set: { fulfillmentState: 'idle', fulfillmentStartedAt: null }, $push: { audit: { action: 'fulfillment_failed', actor: 'system', detail: { message: err.message } } } },
    );
    throw err;
  }
}

async function confirmFreeRegistration(registrationId) {
  const registration = await GameRegistration.findById(registrationId);
  if (!registration) return null;
  const synthetic = {
    entityType: 'game_registration',
    totalAmount: 0,
    orderId: `FREE-${registration._id}`,
    orderTags: { registrationId: String(registration._id) },
  };
  return fulfillGameRegistration(synthetic);
}

function aggregateRankings(results = []) {
  const teamMap = new Map();
  const byCollegeGame = new Map();
  for (const result of results) {
    const collegeId = String(result.collegeId?._id || result.collegeId);
    const collegeName = result.collegeId?.shortName || result.collegeId?.name || 'College';
    const teamKey = `${collegeId}:${String(result.teamName).toLowerCase()}`;
    const team = teamMap.get(teamKey) || { teamName: result.teamName, collegeId, collegeName, points: 0, wins: 0, games: 0 };
    team.points += Number(result.points) || 0;
    team.wins += Number(result.placement) === 1 ? 1 : 0;
    team.games += 1;
    teamMap.set(teamKey, team);
    const cgKey = `${collegeId}:${result.gameId}`;
    const rows = byCollegeGame.get(cgKey) || [];
    rows.push(result);
    byCollegeGame.set(cgKey, rows);
  }
  const collegeMap = new Map();
  for (const rows of byCollegeGame.values()) {
    rows.sort((a, b) => (b.points - a.points) || (a.placement - b.placement) || String(a.teamName).localeCompare(String(b.teamName)));
    for (const result of rows.slice(0, 3)) {
      const collegeId = String(result.collegeId?._id || result.collegeId);
      const collegeName = result.collegeId?.shortName || result.collegeId?.name || 'College';
      const college = collegeMap.get(collegeId) || { collegeId, collegeName, points: 0, wins: 0, teams: new Set(), games: new Set() };
      college.points += Number(result.points) || 0;
      college.wins += Number(result.placement) === 1 ? 1 : 0;
      college.teams.add(String(result.registrationId));
      college.games.add(String(result.gameId));
      collegeMap.set(collegeId, college);
    }
  }
  const sorter = (a, b) => (b.points - a.points) || (b.wins - a.wins) || String(a.collegeName || a.teamName).localeCompare(String(b.collegeName || b.teamName));
  const colleges = [...collegeMap.values()].map((row) => ({ ...row, teams: row.teams.size, games: row.games.size })).sort(sorter).map((row, index) => ({ ...row, rank: index + 1 }));
  const teams = [...teamMap.values()].sort((a, b) => (b.points - a.points) || (b.wins - a.wins) || a.teamName.localeCompare(b.teamName)).map((row, index) => ({ ...row, rank: index + 1 }));
  return { colleges, teams };
}

async function buildRankings({ city = '', gameId = '', from = null, to = null } = {}) {
  const gameQuery = {};
  if (city) gameQuery.city = new RegExp(`^${String(city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (gameId) gameQuery._id = gameId;
  const games = await CollegeGame.find(gameQuery).select('_id title city startsAt').lean();
  const gameIds = games.map((game) => game._id);
  const resultQuery = { finalized: true, gameId: { $in: gameIds } };
  if (from || to) {
    resultQuery.finalizedAt = {};
    if (from) resultQuery.finalizedAt.$gte = new Date(from);
    if (to) resultQuery.finalizedAt.$lte = new Date(to);
  }
  const results = await GameResult.find(resultQuery).populate('collegeId', 'name shortName city').lean();
  return { ...aggregateRankings(results), games, updatedAt: new Date().toISOString() };
}

module.exports = {
  RESERVATION_MS,
  sha256,
  randomToken,
  collegeAcceptsEmail,
  placementPoints,
  teamReadyForCheckIn,
  isWithinCheckInWindow,
  releaseExpiredReservations,
  reserveTeamSlot,
  fulfillGameRegistration,
  confirmFreeRegistration,
  signedPassToken,
  verifyPassToken,
  aggregateRankings,
  buildRankings,
};
