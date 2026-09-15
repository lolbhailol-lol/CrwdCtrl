/**
 * Resolve admin notification audiences → unique User IDs + reachability sample.
 */
const mongoose = require('mongoose');
const User = require('../model/usermodel');
const Registration = require('../model/registration_model');
const Competition = require('../model/competition_model');
const FestOrganizer = require('../model/fest_organizer_model');
const TrekBooking = require('../model/trek_booking_model');
const Trek = require('../model/trek_model');
const CategoryRegistration = require('../model/category_registration_model');
const SportsEvent = require('../model/sports_model');
const EventShow = require('../model/event_show_model');
const EventShowRegistration = require('../model/event_show_registration_model');

const MAX_AUDIENCE = 5000;
const SAMPLE_LIMIT = 40;

const ALLOWED_ROLES = new Set(['student', 'organizer', 'sponsor']);
const REG_STATUSES = new Set(['all', 'approved', 'pending', 'rejected']);
const TREK_STATUSES = new Set(['all', 'confirmed', 'cancelled']);
const RUN_STATUSES = new Set(['all', 'confirmed', 'pending']);

function asObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
  return null;
}

function assertPlainString(value, field) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') {
    const err = new Error(`${field} must be a string`);
    err.code = 'INVALID_FILTER';
    throw err;
  }
  return value.trim();
}

function assertEnum(value, allowed, field) {
  const s = assertPlainString(value, field);
  if (!s) return '';
  if (!allowed.has(s)) {
    const err = new Error(`Invalid ${field}: ${s}`);
    err.code = 'INVALID_FILTER';
    throw err;
  }
  return s;
}

function sanitizeAudienceFilters(type, filters = {}) {
  const out = {};
  if (filters.verifiedOnly) out.verifiedOnly = true;
  if (filters.hasPush) out.hasPush = true;

  const role = assertEnum(filters.role, ALLOWED_ROLES, 'role');
  if (role) out.role = role;

  if (type === 'fest' || type === 'competition' || type === 'competition_type' || type === 'event_show') {
    const status = assertEnum(filters.status || 'all', REG_STATUSES, 'status');
    if (status) out.status = status;
  } else if (type === 'trek') {
    const status = assertEnum(filters.status || 'all', TREK_STATUSES, 'status');
    if (status) out.status = status;
  } else if (type === 'run') {
    const status = assertEnum(filters.status || 'all', RUN_STATUSES, 'status');
    if (status) out.status = status;
  }

  const competitionType = assertPlainString(filters.competitionType, 'competitionType');
  if (competitionType) out.competitionType = competitionType;

  for (const key of ['festId', 'competitionId', 'trekId', 'eventId', 'eventShowId']) {
    const v = filters[key];
    if (v == null || v === '') continue;
    if (typeof v !== 'string' && !(v instanceof mongoose.Types.ObjectId)) {
      const err = new Error(`${key} must be a string id`);
      err.code = 'INVALID_FILTER';
      throw err;
    }
    out[key] = String(v);
  }

  return out;
}

function uniqueIds(ids = []) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (!id) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

async function resolveUserIdsFromAudience(audience = {}) {
  const type = String(audience.type || '').trim();
  const filters = sanitizeAudienceFilters(type, audience.filters || {});
  const selectedUserIds = Array.isArray(audience.selectedUserIds)
    ? audience.selectedUserIds.map(asObjectId).filter(Boolean)
    : [];

  let userIds = [];

  switch (type) {
    case 'all_users': {
      const q = { isDeleted: { $ne: true } };
      if (filters.verifiedOnly) q.isVerified = true;
      if (filters.role) q.role = filters.role;
      if (filters.hasPush) q['fcmTokens.0'] = { $exists: true };
      const count = await User.countDocuments(q);
      if (count > MAX_AUDIENCE) {
        const err = new Error(`Audience too large (${count}). Max ${MAX_AUDIENCE} per send.`);
        err.code = 'AUDIENCE_TOO_LARGE';
        err.count = count;
        throw err;
      }
      userIds = await User.find(q).select('_id').lean().then((rows) => rows.map((r) => r._id));
      break;
    }
    case 'fest': {
      const festId = asObjectId(filters.festId);
      if (!festId) throw new Error('festId is required for fest audience');
      const q = { fest: festId, user: { $ne: null } };
      if (filters.status && filters.status !== 'all') q.status = filters.status;
      else q.status = { $in: ['approved', 'pending'] };
      userIds = await Registration.distinct('user', q);
      break;
    }
    case 'competition_type': {
      const competitionType = String(filters.competitionType || '').trim();
      if (!competitionType) throw new Error('competitionType is required');
      const comps = await Competition.find({ competitionType }).select('_id').lean();
      const compIds = comps.map((c) => c._id);
      if (!compIds.length) {
        userIds = [];
        break;
      }
      const q = { competitionId: { $in: compIds }, user: { $ne: null } };
      if (filters.status && filters.status !== 'all') q.status = filters.status;
      else q.status = { $in: ['approved', 'pending'] };
      userIds = await Registration.distinct('user', q);
      break;
    }
    case 'competition': {
      const competitionId = asObjectId(filters.competitionId);
      if (!competitionId) throw new Error('competitionId is required');
      const q = { competitionId, user: { $ne: null } };
      if (filters.status && filters.status !== 'all') q.status = filters.status;
      else q.status = { $in: ['approved', 'pending'] };
      userIds = await Registration.distinct('user', q);
      break;
    }
    case 'trek': {
      const trekId = asObjectId(filters.trekId);
      if (!trekId) throw new Error('trekId is required');
      const q = { trekId, userId: { $ne: null } };
      if (filters.status && filters.status !== 'all') q.status = filters.status;
      else q.status = 'confirmed';
      userIds = await TrekBooking.distinct('userId', q);
      break;
    }
    case 'run': {
      const eventId = asObjectId(filters.eventId);
      if (!eventId) throw new Error('eventId is required for run audience');
      const q = { category: 'sports', eventId, user: { $ne: null } };
      if (filters.status && filters.status !== 'all') q.status = filters.status;
      else q.status = { $in: ['confirmed', 'pending'] };
      userIds = await CategoryRegistration.distinct('user', q);
      break;
    }
    case 'event_show': {
      const eventShowId = asObjectId(filters.eventShowId);
      if (!eventShowId) throw new Error('eventShowId is required');
      const q = { eventShow: eventShowId, user: { $ne: null } };
      if (filters.status && filters.status !== 'all') q.status = filters.status;
      else q.status = { $in: ['approved', 'pending'] };
      userIds = await EventShowRegistration.distinct('user', q);
      break;
    }
    case 'manual': {
      userIds = selectedUserIds;
      break;
    }
    default:
      throw new Error(`Unknown audience type: ${type || '(empty)'}`);
  }

  userIds = uniqueIds(userIds);

  // Optional post-filter: only keep selected subset from preview UI
  if (selectedUserIds.length > 0 && type !== 'manual') {
    const allow = new Set(selectedUserIds.map(String));
    userIds = userIds.filter((id) => allow.has(String(id)));
  }

  // Drop soft-deleted users
  if (userIds.length > 0) {
    const alive = await User.find({
      _id: { $in: userIds },
      isDeleted: { $ne: true },
    })
      .select('_id')
      .lean();
    userIds = alive.map((u) => u._id);
  }

  if (userIds.length > MAX_AUDIENCE) {
    const err = new Error(`Audience too large (${userIds.length}). Max ${MAX_AUDIENCE} per send.`);
    err.code = 'AUDIENCE_TOO_LARGE';
    err.count = userIds.length;
    throw err;
  }

  return userIds;
}

async function buildAudiencePreview(audience = {}) {
  const userIds = await resolveUserIdsFromAudience(audience);
  const sampleIds = userIds.slice(0, SAMPLE_LIMIT);

  const users = sampleIds.length
    ? await User.find({ _id: { $in: sampleIds } })
        .select('name email isVerified fcmTokens notificationPreferences role')
        .lean()
    : [];

  const byId = Object.fromEntries(users.map((u) => [String(u._id), u]));
  const sample = sampleIds.map((id) => {
    const u = byId[String(id)];
    if (!u) {
      return { id: String(id), name: '—', email: '', hasPush: false, isVerified: false };
    }
    return {
      id: String(u._id),
      name: u.name || '—',
      email: u.email || '',
      role: u.role || '',
      hasPush: Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0,
      isVerified: !!u.isVerified,
      emailReminders: u.notificationPreferences?.emailReminders !== false,
      pushReminders: u.notificationPreferences?.pushReminders !== false,
    };
  });

  // Reachability across full audience (capped scan)
  let emailReach = 0;
  let pushReach = 0;
  if (userIds.length > 0) {
    const reachRows = await User.find({ _id: { $in: userIds } })
      .select('email fcmTokens notificationPreferences')
      .lean();
    for (const u of reachRows) {
      if (u.email && u.notificationPreferences?.emailReminders !== false) emailReach += 1;
      if (Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0 && u.notificationPreferences?.pushReminders !== false) {
        pushReach += 1;
      }
    }
  }

  return {
    count: userIds.length,
    userIds: userIds.map(String),
    sample,
    reach: {
      email: emailReach,
      push: pushReach,
      inApp: userIds.length,
    },
  };
}

function countMapFromAgg(rows = [], idKey = '_id') {
  const map = {};
  for (const row of rows) {
    if (row[idKey] == null) continue;
    map[String(row[idKey])] = row.count || 0;
  }
  return map;
}

async function getAudienceOptions() {
  const [fests, competitions, treks, runs, events, competitionTypes] = await Promise.all([
    FestOrganizer.find({})
      .select('festName festDate status')
      .sort({ festDate: -1, createdAt: -1 })
      .limit(200)
      .lean(),
    Competition.find({})
      .select('name competitionType fest')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean(),
    Trek.find({ status: { $in: ['published', 'draft'] } })
      .select('trekName trekDate status')
      .sort({ trekDate: -1, createdAt: -1 })
      .limit(200)
      .lean(),
    SportsEvent.find({ status: { $in: ['published', 'draft'] } })
      .select('title eventDate status sportType')
      .sort({ eventDate: -1, createdAt: -1 })
      .limit(200)
      .lean(),
    EventShow.find({})
      .select('title displayName status')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    Competition.distinct('competitionType'),
  ]);

  const festIds = (fests || []).map((f) => f._id);
  const compIds = (competitions || []).map((c) => c._id);
  const trekIds = (treks || []).map((t) => t._id);
  const runIds = (runs || []).map((r) => r._id);
  const eventIds = (events || []).map((e) => e._id);

  const [festCounts, compCounts, trekCounts, runCounts, eventCounts, typeCounts] = await Promise.all([
    festIds.length
      ? Registration.aggregate([
          {
            $match: {
              fest: { $in: festIds },
              user: { $ne: null },
            },
          },
          { $group: { _id: { fest: '$fest', user: '$user' } } },
          { $group: { _id: '$_id.fest', count: { $sum: 1 } } },
        ])
      : [],
    compIds.length
      ? Registration.aggregate([
          {
            $match: {
              competitionId: { $in: compIds },
              user: { $ne: null },
              status: { $in: ['approved', 'pending'] },
            },
          },
          { $group: { _id: { competitionId: '$competitionId', user: '$user' } } },
          { $group: { _id: '$_id.competitionId', count: { $sum: 1 } } },
        ])
      : [],
    trekIds.length
      ? TrekBooking.aggregate([
          {
            $match: {
              trekId: { $in: trekIds },
              userId: { $ne: null },
              status: 'confirmed',
            },
          },
          { $group: { _id: { trekId: '$trekId', userId: '$userId' } } },
          { $group: { _id: '$_id.trekId', count: { $sum: 1 } } },
        ])
      : [],
    runIds.length
      ? CategoryRegistration.aggregate([
          {
            $match: {
              category: 'sports',
              eventId: { $in: runIds },
              user: { $ne: null },
              status: { $in: ['confirmed', 'pending'] },
            },
          },
          { $group: { _id: { eventId: '$eventId', user: '$user' } } },
          { $group: { _id: '$_id.eventId', count: { $sum: 1 } } },
        ])
      : [],
    eventIds.length
      ? EventShowRegistration.aggregate([
          {
            $match: {
              eventShow: { $in: eventIds },
              user: { $ne: null },
            },
          },
          { $group: { _id: { eventShow: '$eventShow', user: '$user' } } },
          { $group: { _id: '$_id.eventShow', count: { $sum: 1 } } },
        ])
      : [],
    // Unique users per competitionType across listed competitions
    compIds.length
      ? Registration.aggregate([
          {
            $match: {
              competitionId: { $in: compIds },
              user: { $ne: null },
              status: { $in: ['approved', 'pending'] },
            },
          },
          {
            $lookup: {
              from: Competition.collection.name,
              localField: 'competitionId',
              foreignField: '_id',
              as: 'comp',
            },
          },
          { $unwind: '$comp' },
          { $group: { _id: { type: '$comp.competitionType', user: '$user' } } },
          { $group: { _id: '$_id.type', count: { $sum: 1 } } },
        ])
      : [],
  ]);

  const festCountMap = countMapFromAgg(festCounts);
  const compCountMap = countMapFromAgg(compCounts);
  const trekCountMap = countMapFromAgg(trekCounts);
  const runCountMap = countMapFromAgg(runCounts);
  const eventCountMap = countMapFromAgg(eventCounts);
  const typeCountMap = countMapFromAgg(typeCounts);

  const festRows = (fests || []).map((f) => ({
    id: String(f._id),
    name: f.festName || 'Fest',
    date: f.festDate || null,
    status: f.status || '',
    registrantCount: festCountMap[String(f._id)] || 0,
  }));

  const competitionRows = (competitions || []).map((c) => ({
    id: String(c._id),
    name: c.name || 'Competition',
    competitionType: c.competitionType || '',
    festId: c.fest ? String(c.fest) : '',
    registrantCount: compCountMap[String(c._id)] || 0,
  }));

  const trekRows = (treks || []).map((t) => ({
    id: String(t._id),
    name: t.trekName || 'Trek',
    date: t.trekDate || null,
    status: t.status || '',
    registrantCount: trekCountMap[String(t._id)] || 0,
  }));

  const runRows = (runs || []).map((r) => ({
    id: String(r._id),
    name: r.title || 'Run',
    date: r.eventDate || null,
    status: r.status || '',
    registrantCount: runCountMap[String(r._id)] || 0,
  }));

  const eventRows = (events || []).map((e) => ({
    id: String(e._id),
    name: e.displayName || e.title || 'Event',
    status: e.status || '',
    registrantCount: eventCountMap[String(e._id)] || 0,
  }));

  const types = (competitionTypes || [])
    .filter((t) => t != null && String(t).trim())
    .map((t) => String(t).trim())
    .sort();
  const competitionTypeRows = types.map((t) => ({
    id: t,
    name: t,
    registrantCount: typeCountMap[t] || 0,
  }));

  const catalog = [];

  for (const t of competitionTypeRows) {
    catalog.push({
      kind: 'competition_type',
      id: t.id,
      label: `All ${t.name} competitions`,
      meta: 'competition type',
      registrantCount: t.registrantCount,
      audience: {
        type: 'competition_type',
        filters: { competitionType: t.id, status: 'all' },
        label: `Competition type: ${t.id}`,
      },
    });
  }

  for (const c of competitionRows) {
    catalog.push({
      kind: 'competition',
      id: c.id,
      label: c.name,
      meta: c.competitionType || 'competition',
      registrantCount: c.registrantCount,
      audience: {
        type: 'competition',
        filters: { competitionId: c.id, status: 'all' },
        label: `Competition: ${c.name}`,
      },
    });
  }

  for (const f of festRows) {
    catalog.push({
      kind: 'fest',
      id: f.id,
      label: f.name,
      meta: f.status || 'fest',
      registrantCount: f.registrantCount,
      audience: {
        type: 'fest',
        filters: { festId: f.id, status: 'all' },
        label: `Fest: ${f.name}`,
      },
    });
  }

  for (const t of trekRows) {
    catalog.push({
      kind: 'trek',
      id: t.id,
      label: t.name,
      meta: t.status || 'trek',
      registrantCount: t.registrantCount,
      audience: {
        type: 'trek',
        filters: { trekId: t.id, status: 'confirmed' },
        label: `Trek: ${t.name}`,
      },
    });
  }

  for (const r of runRows) {
    catalog.push({
      kind: 'run',
      id: r.id,
      label: r.name,
      meta: r.status || 'run',
      registrantCount: r.registrantCount,
      audience: {
        type: 'run',
        filters: { eventId: r.id, status: 'all' },
        label: `Run: ${r.name}`,
      },
    });
  }

  for (const e of eventRows) {
    catalog.push({
      kind: 'event_show',
      id: e.id,
      label: e.name,
      meta: e.status || 'event',
      registrantCount: e.registrantCount,
      audience: {
        type: 'event_show',
        filters: { eventShowId: e.id },
        label: `Event: ${e.name}`,
      },
    });
  }

  catalog.sort((a, b) => (b.registrantCount || 0) - (a.registrantCount || 0));

  return {
    fests: festRows,
    competitions: competitionRows,
    competitionTypes: types,
    competitionTypeCounts: competitionTypeRows,
    treks: trekRows,
    runs: runRows,
    events: eventRows,
    catalog,
    audienceTypes: [
      { id: 'all_users', label: 'All users' },
      { id: 'fest', label: 'Fest participants' },
      { id: 'competition_type', label: 'Competition type (e.g. Fashion)' },
      { id: 'competition', label: 'Specific competition' },
      { id: 'trek', label: 'Trek participants' },
      { id: 'run', label: 'Run / sports participants' },
      { id: 'event_show', label: 'Event show participants' },
      { id: 'manual', label: 'Manual user pick' },
    ],
  };
}

function describeAudience(audience = {}) {
  const type = audience.type;
  const f = audience.filters || {};
  if (audience.label) return audience.label;
  switch (type) {
    case 'all_users':
      return 'All users';
    case 'fest':
      return 'Fest participants';
    case 'competition_type':
      return `Competition type: ${f.competitionType || '—'}`;
    case 'competition':
      return 'Specific competition';
    case 'trek':
      return 'Trek participants';
    case 'run':
      return 'Run participants';
    case 'event_show':
      return 'Event show participants';
    case 'manual':
      return 'Manual selection';
    default:
      return type || 'Audience';
  }
}

module.exports = {
  MAX_AUDIENCE,
  resolveUserIdsFromAudience,
  buildAudiencePreview,
  getAudienceOptions,
  describeAudience,
};
