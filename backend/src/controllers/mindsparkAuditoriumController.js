'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Competition = require('../model/competition_model');
const Registration = require('../model/registration_model');
const User = require('../model/usermodel');
const Invite = require('../model/mindspark_auditorium_invite_model');
const {
  MINDSPARK_FEST_ID,
  AUDITORIUM_COMPETITION_NAME,
  AUDITORIUM_MODULE,
  defaultAuditoriumConfig,
  normalizeAuditoriumConfig,
  sumSeats,
  sanitizeCategories,
  inferYearCategoryFromMis,
  YEAR_CATEGORY_IDS,
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
const { sendCompetitionRegistrationEmailForRecord } = require('../services/emailService');

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
  if (requireAuditoriumFolder && !/auditorium-tickets/i.test(u.pathname)) {
    const err = new Error(`${label} must be uploaded via the auditorium form`);
    err.status = 400;
    err.code = 'UNTRUSTED_PHOTO';
    throw err;
  }
  return raw;
}

function normalizeMis(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24);
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
    fullName: user?.name || r.full_name || r.name || '',
    email: user?.email || r.email || '',
    phone: user?.phoneNumber || user?.phone || r.phone || r.contact_no || '',
    college: r.college || '',
    misId: r.mis_id || r.mis || '',
    competitionId: String(competition?._id || reg.competitionId || ''),
    competitionName: competition?.name || AUDITORIUM_COMPETITION_NAME,
    ticketUrl: `${FRONTEND()}/qr-ticket/${encodeURIComponent(String(reg._id))}?auditorium=1`,
    submittedAt: reg.submittedAt || reg.createdAt,
  };
}

async function ensureAuditoriumCompetition(festId = MINDSPARK_FEST_ID) {
  if (!isMindSparkFestId(festId)) {
    const err = new Error('Auditorium is only available for MindSpark');
    err.status = 400;
    throw err;
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
    .filter((c) => c.channel === 'public')
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

/** GET /mindspark/auditorium/meta?code= */
exports.getPublicMeta = async (req, res) => {
  try {
    const competition = await ensureAuditoriumCompetition(MINDSPARK_FEST_ID);
    const stats = await buildCategoryStats(competition);
    let inviteCategory = null;
    const code = String(req.query.code || '').trim();
    if (code) {
      const invite = await findInvite(competition._id, code);
      if (invite?.active && invite.usedCount < invite.maxUses) {
        const cat = stats.categories.find((c) => c.id === invite.categoryId);
        if (cat && (cat.channel === 'invite' || cat.channel === 'desk')) {
          inviteCategory = cat;
        }
      }
    }
    return res.json({ success: true, data: publicMetaPayload(competition, stats, inviteCategory) });
  } catch (error) {
    console.error('[auditorium.getPublicMeta]', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed' });
  }
};

async function resolveOrCreateUser({ name, email, phone, userId }) {
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const existing = await User.findById(userId);
    if (existing) {
      let dirty = false;
      if (name && (!existing.name || existing.name.length < 2)) {
        existing.name = name;
        dirty = true;
      }
      if (email && (!existing.email || /@crwdctrl\.local$/i.test(String(existing.email)))) {
        existing.email = email.toLowerCase();
        dirty = true;
      }
      if (phone && !existing.phoneNumber && !existing.phone) {
        existing.phoneNumber = phone;
        dirty = true;
      }
      if (dirty) await existing.save();
      return existing;
    }
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
    let dirty = false;
    if (name && (!user.name || user.name.length < 2)) {
      user.name = name;
      dirty = true;
    }
    if (email && (!user.email || /@crwdctrl\.local$/i.test(String(user.email)))) {
      user.email = email.toLowerCase();
      dirty = true;
    }
    if (dirty) await user.save();
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
  misId,
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
  const digits = phoneDigits(phone);
  if (!fullName || fullName.length < 2) {
    const err = new Error('Name is required');
    err.status = 400;
    throw err;
  }
  if (!digits || digits.length !== 10) {
    const err = new Error('Valid 10-digit phone is required');
    err.status = 400;
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

  const misNormalized = normalizeMis(misId);
  if (category.channel === 'public') {
    if (!misNormalized || misNormalized.length < 5) {
      const err = new Error('Valid MIS / college ID number is required (min 5 characters)');
      err.status = 400;
      err.code = 'MIS_REQUIRED';
      throw err;
    }
  }

  if (
    cfg.enforceMisYear
    && category.channel === 'public'
    && YEAR_CATEGORY_IDS.has(category.id)
    && misNormalized
  ) {
    const inferred = inferYearCategoryFromMis(misNormalized);
    if (inferred && inferred !== category.id) {
      const err = new Error(
        `MIS batch looks like ${inferred.replace(/_/g, ' ')} — you selected ${category.label}. Pick the matching year.`,
      );
      err.status = 400;
      err.code = 'MIS_YEAR_MISMATCH';
      err.expectedCategoryId = inferred;
      throw err;
    }
  }

  if (category.channel === 'public' && channelHint === 'public' && !honorConfirmed) {
    const err = new Error('Please confirm your year / category');
    err.status = 400;
    throw err;
  }

  if (!userId && channelHint !== 'desk') {
    const err = new Error('Login required to get an auditorium ticket');
    err.status = 401;
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }

  const duplicate = await findApprovedCompetitionDuplicate({
    festId: competition.fest,
    competitionId: competition._id,
    userId: userId || null,
    phone: digits,
    email: normalizedEmail,
  });
  if (duplicate) {
    let existingDoc = await Registration.findById(duplicate._id)
      .populate('user', 'name email phone phoneNumber');
    if (existingDoc && userId && String(existingDoc.user?._id || existingDoc.user) !== String(userId)) {
      existingDoc.user = userId;
      await existingDoc.save();
      await existingDoc.populate('user', 'name email phone phoneNumber');
    }
    const existing = existingDoc?.toObject ? existingDoc.toObject() : existingDoc;
    const err = new Error('You already have an auditorium ticket');
    err.status = 409;
    err.code = 'ALREADY_REGISTERED';
    err.ticket = formatTicket(existing, competition);
    throw err;
  }

  if (misNormalized) {
    const misDup = await Registration.findOne({
      fest: competition.fest,
      competitionId: competition._id,
      status: 'approved',
      $or: [
        { 'responses.mis_id': misNormalized },
        { 'responses.mis': misNormalized },
      ],
    }).select('_id').lean();
    if (misDup) {
      const err = new Error('This MIS / ID number already has an auditorium ticket');
      err.status = 409;
      err.code = 'MIS_ALREADY_USED';
      throw err;
    }
  }

  await claimCategorySeat(competition._id, category.id, category.seats);

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
      mis_id: misNormalized,
      auditorium_category_id: category.id,
      auditorium_category_label: category.label,
      ticket_photo: photo,
      id_card_photo: idCard,
      honor_confirmed: honorConfirmed ? 'yes' : '',
      ...(invite ? { invite_code: invite.code } : {}),
      ...(organizerNote ? { organizer_note: clean(organizerNote, 500), manual_entry: 'yes', added_by_organizer: 'yes' } : {}),
      team_size: 1,
    };

    registration = await Registration.create({
      fest: competition.fest,
      user: user._id,
      competitionId: competition._id,
      responses,
      status: 'approved',
      paymentStatus: 'free',
      amountPaid: 0,
      ticketPhotoUrl: photo,
      idCardPhotoUrl: idCard,
      qrCodeData: crypto.randomBytes(16).toString('hex'),
    });

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
        const FestOrganizer = require('../model/fest_organizer_model');
        const festDoc = await FestOrganizer.findById(competition.fest)
          .select('festName venue coverImage registration')
          .lean();
        const mailUser = {
          name: fullName || userDoc?.name || 'Guest',
          email: formEmail,
        };
        await sendCompetitionRegistrationEmailForRecord({
          user: mailUser,
          fest: festDoc || { _id: competition.fest, festName: 'MindSpark', venue: 'COEP Auditorium' },
          competition,
          registration,
          extras: {
            ticketLink: `/qr-ticket/${registration._id}?auditorium=1`,
            ticketPhotoUrl: photo,
            details: [
              { label: 'Category', value: category.label },
              ...(college ? [{ label: 'College', value: college }] : []),
              { label: 'Entry', value: 'Free' },
            ],
          },
        });
      } catch (e) {
        console.warn('[auditorium.email]', e.message);
      }
    });

    return formatTicket(registration, competition);
  } catch (error) {
    await releaseCategorySeat(competition._id, category.id).catch(() => {});
    throw error;
  }
}

/** POST /mindspark/auditorium/register — requires login */
exports.publicRegister = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'LOGIN_REQUIRED',
        message: 'Sign in with Google to get your auditorium ticket',
      });
    }
    const competition = await ensureAuditoriumCompetition(MINDSPARK_FEST_ID);
    const body = req.body || {};
    const me = await User.findById(userId).select('name email phone phoneNumber').lean();
    const ticket = await createAuditoriumTicket({
      competition,
      categoryId: body.categoryId,
      inviteCode: body.inviteCode || body.code,
      channelHint: body.inviteCode || body.code ? 'invite' : 'public',
      name: body.name || body.fullName || me?.name,
      email: (me?.email && !/@crwdctrl\.local$/i.test(String(me.email))
        ? String(me.email).toLowerCase()
        : body.email),
      phone: body.phone || me?.phoneNumber || me?.phone,
      college: body.college,
      misId: body.misId || body.mis,
      ticketPhotoUrl: body.ticketPhotoUrl || body.ticket_photo,
      idCardPhotoUrl: body.idCardPhotoUrl || body.id_card_photo,
      honorConfirmed: Boolean(body.honorConfirmed),
      userId,
      skipRegistrationOpen: false,
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
    console.error('[auditorium.publicRegister]', error);
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || undefined,
      message: error.message || 'Registration failed',
      ...(error.expectedCategoryId ? { expectedCategoryId: error.expectedCategoryId } : {}),
    });
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
    if (typeof body.enforceMisYear === 'boolean') {
      current.enforceMisYear = body.enforceMisYear;
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
      misId: body.misId,
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
exports.formatTicket = formatTicket;
exports.ticketPhotoFrom = ticketPhotoFrom;
