'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Competition = require('../model/competition_model');
const Registration = require('../model/registration_model');
const User = require('../model/usermodel');
const Invite = require('../model/mindspark_auditorium_invite_model');
const TicketClaim = require('../model/mindspark_auditorium_ticket_claim_model');
const AuditoriumStudent = require('../model/mindspark_auditorium_student_model');
const AuditoriumOtp = require('../model/mindspark_auditorium_otp_model');
const {
  MINDSPARK_FEST_ID,
  AUDITORIUM_COMPETITION_NAME,
  AUDITORIUM_MODULE,
  defaultAuditoriumConfig,
  normalizeAuditoriumConfig,
  sumSeats,
  sanitizeCategories,
  cloudinaryPathKey,
} = require('../modules/fest/plugins/mindsparkAuditorium');
const { isMindSparkFestId } = require('../modules/fest/plugins/mindspark');
const {
  buildCategoryStats,
  claimCategorySeat,
  releaseCategorySeat,
  syncCategoryCounter,
} = require('../utils/auditoriumQuota');
const {
  findApprovedCompetitionDuplicate,
  phoneDigits,
  clean,
  validEmail,
} = require('../utils/competitionDuplicateGuard');
const { sendAuditoriumPassEmail, sendAuditoriumPassDeclinedEmail } = require('../services/emailService');
const { sendAuditoriumOtpEmail } = require('../services/emailService');
const { getJwtSecret } = require('../config/jwtSecret');
const {
  DIRECTORY_YEARS,
  normalizeDirectoryEmail,
  directoryEmailHash,
  otpCodeHash,
  signEligibilityToken,
  verifyEligibilityToken,
  extractDirectoryEmails,
} = require('../utils/auditoriumDirectory');

const FRONTEND = () => String(
  process.env.PRODUCTION_FRONTEND_URL
  || process.env.PUBLIC_FRONTEND_URL
  || process.env.FRONTEND_URL
  || 'https://www.crwdctrl.in',
).replace(/\/$/, '');

function responsesToObject(responses) {
  if (!responses) return {};
  if (responses instanceof Map) return Object.fromEntries(responses);
  if (typeof responses.toObject === 'function') return responses.toObject();
  return { ...responses };
}

function ticketPhotoFrom(reg) {
  if (reg?.ticketPhotoUrl) return String(reg.ticketPhotoUrl);
  const r = responsesToObject(reg?.responses);
  return String(r.ticket_photo || r.ticketPhoto || '').trim();
}

function idCardPhotoFrom(reg) {
  if (reg?.idCardPhotoUrl) return String(reg.idCardPhotoUrl);
  const r = responsesToObject(reg?.responses);
  return String(r.id_card_photo || r.idCardPhoto || '').trim();
}

function isHttpUrl(value) {
  try {
    const u = new URL(String(value || '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Only accept Cloudinary URLs from our cloud (optionally auditorium-tickets folder). */
function assertTrustedPhotoUrl(value, label = 'Photo', { requireAuditoriumFolder = true } = {}) {
  const raw = String(value || '').trim();
  if (!raw) {
    const err = new Error(`${label} is required`);
    err.status = 400;
    throw err;
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    const err = new Error(`Invalid ${label.toLowerCase()} URL`);
    err.status = 400;
    throw err;
  }
  const isDev = process.env.NODE_ENV !== 'production';
  if (u.protocol !== 'https:' && !(isDev && u.protocol === 'http:')) {
    const err = new Error(`${label} must be an https upload`);
    err.status = 400;
    throw err;
  }
  const host = u.hostname.toLowerCase();
  const cloud = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim().toLowerCase();
  const isCloudinary = host === 'res.cloudinary.com'
    || host.endsWith('.cloudinary.com')
    || host.includes('cloudinary');
  if (!isCloudinary) {
    const err = new Error(`${label} must be uploaded through CrwdCtrl (not an external link)`);
    err.status = 400;
    err.code = 'UNTRUSTED_PHOTO';
    throw err;
  }
  if (cloud && !u.href.toLowerCase().includes(cloud)) {
    const err = new Error(`${label} must be from CrwdCtrl uploads`);
    err.status = 400;
    err.code = 'UNTRUSTED_PHOTO';
    throw err;
  }
  if (requireAuditoriumFolder) {
    const path = u.pathname.toLowerCase();
    // Prefer dedicated folder; also accept legacy uploads that landed in /crwdctrl/
    // before auditorium-tickets was allowlisted (sanitize used to rewrite the folder).
    const okFolder = path.includes('auditorium-tickets') || path.includes('/crwdctrl');
    if (!okFolder) {
      const err = new Error(`${label} must be uploaded via the auditorium form`);
      err.status = 400;
      err.code = 'UNTRUSTED_PHOTO';
      throw err;
    }
  }
  return raw;
}

/** Indian mobile: accepts +91 / 0 prefixes, returns 10 digits or '' */
function normalizeMobile(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

function passAccessDigest(registrationId) {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(`auditorium-pass:${registrationId}`)
    .digest('hex');
}

function passAccessToken(registrationId) {
  return passAccessDigest(registrationId).slice(0, 32);
}

/** Accepts the short 32-char token and the full 64-char digest (used in final confirmation emails). */
function isValidPassAccess(registrationId, token) {
  const given = Buffer.from(String(token || ''));
  const full = passAccessDigest(registrationId);
  const expected = Buffer.from(given.length === full.length ? full : full.slice(0, 32));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function guestPassLink(registrationId) {
  return `/qr-ticket/${registrationId}?auditorium=1&access=${passAccessToken(registrationId)}`;
}

function formatTicket(reg, competition) {
  const r = responsesToObject(reg.responses);
  const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
  return {
    id: String(reg._id),
    registrationId: String(reg._id),
    status: reg.status,
    paymentStatus: reg.paymentStatus || 'free',
    checkedIn: Boolean(reg.checkedIn),
    checkedInAt: reg.checkedInAt || null,
    qrCodeData: reg.qrCodeData || null,
    ticketPhotoUrl: ticketPhotoFrom(reg),
    idCardPhotoUrl: idCardPhotoFrom(reg),
    categoryId: r.auditorium_category_id || '',
    categoryLabel: r.auditorium_category_label || '',
    fullName: r.full_name || r.name || user?.name || '',
    email: r.email || user?.email || '',
    phone: r.phone || r.contact_no || user?.phoneNumber || user?.phone || '',
    college: r.college || '',
    misId: r.mis_id || r.mis || '',
    competitionId: String(competition?._id || reg.competitionId || ''),
    competitionName: competition?.name || AUDITORIUM_COMPETITION_NAME,
    ticketUrl: `${FRONTEND()}/qr-ticket/${encodeURIComponent(String(reg._id))}?auditorium=1`,
    submittedAt: reg.submittedAt || reg.createdAt,
  };
}

const auditoriumCompetitionCache = new Map();
const AUDITORIUM_COMPETITION_TTL_MS = 30_000;

async function ensureAuditoriumCompetition(festId = MINDSPARK_FEST_ID) {
  if (!isMindSparkFestId(festId)) {
    const err = new Error('Auditorium is only available for MindSpark');
    err.status = 400;
    throw err;
  }
  const cacheKey = String(festId);
  const cached = auditoriumCompetitionCache.get(cacheKey);
  if (cached && Date.now() - cached.at < AUDITORIUM_COMPETITION_TTL_MS) {
    return cached.doc;
  }
  let competition = await Competition.findOne({
    fest: festId,
    'auditorium.enabled': true,
  });
  if (competition) {
    if (!Array.isArray(competition.auditorium?.categories) || !competition.auditorium.categories.length) {
      const cfg = defaultAuditoriumConfig();
      competition.auditorium = { ...cfg, ...(competition.auditorium?.toObject?.() || competition.auditorium || {}) };
      competition.auditorium.categories = cfg.categories;
      competition.slotsAllotted = sumSeats(cfg.categories);
      await competition.save();
    }
    auditoriumCompetitionCache.set(cacheKey, { at: Date.now(), doc: competition });
    return competition;
  }

  const cfg = defaultAuditoriumConfig();
  competition = await Competition.create({
    fest: festId,
    name: AUDITORIUM_COMPETITION_NAME,
    module: AUDITORIUM_MODULE,
    competitionType: 'cultural',
    dateTime: 'MindSpark Auditorium Night — TBA',
    venue: 'COEP Auditorium',
    description: 'MindSpark auditorium night — free photo tickets with year-wise seat quotas.',
    feeAmount: 0,
    slotsAllotted: sumSeats(cfg.categories),
    showSlotsPublic: true,
    teamSizeMin: 1,
    teamSizeMax: 1,
    teamSizeLabel: 'Solo',
    registrationType: 'custom',
    registration: {
      status: 'internal_form',
      formType: 'SINGLE_STEP',
      settings: {
        allowMultipleRegistrations: false,
        autoConfirmation: true,
        maxRegistrations: sumSeats(cfg.categories),
      },
    },
    auditorium: cfg,
    isApproved: true,
  });
  auditoriumCompetitionCache.set(cacheKey, { at: Date.now(), doc: competition });
  return competition;
}

async function findInvite(competitionId, code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  return Invite.findOne({ competitionId, code: normalized });
}

function publicMetaPayload(competition, stats, inviteCategory = null) {
  const cfg = normalizeAuditoriumConfig(competition.auditorium || {});
  const publicCats = (stats.categories || [])
    .filter((c) => c.channel === 'public' && c.enabled !== false)
    .map((c) => ({
      id: c.id,
      label: c.label,
      seats: c.seats,
      filled: c.filled,
      left: c.left,
      full: c.full,
    }));
  return {
    competitionId: String(competition._id),
    name: competition.name,
    showPublicTicketBox: cfg.showPublicTicketBox,
    registrationOpen: cfg.registrationOpen,
    requireTicketPhoto: cfg.requireTicketPhoto,
    requireDirectoryOtp: cfg.requireDirectoryOtp,
    registerUrl: '/mindspark/auditorium',
    totalLeft: stats.totalLeft,
    totalSeats: stats.totalSeats,
    totalFilled: stats.totalFilled,
    categories: publicCats,
    inviteCategory: inviteCategory
      ? {
        id: inviteCategory.id,
        label: inviteCategory.label,
        left: inviteCategory.left,
        full: inviteCategory.full,
      }
      : null,
  };
}

/** GET /mindspark/auditorium/meta?code= — cache unscoped meta briefly under rush. */
const auditoriumMetaCache = { at: 0, payload: null };
const AUDITORIUM_META_TTL_MS = 5_000;

exports.getPublicMeta = async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code && auditoriumMetaCache.payload && Date.now() - auditoriumMetaCache.at < AUDITORIUM_META_TTL_MS) {
      res.set('Cache-Control', 'no-store');
      return res.json(auditoriumMetaCache.payload);
    }

    const competition = await ensureAuditoriumCompetition(MINDSPARK_FEST_ID);
    const stats = await buildCategoryStats(competition);
    let inviteCategory = null;
    if (code) {
      const invite = await findInvite(competition._id, code);
      if (invite?.active && invite.usedCount < invite.maxUses) {
        const cat = stats.categories.find((c) => c.id === invite.categoryId);
        if (cat && (cat.channel === 'invite' || cat.channel === 'desk')) {
          inviteCategory = cat;
        }
      }
    }
    const body = { success: true, data: publicMetaPayload(competition, stats, inviteCategory) };
    if (!code) {
      auditoriumMetaCache.at = Date.now();
      auditoriumMetaCache.payload = body;
    }
    res.set('Cache-Control', 'no-store');
    return res.json(body);
  } catch (error) {
    console.error('[auditorium.getPublicMeta]', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed' });
  }
};

/** POST /mindspark/auditorium/request-otp */
exports.requestDirectoryOtp = async (req, res) => {
  try {
    const email = normalizeDirectoryEmail(req.body?.email);
    if (!email) return res.status(400).json({ success: false, message: 'Enter a valid college email' });
    const competition = await ensureAuditoriumCompetition(MINDSPARK_FEST_ID);
    const cfg = normalizeAuditoriumConfig(competition.auditorium || {});
    if (!cfg.requireDirectoryOtp) return res.status(400).json({ success: false, message: 'Directory verification is not enabled' });
    if (!cfg.registrationOpen) return res.status(403).json({ success: false, message: 'Registration is not open yet' });

    const emailHash = directoryEmailHash(email);
    const student = await AuditoriumStudent.findOne({ competitionId: competition._id, emailHash }).lean();
    const generic = { success: true, message: 'If this email is eligible, a code has been sent.' };
    if (!student) return res.json({ ...generic, challengeId: crypto.randomBytes(12).toString('hex') });
    const category = sanitizeCategories(cfg.categories).find((item) => item.id === student.categoryId);
    if (!category || category.enabled === false) {
      return res.status(403).json({ success: false, code: 'CATEGORY_CLOSED', message: 'Passes for this year are currently closed' });
    }

    const recent = await AuditoriumOtp.findOne({ competitionId: competition._id, emailHash })
      .sort({ lastSentAt: -1 }).lean();
    if (recent?.lastSentAt && Date.now() - new Date(recent.lastSentAt).getTime() < 60_000) {
      return res.status(429).json({ success: false, message: 'Please wait one minute before requesting another code' });
    }
    const challenge = new AuditoriumOtp({
      competitionId: competition._id,
      emailHash,
      categoryId: student.categoryId,
      codeHash: 'pending',
      expiresAt: new Date(Date.now() + 5 * 60_000),
      attempts: 0,
      lastSentAt: new Date(),
    });
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    challenge.codeHash = otpCodeHash(challenge._id, emailHash, code);
    await challenge.save();
    try {
      await sendAuditoriumOtpEmail(email, code);
    } catch (error) {
      await AuditoriumOtp.deleteOne({ _id: challenge._id }).catch(() => {});
      throw error;
    }
    return res.json({ ...generic, challengeId: String(challenge._id) });
  } catch (error) {
    console.error('[auditorium.requestDirectoryOtp]', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Could not send code' });
  }
};

/** POST /mindspark/auditorium/verify-otp */
exports.verifyDirectoryOtp = async (req, res) => {
  try {
    const challengeId = String(req.body?.challengeId || '');
    const email = normalizeDirectoryEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    if (!mongoose.Types.ObjectId.isValid(challengeId) || !email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Enter the six-digit code' });
    }
    const challenge = await AuditoriumOtp.findById(challengeId).select('+codeHash');
    if (!challenge || challenge.verifiedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) {
      return res.status(400).json({ success: false, message: 'Code is invalid or expired' });
    }
    challenge.attempts += 1;
    const expected = otpCodeHash(challenge._id, challenge.emailHash, code);
    const match = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(challenge.codeHash));
    if (!match) {
      await challenge.save();
      return res.status(400).json({ success: false, message: 'Incorrect code' });
    }
    if (challenge.emailHash !== directoryEmailHash(email)) {
      await challenge.save();
      return res.status(400).json({ success: false, message: 'Code does not match this email' });
    }
    challenge.verifiedAt = new Date();
    await challenge.save();
    const competition = await ensureAuditoriumCompetition(MINDSPARK_FEST_ID);
    const eligibilityToken = signEligibilityToken({
      competitionId: String(competition._id), email,
      emailHash: challenge.emailHash, categoryId: challenge.categoryId,
    });
    return res.json({ success: true, eligibilityToken, email, categoryId: challenge.categoryId });
  } catch (error) {
    console.error('[auditorium.verifyDirectoryOtp]', error);
    return res.status(400).json({ success: false, message: 'Code is invalid or expired' });
  }
};

/** Require a current college-email OTP token (or a valid invite) before issuing upload credentials. */
exports.authorizePublicUpload = async (req, res, next) => {
  try {
    const competition = await ensureAuditoriumCompetition(MINDSPARK_FEST_ID);
    const body = req.body || {};
    const inviteCode = body.inviteCode || body.code;
    if (inviteCode) {
      const invite = await findInvite(competition._id, inviteCode);
      const categoryId = String(body.categoryId || '');
      if (invite?.active && invite.usedCount < invite.maxUses && invite.categoryId === categoryId) {
        return next();
      }
    }

    const collegeEmail = String(body.email || '').trim().toLowerCase();
    if (/@coeptech\.ac\.in$/.test(collegeEmail)) {
      return next();
    }

    const eligibility = verifyEligibilityToken(body.eligibilityToken);
    const email = normalizeDirectoryEmail(eligibility.email);
    const validBinding = String(eligibility.competitionId) === String(competition._id)
      && email
      && eligibility.emailHash === directoryEmailHash(email);
    if (!validBinding) throw new Error('Invalid verification');
    const stillEligible = await AuditoriumStudent.exists({
      competitionId: competition._id,
      emailHash: eligibility.emailHash,
      categoryId: eligibility.categoryId,
    });
    if (!stillEligible) throw new Error('Email is no longer eligible');
    req.auditoriumEligibility = eligibility;
    return next();
  } catch {
    return res.status(403).json({
      success: false,
      code: 'COLLEGE_EMAIL_REQUIRED',
      message: 'Write your college email. It must end with @coeptech.ac.in.',
    });
  }
};

/** Fill missing name/email/phone on an account without tripping the unique email/phone indexes. */
async function fillMissingUserFields(user, { name, email, phone }) {
  let dirty = false;
  if (name && (!user.name || user.name.length < 2)) {
    user.name = name;
    dirty = true;
  }
  if (email && (!user.email || /@crwdctrl\.local$/i.test(String(user.email)))) {
    const taken = await User.exists({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (!taken) {
      user.email = email.toLowerCase();
      dirty = true;
    }
  }
  if (phone && !user.phoneNumber && !user.phone) {
    const taken = await User.exists({ phoneNumber: phone, _id: { $ne: user._id } });
    if (!taken) {
      user.phoneNumber = phone;
      dirty = true;
    }
  }
  if (dirty) {
    try {
      await user.save();
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  return user;
}

async function resolveOrCreateUser({ name, email, phone, userId }) {
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const existing = await User.findById(userId);
    if (existing) return fillMissingUserFields(existing, { name, email, phone });
  }
  let user = null;
  if (email) user = await User.findOne({ email: email.toLowerCase() });
  if (!user && phone) {
    user = await User.findOne({ $or: [{ phone }, { phoneNumber: phone }] });
  }
  if (!user) {
    user = new User({
      name,
      email: email || `auditorium+${crypto.randomBytes(6).toString('hex')}@crwdctrl.local`,
      ...(phone ? { phoneNumber: phone } : {}),
      password: crypto.randomBytes(24).toString('hex'),
      isVerified: true,
      signupMethod: 'password',
    });
    await user.save();
  } else {
    await fillMissingUserFields(user, { name, email, phone });
  }
  return user;
}

/**
 * Shared create path for public + desk + invite.
 * channelHint: public | invite | desk
 */
async function createAuditoriumTicket({
  competition,
  categoryId,
  inviteCode,
  channelHint,
  name,
  email,
  phone,
  college,
  ticketPhotoUrl,
  idCardPhotoUrl,
  honorConfirmed,
  userId,
  organizerNote,
  skipRegistrationOpen,
}) {
  const cfg = normalizeAuditoriumConfig(competition.auditorium || {});
  if (!cfg.enabled) {
    const err = new Error('Auditorium tickets are not enabled');
    err.status = 400;
    throw err;
  }
  if (!skipRegistrationOpen && !cfg.registrationOpen && channelHint === 'public') {
    const err = new Error('Registration is not open yet');
    err.status = 403;
    err.code = 'REGISTRATION_CLOSED';
    throw err;
  }

  const categories = sanitizeCategories(cfg.categories);
  const category = categories.find((c) => c.id === String(categoryId || ''));
  if (!category) {
    const err = new Error('Invalid category');
    err.status = 400;
    throw err;
  }

  if (category.channel === 'public' && category.enabled === false && channelHint === 'public') {
    const err = new Error(`${category.label} auditorium passes are currently closed`);
    err.status = 403;
    err.code = 'CATEGORY_CLOSED';
    throw err;
  }

  let invite = null;
  if (category.channel === 'public') {
    if (channelHint !== 'public' && channelHint !== 'desk') {
      // desk can also issue public year tickets if needed
    }
  } else if (category.channel === 'invite') {
    if (channelHint === 'desk') {
      // ok
    } else {
      invite = await findInvite(competition._id, inviteCode);
      if (!invite || !invite.active) {
        const err = new Error('Invalid or inactive invite code');
        err.status = 403;
        err.code = 'INVITE_INVALID';
        throw err;
      }
      if (invite.categoryId !== category.id) {
        const err = new Error('Invite code does not match this category');
        err.status = 403;
        throw err;
      }
      if (invite.usedCount >= invite.maxUses) {
        const err = new Error('Invite code has no uses left');
        err.status = 409;
        err.code = 'INVITE_EXHAUSTED';
        throw err;
      }
    }
  } else if (category.channel === 'desk') {
    if (channelHint !== 'desk') {
      const err = new Error('This category is desk-only');
      err.status = 403;
      throw err;
    }
  }

  const fullName = clean(name, 120);
  const normalizedEmail = clean(email, 180).toLowerCase();
  const digits = normalizeMobile(phone);
  if (!fullName || fullName.length < 2) {
    const err = new Error('Name is required');
    err.status = 400;
    throw err;
  }
  if (!digits) {
    const err = new Error('Enter a valid 10-digit mobile number');
    err.status = 400;
    err.code = 'PHONE_INVALID';
    throw err;
  }
  if (normalizedEmail && !validEmail(normalizedEmail)) {
    const err = new Error('Invalid email');
    err.status = 400;
    throw err;
  }
  if (channelHint === 'public' && !normalizedEmail) {
    const err = new Error('Email is required for your ticket confirmation');
    err.status = 400;
    throw err;
  }
  if (cfg.requireTicketPhoto && !String(ticketPhotoUrl || '').trim()) {
    const err = new Error('Face photo is required');
    err.status = 400;
    err.code = 'PHOTO_REQUIRED';
    throw err;
  }
  const needsIdCard = category.channel === 'public'
    || (category.channel === 'invite' && channelHint !== 'desk');
  if (needsIdCard && !String(idCardPhotoUrl || '').trim()) {
    const err = new Error('Clear college ID card photo is required (name + year visible)');
    err.status = 400;
    err.code = 'ID_CARD_REQUIRED';
    throw err;
  }

  const requireFolder = channelHint !== 'desk';
  const photo = assertTrustedPhotoUrl(ticketPhotoUrl, 'Face photo', {
    requireAuditoriumFolder: requireFolder,
  });
  const idCard = needsIdCard
    ? assertTrustedPhotoUrl(idCardPhotoUrl, 'ID card photo', {
      requireAuditoriumFolder: requireFolder,
    })
    : (String(idCardPhotoUrl || '').trim()
      ? assertTrustedPhotoUrl(idCardPhotoUrl, 'ID card photo', { requireAuditoriumFolder: requireFolder })
      : '');

  if (photo && idCard && cloudinaryPathKey(photo) === cloudinaryPathKey(idCard)) {
    const err = new Error('Face photo and college ID must be different pictures');
    err.status = 400;
    err.code = 'SAME_PHOTO';
    throw err;
  }

  if (category.channel === 'public' && channelHint === 'public' && !honorConfirmed) {
    const err = new Error('Please confirm your year / category');
    err.status = 400;
    throw err;
  }

  if (category.channel === 'public' && channelHint === 'public') {
    const collegeEmail = String(normalizedEmail || '').toLowerCase();
    if (!/@coeptech\.ac\.in$/.test(collegeEmail)) {
      const err = new Error('Write your college email. It must end with @coeptech.ac.in.');
      err.status = 400;
      err.code = 'COLLEGE_EMAIL_REQUIRED';
      throw err;
    }
  }

  const duplicate = await findApprovedCompetitionDuplicate({
    festId: competition.fest,
    competitionId: competition._id,
    userId: userId || null,
    phone: digits,
    email: normalizedEmail,
  });
  if (duplicate) {
    const existing = await Registration.findById(duplicate._id)
      .populate('user', 'name email phone phoneNumber')
      .lean();
    const ownsExisting = Boolean(
      existing && userId && String(existing.user?._id || existing.user) === String(userId),
    );
    const err = new Error(ownsExisting
      ? 'You already have an auditorium ticket'
      : 'A pass already exists for this phone or email. Open the pass link from your email.');
    err.status = 409;
    err.code = 'ALREADY_REGISTERED';
    if (ownsExisting) err.ticket = formatTicket(existing, competition);
    throw err;
  }

  const identityClaims = [
    userId ? { kind: 'user', value: String(userId) } : null,
    digits ? { kind: 'phone', value: digits } : null,
    normalizedEmail ? { kind: 'email', value: normalizedEmail } : null,
  ].filter(Boolean);
  const claimDocs = identityClaims.map((item) => ({
    _id: new mongoose.Types.ObjectId(),
    competitionId: competition._id,
    ...item,
  }));
  const claimIds = claimDocs.map((item) => item._id);
  try {
    await TicketClaim.insertMany(claimDocs, { ordered: true });
  } catch (error) {
    await TicketClaim.deleteMany({ _id: { $in: claimIds } }).catch(() => {});
    if (error?.code === 11000) {
      const duplicateError = new Error('You already have an auditorium ticket or one is being issued');
      duplicateError.status = 409;
      duplicateError.code = 'ALREADY_REGISTERED';
      throw duplicateError;
    }
    throw error;
  }

  try {
    await claimCategorySeat(competition._id, category.id, category.seats);
  } catch (error) {
    await TicketClaim.deleteMany({ _id: { $in: claimIds } }).catch(() => {});
    throw error;
  }

  let registration;
  try {
    const user = await resolveOrCreateUser({
      name: fullName,
      email: normalizedEmail,
      phone: digits,
      userId,
    });

    const responses = {
      full_name: fullName,
      name: fullName,
      phone: digits,
      contact_no: digits,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      college: clean(college, 180),
      auditorium_category_id: category.id,
      auditorium_category_label: category.label,
      ticket_photo: photo,
      id_card_photo: idCard,
      honor_confirmed: honorConfirmed ? 'yes' : '',
      ...(invite ? { invite_code: invite.code } : {}),
      ...(organizerNote ? { organizer_note: clean(organizerNote, 500), manual_entry: 'yes', added_by_organizer: 'yes' } : {}),
      team_size: 1,
    };

    const awaitingReview = channelHint !== 'desk';
    registration = await Registration.create({
      fest: competition.fest,
      user: user._id,
      competitionId: competition._id,
      responses,
      status: awaitingReview ? 'pending' : 'approved',
      paymentStatus: 'free',
      amountPaid: 0,
      ticketPhotoUrl: photo,
      idCardPhotoUrl: idCard,
      ...(awaitingReview ? {} : { qrCodeData: crypto.randomBytes(16).toString('hex') }),
    });

    await TicketClaim.updateMany(
      { _id: { $in: claimIds } },
      { $set: { registrationId: registration._id } },
    ).catch((error) => console.warn('[auditorium.claim-link]', error.message));

    // Seat already reserved by claimCategorySeat — do not re-count and reject.
    // Concurrent creates that both claimed would falsely fail the second legit claim.

    if (invite) {
      const bumped = await Invite.findOneAndUpdate(
        {
          _id: invite._id,
          active: true,
          $expr: { $lt: ['$usedCount', '$maxUses'] },
        },
        { $inc: { usedCount: 1 } },
        { new: true },
      );
      if (!bumped) {
        await Registration.deleteOne({ _id: registration._id });
        const err = new Error('Invite code has no uses left');
        err.status = 409;
        err.code = 'INVITE_EXHAUSTED';
        throw err;
      }
    }

    await registration.populate('user', 'name email phone phoneNumber');

    setImmediate(async () => {
      if (registration.status !== 'approved') return;
      try {
        const userDoc = registration.user && typeof registration.user === 'object'
          ? registration.user
          : null;
        const formEmail = normalizedEmail
          || (userDoc?.email && !/@crwdctrl\.local$/i.test(String(userDoc.email))
            ? String(userDoc.email).toLowerCase()
            : '');
        if (!formEmail || !validEmail(formEmail)) {
          console.warn('[auditorium.email] skipped — no real email');
          return;
        }
        await emailAuditoriumPass({
          registration,
          fullName: fullName || userDoc?.name,
          email: formEmail,
          categoryLabel: category.label,
          college,
          photo,
        });
      } catch (e) {
        console.warn('[auditorium.email]', e.message);
      }
    });

    return formatTicket(registration, competition);
  } catch (error) {
    await releaseCategorySeat(competition._id, category.id).catch(() => {});
    await TicketClaim.deleteMany({ _id: { $in: claimIds } }).catch(() => {});
    throw error;
  }
}

/** POST /mindspark/auditorium/register — college-email OTP is the identity check */
exports.publicRegister = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id || null;
    const competition = await ensureAuditoriumCompetition(MINDSPARK_FEST_ID);
    const body = req.body || {};
    const inviteCode = body.inviteCode || body.code;
    const suppliedInvite = inviteCode ? await findInvite(competition._id, inviteCode) : null;
    const isInvite = Boolean(
      suppliedInvite?.active
      && suppliedInvite.usedCount < suppliedInvite.maxUses
      && suppliedInvite.categoryId === String(body.categoryId || ''),
    );
    const me = userId
      ? await User.findById(userId).select('name email phone phoneNumber').lean()
      : null;
    const ticket = await createAuditoriumTicket({
      competition,
      categoryId: body.categoryId,
      inviteCode,
      channelHint: isInvite ? 'invite' : 'public',
      name: body.name || body.fullName || me?.name,
      email: body.email || (me?.email && !/@crwdctrl\.local$/i.test(String(me.email))
        ? String(me.email).toLowerCase()
        : ''),
      phone: body.phone || me?.phoneNumber || me?.phone,
      college: body.college,
      ticketPhotoUrl: body.ticketPhotoUrl || body.ticket_photo,
      idCardPhotoUrl: body.idCardPhotoUrl || body.id_card_photo,
      honorConfirmed: Boolean(body.honorConfirmed),
      userId,
      skipRegistrationOpen: false,
    });
    return res.status(201).json({ success: true, ticket, access: passAccessToken(ticket.id) });
  } catch (error) {
    if (error.code === 'ALREADY_REGISTERED' && error.ticket) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_REGISTERED',
        message: error.message,
        ticket: error.ticket,
      });
    }
    console.error('[auditorium.publicRegister]', error);
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || undefined,
      message: error.message || 'Registration failed',
      ...(error.expectedCategoryId ? { expectedCategoryId: error.expectedCategoryId } : {}),
    });
  }
};

/** GET /mindspark/auditorium/pass/:registrationId?access= — pass view without an account */
exports.getGuestPass = async (req, res) => {
  try {
    const { registrationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(registrationId)
      || !isValidPassAccess(registrationId, req.query.access)) {
      return res.status(403).json({ success: false, message: 'This pass link is not valid' });
    }
    const competition = await ensureAuditoriumCompetition(MINDSPARK_FEST_ID);
    const reg = await Registration.findOne({ _id: registrationId, competitionId: competition._id })
      .populate('user', 'name email phone phoneNumber')
      .lean();
    if (!reg) {
      return res.status(404).json({ success: false, message: 'Pass not found' });
    }
    res.set('Cache-Control', 'no-store');
    if (reg.status === 'rejected') {
      return res.json({ success: true, ticket: { id: String(reg._id), status: 'rejected' } });
    }
    const ticket = formatTicket(reg, competition);
    if (reg.status !== 'approved') ticket.qrCodeData = null;
    return res.json({ success: true, ticket });
  } catch (error) {
    console.error('[auditorium.getGuestPass]', error);
    return res.status(500).json({ success: false, message: 'Could not load pass' });
  }
};

/** GET /mindspark/auditorium/my-ticket — logged-in resume */
exports.getMyTicket = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Login required' });
    }
    const competition = await ensureAuditoriumCompetition(MINDSPARK_FEST_ID);
    let reg = await Registration.findOne({
      fest: competition.fest,
      competitionId: competition._id,
      user: userId,
      status: 'approved',
    })
      .populate('user', 'name email phone phoneNumber')
      .sort({ createdAt: -1 });

    if (!reg) {
      const me = await User.findById(userId).select('email phone phoneNumber').lean();
      const email = me?.email && !/@crwdctrl\.local$/i.test(String(me.email))
        ? String(me.email).toLowerCase()
        : '';
      const phone = phoneDigits(me?.phoneNumber || me?.phone);
      const or = [];
      if (email) or.push({ 'responses.email': email });
      if (phone) {
        or.push({ 'responses.phone': phone });
        or.push({ 'responses.contact_no': phone });
      }
      if (or.length) {
        reg = await Registration.findOne({
          fest: competition.fest,
          competitionId: competition._id,
          status: 'approved',
          $or: or,
        })
          .populate('user', 'name email phone phoneNumber')
          .sort({ createdAt: -1 });
        if (reg && String(reg.user?._id || reg.user) !== String(userId)) {
          reg.user = userId;
          await reg.save();
          await reg.populate('user', 'name email phone phoneNumber');
        }
      }
    }

    if (!reg) {
      return res.status(404).json({ success: false, message: 'No auditorium ticket found' });
    }
    const lean = reg.toObject ? reg.toObject() : reg;
    return res.json({ success: true, ticket: formatTicket(lean, competition) });
  } catch (error) {
    console.error('[auditorium.getMyTicket]', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed' });
  }
};

/** Organizer: ensure + ops payload */
exports.getOrganizerOps = async (req, res) => {
  try {
    if (!isMindSparkFestId(req.festId)) {
      return res.status(400).json({ success: false, message: 'Auditorium is MindSpark-only' });
    }
    const competition = await ensureAuditoriumCompetition(req.festId);
    const stats = await buildCategoryStats(competition);
    const cfg = normalizeAuditoriumConfig(competition.auditorium || {});
    const directoryRows = await AuditoriumStudent.aggregate([
      { $match: { competitionId: competition._id } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const directoryByCategory = Object.fromEntries(directoryRows.map((row) => [row._id, row.count]));
    const directoryTotal = directoryRows.reduce((sum, row) => sum + row.count, 0);
    const invites = await Invite.find({ competitionId: competition._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const recent = await Registration.find({
      fest: req.festId,
      competitionId: competition._id,
      status: { $in: ['approved', 'pending'] },
    })
      .populate('user', 'name email phone phoneNumber')
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [
      checkedInCount,
      todayCount,
      missingIdCount,
      missingFaceCount,
    ] = await Promise.all([
      Registration.countDocuments({
        fest: req.festId,
        competitionId: competition._id,
        status: 'approved',
        checkedIn: true,
      }),
      Registration.countDocuments({
        fest: req.festId,
        competitionId: competition._id,
        status: { $in: ['approved', 'pending'] },
        createdAt: { $gte: startOfDay },
      }),
      Registration.countDocuments({
        fest: req.festId,
        competitionId: competition._id,
        status: 'approved',
        $or: [
          { idCardPhotoUrl: { $in: [null, ''] } },
          { idCardPhotoUrl: { $exists: false } },
        ],
        'responses.id_card_photo': { $in: [null, ''] },
      }),
      Registration.countDocuments({
        fest: req.festId,
        competitionId: competition._id,
        status: 'approved',
        $or: [
          { ticketPhotoUrl: { $in: [null, ''] } },
          { ticketPhotoUrl: { $exists: false } },
        ],
      }),
    ]);

    const byChannel = { public: 0, invite: 0, desk: 0 };
    for (const cat of stats.categories || []) {
      const ch = cat.channel || 'public';
      if (byChannel[ch] == null) byChannel[ch] = 0;
      byChannel[ch] += Number(cat.filled) || 0;
    }

    const activeInvites = invites.filter((i) => i.active).length;
    const inviteUsesLeft = invites
      .filter((i) => i.active)
      .reduce((n, i) => n + Math.max(0, (Number(i.maxUses) || 0) - (Number(i.usedCount) || 0)), 0);

    return res.json({
      success: true,
      data: {
        competitionId: String(competition._id),
        name: competition.name,
        config: cfg,
        directory: { total: directoryTotal, byCategory: directoryByCategory },
        stats: {
          ...stats,
          checkedIn: checkedInCount,
          outside: Math.max(0, (stats.totalFilled || 0) - checkedInCount),
          todayCount,
          missingIdCount,
          missingFaceCount,
          byChannel,
          activeInvites,
          inviteUsesLeft,
          checkInRate: stats.totalFilled > 0
            ? Math.round((checkedInCount / stats.totalFilled) * 100)
            : 0,
        },
        invites: invites.map((i) => ({
          id: String(i._id),
          code: i.code,
          categoryId: i.categoryId,
          maxUses: i.maxUses,
          usedCount: i.usedCount,
          active: i.active,
          note: i.note || '',
          createdAt: i.createdAt,
        })),
        recent: recent.map((r) => formatTicket(r, competition)),
        scannerUrl: `/fest-organizer/fests/${req.festId}/auditorium/scan`,
        publicRegisterUrl: '/mindspark/auditorium',
        risks: [
          ...(cfg.registrationOpen ? [] : ['Registration is closed']),
          ...((stats.categories || []).filter((c) => c.full).map((c) => `${c.label} is full`)),
          ...(missingIdCount > 0 ? [`${missingIdCount} tickets missing college ID`] : []),
          ...(activeInvites > 8 ? [`${activeInvites} active invite codes — review leaks`] : []),
        ],
      },
    });
  } catch (error) {
    console.error('[auditorium.getOrganizerOps]', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed' });
  }
};

exports.updateOrganizerConfig = async (req, res) => {
  try {
    if (!isMindSparkFestId(req.festId)) {
      return res.status(400).json({ success: false, message: 'Auditorium is MindSpark-only' });
    }
    const competition = await ensureAuditoriumCompetition(req.festId);
    const body = req.body || {};
    const current = normalizeAuditoriumConfig(competition.auditorium || {});

    if (typeof body.showPublicTicketBox === 'boolean') {
      current.showPublicTicketBox = body.showPublicTicketBox;
    }
    if (typeof body.registrationOpen === 'boolean') {
      current.registrationOpen = body.registrationOpen;
    }
    if (typeof body.requireTicketPhoto === 'boolean') {
      current.requireTicketPhoto = body.requireTicketPhoto;
    }
    if (typeof body.requireIdAtGate === 'boolean') {
      current.requireIdAtGate = body.requireIdAtGate;
    }
    if (typeof body.requireDirectoryOtp === 'boolean') {
      if (body.requireDirectoryOtp) {
        const directoryCount = await AuditoriumStudent.countDocuments({ competitionId: competition._id });
        if (!directoryCount) {
          return res.status(400).json({ success: false, message: 'Upload at least one student directory before enabling email OTP' });
        }
      }
      current.requireDirectoryOtp = body.requireDirectoryOtp;
    }
    if (Array.isArray(body.categories)) {
      const stats = await buildCategoryStats(competition);
      const filledById = new Map(stats.categories.map((c) => [c.id, c.filled]));
      const next = sanitizeCategories(body.categories).map((cat) => {
        const filled = filledById.get(cat.id) || 0;
        if (cat.seats < filled) {
          return { ...cat, seats: filled };
        }
        return cat;
      });
      current.categories = next;
    }

    competition.auditorium = current;
    competition.slotsAllotted = sumSeats(current.categories);
    if (competition.registration?.settings) {
      competition.registration.settings.maxRegistrations = competition.slotsAllotted;
    }
    await competition.save();

    auditoriumMetaCache.at = 0;
    auditoriumMetaCache.payload = null;

    for (const cat of current.categories) {
      await syncCategoryCounter(competition._id, cat.id);
    }

    const stats = await buildCategoryStats(competition);
    return res.json({
      success: true,
      data: {
        config: normalizeAuditoriumConfig(competition.auditorium),
        stats,
      },
    });
  } catch (error) {
    console.error('[auditorium.updateOrganizerConfig]', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed' });
  }
};

/** Organizer: replace one student-category email directory from JSON/CSV/XLSX. */
exports.importStudentDirectory = async (req, res) => {
  try {
    if (!isMindSparkFestId(req.festId)) {
      return res.status(400).json({ success: false, message: 'Auditorium is MindSpark-only' });
    }
    const categoryId = String(req.params.categoryId || '').trim();
    if (!DIRECTORY_YEARS.has(categoryId)) {
      return res.status(400).json({ success: false, message: 'Choose a valid student category' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'Choose a CSV or XLSX file' });
    }
    const filename = String(req.file.originalname || '');
    if (!/\.(csv|xlsx|json)$/i.test(filename)) {
      return res.status(400).json({ success: false, message: 'Only JSON, CSV and XLSX files are supported' });
    }
    const emails = await extractDirectoryEmails(req.file.buffer, filename);
    if (!emails.length) {
      return res.status(400).json({ success: false, message: 'No valid email addresses were found in the file' });
    }
    if (emails.length > 25_000) {
      return res.status(400).json({ success: false, message: 'A directory can contain at most 25,000 emails' });
    }

    const competition = await ensureAuditoriumCompetition(req.festId);
    const batchId = crypto.randomUUID();
    await AuditoriumStudent.bulkWrite(emails.map((email) => ({
      updateOne: {
        filter: { competitionId: competition._id, emailHash: directoryEmailHash(email) },
        update: { $set: { categoryId, batchId } },
        upsert: true,
      },
    })), { ordered: false });
    await AuditoriumStudent.deleteMany({ competitionId: competition._id, categoryId, batchId: { $ne: batchId } });

    const rows = await AuditoriumStudent.aggregate([
      { $match: { competitionId: competition._id } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const byCategory = Object.fromEntries(rows.map((row) => [row._id, row.count]));
    return res.json({
      success: true,
      imported: emails.length,
      directory: { total: rows.reduce((sum, row) => sum + row.count, 0), byCategory },
    });
  } catch (error) {
    console.error('[auditorium.importStudentDirectory]', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Directory upload failed' });
  }
};

exports.createInvite = async (req, res) => {
  try {
    const competition = await ensureAuditoriumCompetition(req.festId);
    const categoryId = String(req.body.categoryId || '').trim();
    const cat = sanitizeCategories(competition.auditorium?.categories).find((c) => c.id === categoryId);
    if (!cat || (cat.channel !== 'invite' && cat.channel !== 'desk')) {
      return res.status(400).json({ success: false, message: 'Pick an invite/desk category' });
    }
    const maxUses = Math.max(1, Math.min(20, Math.floor(Number(req.body.maxUses) || 3)));
    const code = String(req.body.code || crypto.randomBytes(4).toString('hex'))
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);
    if (code.length < 4) {
      return res.status(400).json({ success: false, message: 'Code too short' });
    }
    const invite = await Invite.create({
      fest: req.festId,
      competitionId: competition._id,
      categoryId: cat.id,
      code,
      maxUses,
      note: clean(req.body.note, 200),
      createdBy: req.organizerId || null,
      active: true,
    });
    return res.status(201).json({
      success: true,
      invite: {
        id: String(invite._id),
        code: invite.code,
        categoryId: invite.categoryId,
        maxUses: invite.maxUses,
        usedCount: 0,
        active: true,
        note: invite.note,
        redeemUrl: `${FRONTEND()}/mindspark/auditorium?code=${encodeURIComponent(invite.code)}`,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Code already exists' });
    }
    console.error('[auditorium.createInvite]', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed' });
  }
};

exports.deactivateInvite = async (req, res) => {
  try {
    const competition = await ensureAuditoriumCompetition(req.festId);
    const invite = await Invite.findOne({
      _id: req.params.inviteId,
      competitionId: competition._id,
    });
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found' });
    invite.active = false;
    await invite.save();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed' });
  }
};

/** Desk: issue free ticket for invite/desk categories */
exports.deskIssue = async (req, res) => {
  try {
    const competition = await ensureAuditoriumCompetition(req.festId);
    const body = req.body || {};
    const ticket = await createAuditoriumTicket({
      competition,
      categoryId: body.categoryId,
      channelHint: 'desk',
      name: body.name || body.fullName,
      email: body.email,
      phone: body.phone,
      college: body.college,
      ticketPhotoUrl: body.ticketPhotoUrl || body.ticket_photo,
      idCardPhotoUrl: body.idCardPhotoUrl || body.id_card_photo,
      honorConfirmed: true,
      organizerNote: body.note || 'Fest Day Desk auditorium pass',
      skipRegistrationOpen: true,
    });
    return res.status(201).json({ success: true, ticket });
  } catch (error) {
    if (error.code === 'ALREADY_REGISTERED' && error.ticket) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_REGISTERED',
        message: error.message,
        ticket: error.ticket,
      });
    }
    console.error('[auditorium.deskIssue]', error);
    return res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed',
    });
  }
};

async function emailAuditoriumPass({ registration, fullName, email, categoryLabel, college, photo }) {
  const formEmail = String(email || '').trim().toLowerCase();
  if (!formEmail || !validEmail(formEmail)) return;
  const result = await sendAuditoriumPassEmail({
    to: formEmail,
    fullName: fullName || 'Guest',
    categoryLabel: categoryLabel || '',
    college: college || '',
    registrationId: String(registration._id),
    qrHash: registration.qrCodeData || '',
    photoUrl: photo || ticketPhotoFrom(registration),
    passUrl: guestPassLink(registration._id),
  });
  if (result?.success === false) throw new Error(result.error || 'Pass email failed');
}

function notifyAuditoriumDeclined(ticket) {
  if (!ticket?.email) return;
  setImmediate(() => {
    sendAuditoriumPassDeclinedEmail({
      to: ticket.email,
      fullName: ticket.fullName,
      categoryLabel: ticket.categoryLabel,
    })
      .then((result) => {
        if (result?.success === false) console.warn('[auditorium.decline.email]', result.error);
      })
      .catch((error) => console.warn('[auditorium.decline.email]', error.message));
  });
}

/**
 * Pending → approved/rejected, atomically so two organizers tapping at once email only once.
 * Approved passes can still be declined until they are checked in at the gate.
 * Returns the formatted ticket, or null when the pass can no longer be reviewed.
 */
async function applyAuditoriumReview({ registrationId, festId, competition, decision }) {
  const reject = decision === 'reject';
  const update = reject
    ? { $set: { status: 'rejected' } }
    : { $set: { status: 'approved', qrCodeData: crypto.randomBytes(16).toString('hex') } };
  const filter = reject
    ? { status: { $in: ['pending', 'approved'] }, checkedIn: { $ne: true } }
    : { status: 'pending' };
  const registration = await Registration.findOneAndUpdate(
    { _id: registrationId, fest: festId, competitionId: competition._id, ...filter },
    update,
    { new: true },
  ).populate('user', 'name email phone phoneNumber');
  if (!registration) return null;

  const ticket = formatTicket(registration, competition);
  if (decision === 'reject') {
    await TicketClaim.deleteMany({ registrationId: registration._id });
    await syncCategoryCounter(competition._id, ticket.categoryId);
    auditoriumMetaCache.at = 0;
    auditoriumMetaCache.payload = null;
    notifyAuditoriumDeclined(ticket);
    return ticket;
  }
  setImmediate(() => {
    emailAuditoriumPass({
      registration,
      fullName: ticket.fullName,
      email: ticket.email,
      categoryLabel: ticket.categoryLabel,
      college: ticket.college,
      photo: ticket.ticketPhotoUrl,
    }).catch((error) => console.warn('[auditorium.approve.email]', error.message));
  });
  return ticket;
}

/** Organizer approves a public year request and emails the existing pass. */
exports.reviewPass = async (req, res) => {
  try {
    const competition = await ensureAuditoriumCompetition(req.festId);
    const ticket = await applyAuditoriumReview({
      registrationId: req.params.registrationId,
      festId: req.festId,
      competition,
      decision: req.body?.decision === 'reject' ? 'reject' : 'approve',
    });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Pass not found, already reviewed, or already checked in' });
    }
    return res.json({ success: true, ticket });
  } catch (error) {
    console.error('[auditorium.reviewPass]', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed' });
  }
};

exports.listRoster = async (req, res) => {
  try {
    const competition = await ensureAuditoriumCompetition(req.festId);
    const categoryId = String(req.query.categoryId || '').trim();
    const filter = {
      fest: req.festId,
      competitionId: competition._id,
      status: { $in: ['approved', 'pending', 'rejected'] },
    };
    if (categoryId) filter['responses.auditorium_category_id'] = categoryId;
    const status = String(req.query.status || '').trim();
    if (['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
    const rows = await Registration.find(filter)
      .populate('user', 'name email phone phoneNumber')
      .sort({ createdAt: -1 })
      .limit(Math.min(1000, Math.max(1, Number(req.query.limit) || 500)))
      .lean();
    return res.json({
      success: true,
      tickets: rows.map((r) => formatTicket(r, competition)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed' });
  }
};

/** Organizer-only removal of an Auditorium ticket, including its seat claim. */
exports.deleteTicket = async (req, res) => {
  try {
    const competition = await ensureAuditoriumCompetition(req.festId);
    const registration = await Registration.findOneAndDelete({
      _id: req.params.registrationId,
      fest: req.festId,
      competitionId: competition._id,
      'responses.auditorium_category_id': { $exists: true, $ne: '' },
    }).populate('user', 'name email phone phoneNumber');
    if (!registration) return res.status(404).json({ success: false, message: 'Auditorium ticket not found' });
    await TicketClaim.deleteMany({ registrationId: registration._id });
    await syncCategoryCounter(competition._id, responsesToObject(registration.responses).auditorium_category_id);
    auditoriumMetaCache.at = 0;
    auditoriumMetaCache.payload = null;
    if (registration.status !== 'rejected') notifyAuditoriumDeclined(formatTicket(registration, competition));
    return res.json({ success: true, message: 'Auditorium ticket deleted' });
  } catch (error) {
    console.error('[auditorium.deleteTicket]', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete ticket' });
  }
};

/** Minimal gate info for scanner accounts (no stats, invites or rosters). */
exports.getGateInfo = async (req, res) => {
  try {
    const competition = await ensureAuditoriumCompetition(req.festId);
    return res.json({
      success: true,
      competitionId: String(competition._id),
      categories: sanitizeCategories(competition.auditorium?.categories)
        .map((c) => ({ id: c.id, label: c.label })),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed' });
  }
};

exports.lookupByPhone = async (req, res) => {
  try {
    const competition = await ensureAuditoriumCompetition(req.festId);
    const digits = phoneDigits(req.query.phone || req.body?.phone);
    if (digits.length !== 10) {
      return res.status(400).json({ success: false, message: 'Valid phone required' });
    }
    const reg = await Registration.findOne({
      fest: req.festId,
      competitionId: competition._id,
      status: 'approved',
      $or: [
        { 'responses.phone': digits },
        { 'responses.contact_no': digits },
        { 'responses.mobile': digits },
      ],
    })
      .populate('user', 'name email phone phoneNumber')
      .lean();
    if (!reg) return res.status(404).json({ success: false, message: 'No ticket for this phone' });
    return res.json({ success: true, ticket: formatTicket(reg, competition) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed' });
  }
};

exports.ensureAuditoriumCompetition = ensureAuditoriumCompetition;
exports.applyAuditoriumReview = applyAuditoriumReview;
exports.notifyAuditoriumDeclined = notifyAuditoriumDeclined;
exports.formatTicket = formatTicket;
exports.ticketPhotoFrom = ticketPhotoFrom;
