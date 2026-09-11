'use strict';

const PaymentOrder = require('../model/payment_order_model');
const Registration = require('../model/registration_model');
const CategoryRegistration = require('../model/category_registration_model');
const EventShowRegistration = require('../model/event_show_registration_model');
const TrekBooking = require('../model/trek_booking_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const SportsEvent = require('../model/sports_model');
const RunClub = require('../model/run_club_model');
const Trek = require('../model/trek_model');
const TrekCommunity = require('../model/trek_community_model');
const EventShow = require('../model/event_show_model');
const CashfreeSettlement = require('../model/cashfree_settlement_model');
const PaymentRefund = require('../model/payment_refund_model');
const OrganizerPayout = require('../model/organizer_payout_model');
const PaymentAuditLog = require('../model/payment_audit_log_model');
const { MINDSPARK_FEST_ID } = require('../modules/fest/plugins/mindspark');
const { round2 } = require('../utils/cashfreeGatewayFee');
const {
  BUCKET_OTHER,
  BUCKET_MINDSPARK,
  BUCKET_TOUCH_GRASS,
  BUCKET_LABELS,
  getEventPolicy,
  usesMondayClear,
  isCashfreeGateway,
  classifyBucket,
  computeFinancials,
  settlementStatusOf,
  settlementDateOf,
  payoutOverrideKey,
  derivePayoutStatus,
  linkOrdersToRegistrations,
  summarizeRows,
  idStr,
  isDashboardRow,
  isInScopeBucket,
  isManualFlag,
  scheduleForPayment,
  buildDashboardSchedule,
  buildBatchPaidLedger,
  findBatchPaidPayout,
  applyOrganizerPaidToSchedule,
  parseMondayClearEventId,
} = require('./paymentSettlementMath');

function responsesObject(responses) {
  if (!responses) return {};
  if (responses instanceof Map) return Object.fromEntries(responses);
  if (typeof responses.toObject === 'function') return responses.toObject();
  return { ...responses };
}

function emailFromResponses(responses) {
  const obj = responsesObject(responses);
  return String(obj.email || obj.email_id || obj.e_mail || obj.user_email || '').trim().toLowerCase();
}

function asObjectIdList(ids) {
  return [...new Set((ids || [])
    .map((id) => String(id || ''))
    .filter((id) => /^[a-fA-F0-9]{24}$/.test(id)))];
}

function refundTotalFor(refunds = []) {
  let sum = 0;
  for (const refund of refunds) {
    const status = String(refund.status || '').toUpperCase();
    if (status && /FAIL|CANCEL|REJECT/.test(status)) continue;
    sum += Number(refund.amount) || 0;
  }
  return sum;
}

function flattenEventShowRegs(docs = []) {
  const out = [];
  for (const doc of docs) {
    const eventShowId = idStr(doc.eventShow);
    if (isCashfreeGateway(doc.payment_gateway) && (doc.paymentStatus === 'paid' || Number(doc.amountPaid) > 0)) {
      out.push({
        id: String(doc._id),
        kind: 'event_show',
        payment_order_id: doc.payment_order_id || '',
        payment_id: doc.payment_id || '',
        payment_gateway: doc.payment_gateway,
        paymentStatus: doc.paymentStatus,
        amountPaid: Number(doc.amountPaid) || 0,
        eventId: eventShowId,
        entityType: 'event_show',
        createdAt: doc.createdAt,
      });
    }
    for (const entry of doc.additionalEntries || []) {
      if (!isCashfreeGateway(entry.payment_gateway || doc.payment_gateway)) continue;
      if (entry.paymentStatus !== 'paid' && !(Number(entry.amountPaid) > 0)) continue;
      out.push({
        id: `${doc._id}:${entry._id || entry.payment_order_id}`,
        kind: 'event_show',
        payment_order_id: entry.payment_order_id || '',
        payment_id: entry.payment_id || '',
        payment_gateway: entry.payment_gateway || doc.payment_gateway,
        paymentStatus: entry.paymentStatus,
        amountPaid: Number(entry.amountPaid) || 0,
        eventId: eventShowId,
        entityType: 'event_show',
        createdAt: entry.submittedAt || doc.createdAt,
      });
    }
  }
  return out;
}

async function loadNormalizedRegistrations() {
  const [festRegs, categoryRegs, eventShowDocs, trekBookings] = await Promise.all([
    Registration.find({
      $or: [
        { paymentStatus: 'paid', payment_gateway: 'cashfree' },
        { payment_order_id: { $type: 'string', $gt: '' } },
      ],
    })
      .select('fest competitionId payment_order_id payment_id payment_gateway paymentStatus amountPaid createdAt status responses')
      .lean(),
    CategoryRegistration.find({
      $or: [
        { paymentStatus: 'paid', payment_gateway: 'cashfree' },
        { payment_order_id: { $type: 'string', $gt: '' } },
      ],
    })
      .select('category eventId runClubId payment_order_id payment_id payment_gateway paymentStatus amountPaid createdAt status guestEmail guestName responses')
      .lean(),
    EventShowRegistration.find({
      $or: [
        { payment_gateway: 'cashfree' },
        { payment_order_id: { $type: 'string', $gt: '' } },
        { 'additionalEntries.payment_order_id': { $type: 'string', $gt: '' } },
      ],
    })
      .select('eventShow payment_order_id payment_id payment_gateway paymentStatus amountPaid additionalEntries createdAt')
      .lean(),
    TrekBooking.find({
      $or: [
        { paymentStatus: 'paid', payment_gateway: 'cashfree' },
        { payment_order_id: { $type: 'string', $gt: '' } },
      ],
    })
      .select('trekId payment_order_id payment_gateway paymentStatus bookingDetails createdAt')
      .lean(),
  ]);

  const normalized = [];

  for (const reg of festRegs) {
    if (!isCashfreeGateway(reg.payment_gateway)) continue;
    const festId = idStr(reg.fest);
    normalized.push({
      id: String(reg._id),
      kind: reg.competitionId ? 'competition' : 'fest',
      payment_order_id: reg.payment_order_id || '',
      payment_id: reg.payment_id || '',
      payment_gateway: reg.payment_gateway,
      paymentStatus: reg.paymentStatus,
      registrationStatus: reg.status || '',
      amountPaid: Number(reg.amountPaid) || 0,
      email: emailFromResponses(reg.responses),
      manual: isManualFlag(reg.responses),
      festId,
      eventId: idStr(reg.competitionId) || festId,
      entityType: reg.competitionId ? 'competition' : 'fest',
      createdAt: reg.createdAt,
    });
  }

  for (const reg of categoryRegs) {
    if (!isCashfreeGateway(reg.payment_gateway)) continue;
    const entityType = reg.category === 'trek' ? 'trek' : 'sports';
    normalized.push({
      id: String(reg._id),
      kind: entityType,
      payment_order_id: reg.payment_order_id || '',
      payment_id: reg.payment_id || '',
      payment_gateway: reg.payment_gateway,
      paymentStatus: reg.paymentStatus,
      registrationStatus: reg.status || '',
      amountPaid: Number(reg.amountPaid) || 0,
      email: String(reg.guestEmail || emailFromResponses(reg.responses) || '').trim().toLowerCase(),
      manual: isManualFlag(reg.responses),
      eventId: idStr(reg.eventId),
      runClubId: idStr(reg.runClubId),
      entityType,
      createdAt: reg.createdAt,
    });
  }

  normalized.push(...flattenEventShowRegs(eventShowDocs));

  for (const booking of trekBookings) {
    if (!isCashfreeGateway(booking.payment_gateway)) continue;
    normalized.push({
      id: String(booking._id),
      kind: 'trek',
      payment_order_id: booking.payment_order_id || booking.bookingDetails?.payment_order_id || '',
      payment_id: booking.bookingDetails?.paymentId || '',
      payment_gateway: booking.payment_gateway,
      paymentStatus: booking.paymentStatus,
      amountPaid: Number(booking.bookingDetails?.amountPaid) || 0,
      eventId: idStr(booking.trekId),
      entityType: 'trek',
      createdAt: booking.createdAt,
    });
  }

  return normalized;
}

async function loadEntityContext(orders, registrations) {
  const festIds = new Set();
  const competitionIds = new Set();
  const sportsIds = new Set();
  const trekIds = new Set();
  const showIds = new Set();
  const clubIds = new Set();

  for (const reg of registrations) {
    if (reg.festId) festIds.add(reg.festId);
    if (reg.kind === 'competition' && reg.eventId) competitionIds.add(reg.eventId);
    if (reg.kind === 'sports' && reg.eventId) sportsIds.add(reg.eventId);
    if (reg.runClubId) clubIds.add(reg.runClubId);
    if (reg.kind === 'trek' && reg.eventId) trekIds.add(reg.eventId);
    if (reg.kind === 'event_show' && reg.eventId) showIds.add(reg.eventId);
  }

  for (const order of orders) {
    const type = order.entityType;
    const id = idStr(order.entityId);
    if (!id) continue;
    if (type === 'fest') festIds.add(id);
    if (type === 'competition') competitionIds.add(id);
    if (type === 'sports' || type === 'event') sportsIds.add(id);
    if (type === 'trek') trekIds.add(id);
    if (type === 'event_show') showIds.add(id);
    const tags = order.orderTags || {};
    if (tags.festId) festIds.add(String(tags.festId));
    if (tags.competitionId) competitionIds.add(String(tags.competitionId));
    if (tags.eventId) sportsIds.add(String(tags.eventId));
  }

  const [fests, competitions, sports, treks, shows] = await Promise.all([
    festIds.size
      ? FestOrganizer.find({ _id: { $in: asObjectIdList([...festIds]) } }).select('festName organizer').lean()
      : [],
    competitionIds.size
      ? Competition.find({ _id: { $in: asObjectIdList([...competitionIds]) } }).select('name fest').lean()
      : [],
    sportsIds.size
      ? SportsEvent.find({ _id: { $in: asObjectIdList([...sportsIds]) } }).select('title slug organizer runClubId').lean()
      : [],
    trekIds.size
      ? Trek.find({ _id: { $in: asObjectIdList([...trekIds]) } }).select('name title communityId organizer').lean()
      : [],
    showIds.size
      ? EventShow.find({ _id: { $in: asObjectIdList([...showIds]) } }).select('title displayName organizer').lean()
      : [],
  ]);

  for (const sport of sports) {
    if (sport.runClubId) clubIds.add(idStr(sport.runClubId));
  }
  const communityIds = new Set();
  for (const trek of treks) {
    if (trek.communityId) communityIds.add(idStr(trek.communityId));
  }

  const [clubs, communities] = await Promise.all([
    clubIds.size
      ? RunClub.find({ _id: { $in: asObjectIdList([...clubIds]) } }).select('name slug organizer listingHub').lean()
      : [],
    communityIds.size
      ? TrekCommunity.find({ _id: { $in: asObjectIdList([...communityIds]) } }).select('name organizer').lean()
      : [],
  ]);

  return {
    fests: new Map(fests.map((row) => [String(row._id), row])),
    competitions: new Map(competitions.map((row) => [String(row._id), row])),
    sports: new Map(sports.map((row) => [String(row._id), row])),
    treks: new Map(treks.map((row) => [String(row._id), row])),
    shows: new Map(shows.map((row) => [String(row._id), row])),
    clubs: new Map(clubs.map((row) => [String(row._id), row])),
    communities: new Map(communities.map((row) => [String(row._id), row])),
  };
}

function resolveContext(order, registration, entities) {
  const entityType = order?.entityType || registration?.entityType || '';
  const tags = order?.orderTags || {};
  let festId = registration?.festId || String(tags.festId || '');
  let eventId = registration?.eventId || idStr(order?.entityId);
  let eventName = '';
  let organizerType = 'unknown';
  let organizerId = '';
  let organizerName = '';
  let eventTitle = '';
  let eventSlug = '';
  let clubName = '';
  let clubSlug = '';

  if (entityType === 'fest' || registration?.kind === 'fest') {
    festId = festId || eventId;
    const fest = entities.fests.get(festId);
    const competitionId = (registration?.kind === 'competition' ? idStr(registration?.eventId) : '')
      || String(tags.competitionId || '');
    const competition = competitionId ? entities.competitions.get(competitionId) : null;
    if (competition) {
      eventId = competitionId;
      eventName = competition.name || tags.competitionName || 'Competition';
    } else if (tags.competitionName) {
      eventName = tags.competitionName;
    } else {
      eventId = festId;
      eventName = fest?.festName || tags.festName || 'Fest';
    }
    organizerType = 'fest';
    organizerId = festId;
    organizerName = fest?.festName || eventName;
  } else if (entityType === 'competition' || registration?.kind === 'competition') {
    const competition = entities.competitions.get(eventId);
    if (competition) {
      festId = festId || idStr(competition.fest);
      eventName = competition.name || tags.competitionName || 'Competition';
    } else {
      eventName = tags.competitionName || 'Competition';
    }
    const fest = entities.fests.get(festId);
    organizerType = 'fest';
    organizerId = festId || MINDSPARK_FEST_ID;
    organizerName = fest?.festName || 'Fest organizer';
    if (isMindSparkFallback(festId)) eventName = eventName || 'Mindspark';
  } else if (entityType === 'sports' || entityType === 'event' || registration?.kind === 'sports') {
    const sport = entities.sports.get(eventId);
    eventTitle = sport?.title || tags.eventName || '';
    eventSlug = sport?.slug || '';
    const club = entities.clubs.get(idStr(sport?.runClubId) || registration?.runClubId || '');
    clubName = club?.name || '';
    clubSlug = club?.slug || '';
    eventName = eventTitle || clubName || 'Event';
    organizerType = 'run_club';
    organizerId = idStr(sport?.runClubId) || registration?.runClubId || eventId;
    organizerName = clubName || sport?.organizer || 'Event organizer';
  } else if (entityType === 'trek' || registration?.kind === 'trek') {
    const trek = entities.treks.get(eventId);
    eventName = trek?.name || trek?.title || tags.trekName || 'Trek';
    const community = entities.communities.get(idStr(trek?.communityId));
    organizerType = 'trek_community';
    organizerId = idStr(trek?.communityId) || eventId;
    organizerName = community?.name || trek?.organizer || 'Trek organizer';
  } else if (entityType === 'event_show' || registration?.kind === 'event_show') {
    const show = entities.shows.get(eventId);
    eventName = show?.title || show?.displayName || tags.eventShowName || 'Event show';
    organizerType = 'event_show';
    organizerId = eventId;
    organizerName = show?.organizer || eventName;
  } else {
    eventName = tags.festName || tags.eventName || tags.eventShowName || 'Unknown event';
    organizerName = eventName;
  }

  const bucket = classifyBucket({
    festId,
    entityType,
    eventTitle: eventTitle || eventName,
    eventSlug,
    clubName,
    clubSlug,
  });

  if (bucket === BUCKET_MINDSPARK || usesMondayClear(bucket)) {
    const fest = entities.fests.get(festId) || entities.fests.get(MINDSPARK_FEST_ID);
    const festLabel = fest?.festName || BUCKET_LABELS[bucket] || 'Mindspark';
    organizerType = 'fest';
    organizerId = festId || MINDSPARK_FEST_ID;
    organizerName = festLabel;
    const looksLikeFestLabel = !eventName
      || eventName === festLabel
      || eventName === BUCKET_LABELS[BUCKET_MINDSPARK]
      || eventName === 'Fest'
      || eventName === 'Unknown event';
    if (looksLikeFestLabel) eventName = festLabel;
  } else if (getEventPolicy(bucket)) {
    const label = BUCKET_LABELS[bucket] || getEventPolicy(bucket).label;
    eventName = label;
    organizerName = organizerName || label;
  }

  return {
    festId,
    eventId,
    eventName,
    organizerType,
    organizerId,
    organizerName,
    bucket,
  };
}

function isMindSparkFallback(festId) {
  return String(festId || '') === MINDSPARK_FEST_ID;
}

function buildPayoutOverrideMap(payouts = []) {
  const map = new Map();
  for (const payout of payouts) {
    const key = payoutOverrideKey(payout);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, payout);
      continue;
    }
    const rank = { paid: 3, ready: 2, pending: 1 };
    if ((rank[payout.status] || 0) >= (rank[prev.status] || 0)) map.set(key, payout);
  }
  return map;
}

function enrichLinkedRow({ order, registration, unmatched, duplicate, orphanRegistration }, extras) {
  const { entities, settlementsByOrder, refundsByOrder, payoutOverrides, batchPaidLedger } = extras;
  const ctx = resolveContext(order, registration, entities);
  const orderId = String(order?.orderId || registration?.payment_order_id || '');
  const settlement = settlementsByOrder.get(orderId) || null;
  const paymentId = String(order?.paymentId || registration?.payment_id || settlement?.cfPaymentId || '');
  const grossFromReg = Number(registration?.amountPaid) || 0;
  const grossFromOrder = Number(order?.totalAmount) || 0;
  const gross = grossFromReg > 0 ? grossFromReg : grossFromOrder;
  const refunded = refundTotalFor(refundsByOrder.get(orderId) || []);
  const money = computeFinancials(gross, refunded);
  const override = payoutOverrides.get(payoutOverrideKey(ctx));
  let schedule = scheduleForPayment({
    createdAt: order?.createdAt || registration?.createdAt || null,
    bucket: ctx.bucket || BUCKET_OTHER,
    settlementStatus: settlementStatusOf(settlement),
  });

  const batchPaid = findBatchPaidPayout(
    { orderId, bucket: ctx.bucket || BUCKET_OTHER },
    batchPaidLedger,
    schedule,
  );
  if (batchPaid) {
    schedule = applyOrganizerPaidToSchedule(schedule, batchPaid);
  }

  const payoutStatus = derivePayoutStatus({
    settlement,
    payoutOverride: batchPaid?.status === 'paid' ? { status: 'paid' } : override,
  });

  return {
    orderId,
    paymentId,
    entityType: order?.entityType || registration?.entityType || '',
    entityId: idStr(order?.entityId) || registration?.eventId || '',
    registrationId: registration?.id || null,
    registrationKind: registration?.kind || null,
    unmatched: Boolean(unmatched),
    duplicate: Boolean(duplicate),
    orphanRegistration: Boolean(orphanRegistration),
    bucket: ctx.bucket || BUCKET_OTHER,
    groupName: BUCKET_LABELS[ctx.bucket] || ctx.eventName || 'Unknown event',
    festId: ctx.festId || '',
    eventId: ctx.eventId || '',
    eventName: ctx.eventName || 'Unknown event',
    competitionName: ctx.bucket === BUCKET_MINDSPARK ? (ctx.eventName || '') : '',
    organizerType: ctx.organizerType,
    organizerId: ctx.organizerId || '',
    organizerName: ctx.organizerName || 'Unknown organizer',
    paymentStatus: order?.status || registration?.paymentStatus || 'PAID',
    registrationStatus: registration?.registrationStatus || '',
    email: registration?.email || order?.customerEmail || '',
    customerEmail: order?.customerEmail || registration?.email || '',
    manual: Boolean(registration?.manual),
    amountPaid: gross,
    ...money,
    settlementStatus: settlementStatusOf(settlement),
    settlementDate: settlementDateOf(settlement),
    settlementUtr: settlement?.transferUtr || null,
    settlementAmount: settlement?.settlementAmount ?? null,
    cfSettlementId: settlement?.cfSettlementId || null,
    payoutStatus,
    payoutId: (batchPaid?._id && String(batchPaid._id))
      || (override?._id ? String(override._id) : null),
    organizerPaidAt: schedule.organizerPaidAt || batchPaid?.paidAt || override?.paidAt || null,
    createdAt: order?.createdAt || registration?.createdAt || null,
    schedule,
  };
}

async function buildLinkedPaymentRows() {
  const [orders, registrations, settlements, refunds, payouts] = await Promise.all([
    PaymentOrder.find({
      status: 'PAID',
      $or: [{ gateway: 'cashfree' }, { gateway: { $exists: false } }, { gateway: null }],
    })
      .select('orderId paymentId entityType entityId totalAmount status gateway orderTags customerEmail createdAt')
      .lean(),
    loadNormalizedRegistrations(),
    CashfreeSettlement.find({}).lean(),
    PaymentRefund.find({}).lean(),
    OrganizerPayout.find({}).lean(),
  ]);

  const cashfreeOrders = orders.filter((order) => isCashfreeGateway(order.gateway));
  const entities = await loadEntityContext(cashfreeOrders, registrations);
  const settlementsByOrder = new Map(settlements.map((row) => [String(row.orderId), row]));
  const refundsByOrder = new Map();
  for (const refund of refunds) {
    const key = String(refund.orderId || '');
    if (!key) continue;
    const list = refundsByOrder.get(key) || [];
    list.push(refund);
    refundsByOrder.set(key, list);
  }
  const payoutOverrides = buildPayoutOverrideMap(payouts);
  const batchPaidLedger = buildBatchPaidLedger(payouts);
  const extras = { entities, settlementsByOrder, refundsByOrder, payoutOverrides, batchPaidLedger };

  const { rows: linked, duplicateOrderIds } = linkOrdersToRegistrations(cashfreeOrders, registrations);
  const rows = linked
    .map((item) => enrichLinkedRow(item, extras))
    .filter(isDashboardRow);
  const paidPayoutAmount = payouts
    .filter((p) => p.status === 'paid' && isInScopeBucket(p.bucket))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return { rows, duplicateOrderIds, payouts, paidPayoutAmount };
}

async function getPaymentSummary() {
  const { rows, duplicateOrderIds, payouts } = await buildLinkedPaymentRows();
  const summary = summarizeRows(rows);
  // Legacy ledger-only paid batches (no matching paid rows yet) still count once.
  for (const payout of payouts) {
    if (payout.status !== 'paid' || !isInScopeBucket(payout.bucket)) continue;
    const amount = Number(payout.amount) || 0;
    if (!amount) continue;
    if (batchPayoutCountedInRows(payout, rows)) continue;

    const bucket = summary.buckets.find((row) => row.id === payout.bucket);
    if (bucket) bucket.alreadyPaid = round2((bucket.alreadyPaid || 0) + amount);
    summary.totals.alreadyPaid = round2((summary.totals.alreadyPaid || 0) + amount);
  }
  return {
    ...summary,
    duplicateOrderIds,
    payouts: payouts.map(serializePayout),
    feeRate: 0.016,
    tPlusDays: 2,
    schedule: buildDashboardSchedule(rows),
  };
}

function batchPayoutCountedInRows(payout, rows = []) {
  const orderIds = new Set(
    (Array.isArray(payout.orderIds) ? payout.orderIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  );
  if (orderIds.size) {
    return rows.some((row) => (
      (row.payoutStatus === 'paid' || row.schedule?.stage === 'paid')
      && orderIds.has(String(row.orderId || '').trim())
    ));
  }

  const clearYmd = String(
    payout.clearMondayYmd || parseMondayClearEventId(payout.eventId) || '',
  ).trim();
  if (clearYmd) {
    return rows.some((row) => (
      (row.payoutStatus === 'paid' || row.schedule?.stage === 'paid')
      && String(row.schedule?.clearMondayYmd || '').trim() === clearYmd
    ));
  }

  return rows.some((row) => (
    row.payoutStatus === 'paid'
    && payoutOverrideKey(row) === payoutOverrideKey(payout)
  ));
}

async function getPaymentHistory({
  page = 1,
  limit = 200,
  bucket,
  payoutStatus,
  q,
  weekStartYmd,
  weekEndYmd,
  clearMondayYmd,
  stageGroup,
} = {}) {
  const { rows } = await buildLinkedPaymentRows();
  const query = String(q || '').trim().toLowerCase();
  const bucketKey = String(bucket || '').trim();
  let filtered = rows;
  if (bucketKey) {
    filtered = filtered.filter((row) => String(row.bucket || '').trim() === bucketKey);
  }
  if (payoutStatus) filtered = filtered.filter((row) => row.payoutStatus === payoutStatus);

  const weekStart = String(weekStartYmd || '').trim();
  const weekEnd = String(weekEndYmd || '').trim();
  const clearMonday = String(clearMondayYmd || '').trim();
  const stage = String(stageGroup || '').trim().toLowerCase();

  if (weekStart || weekEnd || clearMonday) {
    filtered = filtered.filter((row) => {
      const paidYmd = String(row.schedule?.paidYmd || '').trim();
      const rowWeekStart = String(row.schedule?.weekStartYmd || '').trim();
      const rowClear = String(row.schedule?.clearMondayYmd || '').trim();

      // Paid inside the Mon–Sun collection week
      if (weekStart && weekEnd && paidYmd) {
        if (paidYmd >= weekStart && paidYmd <= weekEnd) return true;
      } else if (weekStart && rowWeekStart === weekStart) {
        return true;
      }

      // Also include rows that clear on this Monday (T+2 slip from prior days)
      if (clearMonday && rowClear === clearMonday) return true;

      return false;
    });
  }

  if (stage === 'waiting_t2') {
    filtered = filtered.filter((row) => row.schedule?.stage === 'waiting_t2');
  } else if (stage === 'ready') {
    filtered = filtered.filter((row) => (
      row.schedule?.stage
      && row.schedule.stage !== 'waiting_t2'
      && row.schedule.stage !== 'paid'
      && row.payoutStatus !== 'paid'
    ));
  } else if (stage === 'paid') {
    filtered = filtered.filter((row) => (
      row.schedule?.stage === 'paid' || row.payoutStatus === 'paid'
    ));
  }

  if (query) {
    filtered = filtered.filter((row) => (
      String(row.orderId).toLowerCase().includes(query)
      || String(row.paymentId).toLowerCase().includes(query)
      || String(row.eventName).toLowerCase().includes(query)
      || String(row.groupName).toLowerCase().includes(query)
      || String(row.organizerName).toLowerCase().includes(query)
    ));
  }
  filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 200));
  const safePage = Math.max(1, Number(page) || 1);
  const start = (safePage - 1) * safeLimit;
  return {
    total: filtered.length,
    page: safePage,
    limit: safeLimit,
    weekStartYmd: weekStart || null,
    weekEndYmd: weekEnd || null,
    clearMondayYmd: clearMonday || null,
    stageGroup: stage || null,
    rows: filtered.slice(start, start + safeLimit),
  };
}

function serializePayout(payout) {
  return {
    id: String(payout._id),
    organizerType: payout.organizerType,
    organizerId: payout.organizerId,
    organizerName: payout.organizerName,
    bucket: payout.bucket,
    eventId: payout.eventId,
    eventName: payout.eventName,
    amount: Number(payout.amount) || 0,
    status: payout.status,
    batchKind: payout.batchKind || '',
    clearMondayYmd: payout.clearMondayYmd || '',
    orderIds: Array.isArray(payout.orderIds) ? payout.orderIds.map(String) : [],
    paidAt: payout.paidAt || null,
    note: payout.note || '',
    createdBy: payout.createdBy || '',
    updatedAt: payout.updatedAt || null,
  };
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function filterExportRows(rows, { bucket, kind = 'history', clearMondayYmd, stageGroup } = {}) {
  let filtered = rows;
  if (bucket) filtered = filtered.filter((row) => row.bucket === bucket);

  if (kind === 'monday_clear' || kind === 'ready_batch') {
    const schedule = buildDashboardSchedule(rows);
    const targetBucket = bucket || BUCKET_MINDSPARK;
    const policy = getEventPolicy(targetBucket);
    if (policy?.cadence === 'monday_clear') {
      const eventSched = (schedule.events || []).find((row) => row.id === targetBucket);
      const clearYmd = clearMondayYmd
        || eventSched?.thisMondayClear?.clearMondayYmd
        || schedule.mindspark?.thisMondayClear?.clearMondayYmd
        || '';
      filtered = filtered.filter((row) => (
        row.bucket === targetBucket
        && row.schedule?.clearMondayYmd === clearYmd
        && row.schedule?.stage !== 'waiting_t2'
      ));
      return { rows: filtered, clearMondayYmd: clearYmd, schedule, stageGroup: 'ready' };
    }
    filtered = filtered.filter((row) => (
      row.bucket === targetBucket
      && row.schedule?.stage
      && row.schedule.stage !== 'waiting_t2'
    ));
    return { rows: filtered, clearMondayYmd: null, schedule, stageGroup: 'ready' };
  }

  if (stageGroup === 'waiting_t2') {
    filtered = filtered.filter((row) => row.schedule?.stage === 'waiting_t2');
  } else if (stageGroup === 'ready') {
    filtered = filtered.filter((row) => (
      row.schedule?.stage
      && row.schedule.stage !== 'waiting_t2'
      && row.schedule.stage !== 'paid'
      && row.payoutStatus !== 'paid'
    ));
  } else if (stageGroup === 'paid') {
    filtered = filtered.filter((row) => (
      row.schedule?.stage === 'paid' || row.payoutStatus === 'paid'
    ));
  }

  filtered = [...filtered].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return { rows: filtered, clearMondayYmd: null, schedule: null, stageGroup: stageGroup || null };
}

function paymentRowsToCsv(rows) {
  const headers = [
    'paid_at',
    'bucket',
    'event',
    'order_id',
    'payment_id',
    'gross',
    'fee_1_6pct',
    'organizer_payable',
    'expected_bank_ymd',
    'clear_monday_ymd',
    'stage',
    'settlement_status',
    'cashfree_settlement_date',
    'settlement_utr',
    'cf_settlement_id',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push([
      row.createdAt ? new Date(row.createdAt).toISOString() : '',
      row.bucket || '',
      row.eventName || row.groupName || '',
      row.orderId || '',
      row.paymentId || '',
      row.netGross ?? '',
      row.fee ?? '',
      row.organizerPayable ?? '',
      row.schedule?.expectedBankYmd || '',
      row.schedule?.clearMondayYmd || '',
      row.schedule?.stage || '',
      row.settlementStatus || '',
      row.settlementDate ? new Date(row.settlementDate).toISOString() : '',
      row.settlementUtr || '',
      row.cfSettlementId || '',
    ].map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function exportPaymentCsv({ bucket, kind = 'history', clearMondayYmd, stageGroup } = {}) {
  const { rows } = await buildLinkedPaymentRows();
  const { rows: filtered, clearMondayYmd: clearYmd } = filterExportRows(rows, {
    bucket,
    kind,
    clearMondayYmd,
    stageGroup,
  });
  const csv = paymentRowsToCsv(filtered);
  const stamp = new Date().toISOString().slice(0, 10);
  const scope = bucket || 'overall';
  let filename = `payments-${scope}-${stamp}.csv`;
  if (kind === 'monday_clear' || (kind === 'ready_batch' && usesMondayClear(bucket || BUCKET_MINDSPARK))) {
    filename = `${scope}-monday-clear-${clearYmd || stamp}.csv`;
  } else if (kind === 'ready_batch') {
    filename = `${scope}-ready-${stamp}.csv`;
  }
  return { csv, filename, count: filtered.length, clearMondayYmd: clearYmd };
}

/**
 * Mark a ready settlement batch as paid (ledger only).
 * - monday_clear events: this Monday's ready clear
 * - t_plus events: all payments past T+2 (expected/in bank)
 */
async function markEventBatchPaid({
  actor = 'admin',
  bucket = BUCKET_MINDSPARK,
  clearMondayYmd,
  stageGroup = 'ready',
} = {}) {
  const policy = getEventPolicy(bucket);
  if (!policy) {
    const err = new Error('Unknown dashboard event bucket');
    err.code = 'UNKNOWN_BUCKET';
    throw err;
  }

  const { rows } = await buildLinkedPaymentRows();
  const schedule = buildDashboardSchedule(rows);
  const eventSched = (schedule.events || []).find((row) => row.id === bucket);

  let readyRows = [];
  let eventId = '';
  let eventName = '';
  let note = '';
  let clearYmd = null;

  if (policy.cadence === 'monday_clear') {
    const clear = eventSched?.thisMondayClear || schedule.mindspark?.thisMondayClear || {};
    clearYmd = clearMondayYmd || clear.clearMondayYmd;
    if (!clearYmd) {
      const err = new Error('No Monday clear date available');
      err.code = 'NO_CLEAR_DATE';
      throw err;
    }
    readyRows = rows.filter((row) => (
      row.bucket === bucket
      && row.schedule?.clearMondayYmd === clearYmd
      && row.schedule?.stage !== 'waiting_t2'
      && row.schedule?.stage !== 'paid'
      && row.payoutStatus !== 'paid'
    ));
    eventId = `monday-clear-${clearYmd}`;
    eventName = `${policy.label} clear ${clearYmd}`;
    note = `Monday clear ${clearYmd} · ${readyRows.length} payments · week ${clear.weekStartYmd || ''}–${clear.weekEndYmd || ''}`;
  } else {
    const wantWaiting = stageGroup === 'waiting_t2';
    readyRows = rows.filter((row) => {
      if (row.bucket !== bucket) return false;
      if (row.schedule?.stage === 'paid' || row.payoutStatus === 'paid') return false;
      const waiting = row.schedule?.stage === 'waiting_t2';
      return wantWaiting ? waiting : !waiting;
    });
    const stamp = new Date().toISOString().slice(0, 10);
    eventId = wantWaiting ? `tplus-waiting-${stamp}` : `tplus-ready-${stamp}`;
    eventName = wantWaiting
      ? `${policy.label} waiting T+2 ${stamp}`
      : `${policy.label} ready ${stamp}`;
    note = `${eventName} · ${readyRows.length} payments`;
  }

  const amount = round2(
    readyRows.reduce((sum, row) => sum + (Number(row.organizerPayable) || 0), 0),
  );
  if (!readyRows.length || amount <= 0) {
    const err = new Error(`No ready ${policy.label} payments to mark paid`);
    err.code = 'NOTHING_TO_CLEAR';
    throw err;
  }

  const orderIds = [...new Set(readyRows.map((row) => String(row.orderId || '').trim()).filter(Boolean))];
  const batchKind = policy.cadence === 'monday_clear'
    ? 'monday_clear'
    : (stageGroup === 'waiting_t2' ? 'tplus_waiting' : 'tplus_ready');

  const sample = readyRows[0];
  const organizerType = sample.organizerType || (bucket === BUCKET_MINDSPARK ? 'fest' : 'run_club');
  const organizerId = sample.organizerId
    || (bucket === BUCKET_MINDSPARK ? MINDSPARK_FEST_ID : sample.entityId || bucket);

  let doc = await OrganizerPayout.findOne({
    organizerType,
    organizerId,
    eventId,
    bucket,
  });
  const before = doc ? doc.toObject() : null;
  if (!doc) {
    doc = new OrganizerPayout({
      organizerType,
      organizerId,
      organizerName: sample.organizerName || policy.label,
      bucket,
      eventId,
      eventName,
      amount,
      status: 'paid',
      batchKind,
      clearMondayYmd: clearYmd || '',
      orderIds,
      paidAt: new Date(),
      note,
      createdBy: actor,
    });
  } else {
    doc.organizerName = sample.organizerName || doc.organizerName || policy.label;
    doc.eventName = eventName;
    doc.amount = amount;
    doc.status = 'paid';
    doc.batchKind = batchKind;
    doc.clearMondayYmd = clearYmd || doc.clearMondayYmd || '';
    doc.orderIds = orderIds.length ? orderIds : (doc.orderIds || []);
    doc.paidAt = doc.paidAt || new Date();
    doc.note = note;
    doc.createdBy = actor;
  }
  await doc.save();

  await PaymentAuditLog.create({
    action: 'event_batch_paid',
    actor,
    payoutId: String(doc._id),
    source: 'admin',
    before,
    after: {
      ...serializePayout(doc),
      clearMondayYmd: clearYmd,
      paymentCount: readyRows.length,
      orderIds: readyRows.map((row) => row.orderId).filter(Boolean),
    },
  });

  return {
    payout: serializePayout(doc),
    bucket,
    clearMondayYmd: clearYmd,
    paymentCount: readyRows.length,
    amount,
    alreadyHadPaidLedger: Boolean(before && before.status === 'paid'),
  };
}

async function markMindsparkMondayClearPaid(opts = {}) {
  return markEventBatchPaid({
    ...opts,
    bucket: BUCKET_MINDSPARK,
    stageGroup: 'ready',
  });
}

module.exports = {
  loadNormalizedRegistrations,
  buildLinkedPaymentRows,
  getPaymentSummary,
  getPaymentHistory,
  exportPaymentCsv,
  markEventBatchPaid,
  markMindsparkMondayClearPaid,
  serializePayout,
  flattenEventShowRegs,
  refundTotalFor,
};
