const Registration = require('../model/registration_model');
const Competition = require('../model/competition_model');

const SLOTS_FULL_MESSAGE = 'This competition is full. No slots remaining.';
const REGISTRATION_CLOSED_MESSAGE = 'Registration is closed for this competition.';
const COMPETITION_NOT_FOUND_MESSAGE = 'Competition not found.';

function resolveAllottedSlots(competition = {}) {
  const slots = Math.max(0, Math.floor(Number(competition.slotsAllotted) || 0));
  if (slots > 0) return slots;
  return Math.max(
    0,
    Math.floor(Number(
      competition.registration?.maxRegistrations
      ?? competition.registration?.settings?.maxRegistrations
      ?? 0,
    )),
  );
}

function slotState({ allotted = 0, filled = 0 } = {}) {
  const cap = Math.max(0, Math.floor(Number(allotted) || 0));
  const used = Math.max(0, Math.floor(Number(filled) || 0));
  return {
    limited: cap > 0,
    allotted: cap,
    filled: used,
    left: cap > 0 ? Math.max(0, cap - used) : null,
    full: cap > 0 && used >= cap,
  };
}

function occupiedSlotFilter(competitionId) {
  return {
    competitionId,
    $or: [
      { status: 'approved' },
      { status: 'pending', paymentStatus: 'paid' },
    ],
  };
}

async function countOccupiedCompetitionSlots(competitionId) {
  if (!competitionId) return 0;
  const CompetitionSlotReservation = require('../model/competition_slot_reservation_model');
  const [registrations, reservations] = await Promise.all([
    Registration.countDocuments(occupiedSlotFilter(competitionId)),
    CompetitionSlotReservation.countDocuments({ competitionId, expiresAt: { $gt: new Date() } }),
  ]);
  return registrations + reservations;
}

/** One aggregation pair for many competitions — avoids N+1 on MindSpark bundle checkout. */
async function countOccupiedSlotsByCompetitionIds(competitionIds) {
  const ids = [...new Set((competitionIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const CompetitionSlotReservation = require('../model/competition_slot_reservation_model');
  const [regs, reservations] = await Promise.all([
    Registration.aggregate([
      {
        $match: {
          competitionId: { $in: ids },
          $or: [
            { status: 'approved' },
            { status: 'pending', paymentStatus: 'paid' },
          ],
        },
      },
      { $group: { _id: '$competitionId', n: { $sum: 1 } } },
    ]),
    CompetitionSlotReservation.aggregate([
      { $match: { competitionId: { $in: ids }, expiresAt: { $gt: new Date() } } },
      { $group: { _id: '$competitionId', n: { $sum: 1 } } },
    ]),
  ]);
  const map = new Map(ids.map((id) => [String(id), 0]));
  for (const row of regs) {
    map.set(String(row._id), (map.get(String(row._id)) || 0) + (row.n || 0));
  }
  for (const row of reservations) {
    map.set(String(row._id), (map.get(String(row._id)) || 0) + (row.n || 0));
  }
  return map;
}

async function loadCompetitionForSlots(competitionOrId) {
  if (competitionOrId && typeof competitionOrId === 'object' && competitionOrId._id) {
    return competitionOrId;
  }
  if (!competitionOrId) return null;
  return Competition.findById(competitionOrId)
    .select('slotsAllotted registration.maxRegistrations registration.settings.maxRegistrations registration.status name')
    .lean();
}

async function getCompetitionSlotState(competitionOrId) {
  const competition = await loadCompetitionForSlots(competitionOrId);
  if (!competition) {
    return slotState({ allotted: 0, filled: 0 });
  }
  const allotted = resolveAllottedSlots(competition);
  const filled = allotted > 0
    ? await countOccupiedCompetitionSlots(competition._id)
    : 0;
  return slotState({ allotted, filled });
}

function slotsFullError() {
  const err = new Error(SLOTS_FULL_MESSAGE);
  err.status = 409;
  err.code = 'SLOTS_FULL';
  return err;
}

/**
 * Occupied seats = approved rows (and paid-pending). 0 allotted = unlimited.
 * Call before creating a new unpaid registration or a new payment order.
 */
async function assertCompetitionHasOpenSlot(competitionOrId) {
  const state = await getCompetitionSlotState(competitionOrId);
  if (state.full) throw slotsFullError();
  return state;
}

function isCompetitionRegistrationClosed(competition = {}) {
  const status = String(competition?.registration?.status || '').trim().toLowerCase();
  return status === 'registration_closed' || status === 'closed';
}

function registrationClosedError() {
  const err = new Error(REGISTRATION_CLOSED_MESSAGE);
  err.status = 409;
  err.code = 'REGISTRATION_CLOSED';
  return err;
}

function competitionNotFoundError() {
  const err = new Error(COMPETITION_NOT_FOUND_MESSAGE);
  err.status = 404;
  err.code = 'COMPETITION_NOT_FOUND';
  return err;
}

/**
 * New unpaid entries / checkout orders. Paid in-flight fulfillment should skip this.
 */
async function assertCompetitionAcceptsRegistration(competitionOrId) {
  const competition = await loadCompetitionForSlots(competitionOrId);
  if (!competition) {
    throw competitionNotFoundError();
  }
  if (isCompetitionRegistrationClosed(competition)) {
    throw registrationClosedError();
  }
  return assertCompetitionHasOpenSlot(competition);
}

/** Batch open/closed + slot checks for already-loaded competition docs. */
async function assertCompetitionsAcceptRegistration(competitions) {
  const list = (competitions || []).filter(Boolean);
  for (const competition of list) {
    if (!competition?._id) throw competitionNotFoundError();
    if (isCompetitionRegistrationClosed(competition)) throw registrationClosedError();
  }
  const limited = list.filter((c) => resolveAllottedSlots(c) > 0);
  if (!limited.length) return;
  const filledMap = await countOccupiedSlotsByCompetitionIds(limited.map((c) => c._id));
  for (const competition of limited) {
    const allotted = resolveAllottedSlots(competition);
    const filled = filledMap.get(String(competition._id)) || 0;
    if (slotState({ allotted, filled }).full) throw slotsFullError();
  }
}

module.exports = {
  SLOTS_FULL_MESSAGE,
  REGISTRATION_CLOSED_MESSAGE,
  COMPETITION_NOT_FOUND_MESSAGE,
  resolveAllottedSlots,
  slotState,
  occupiedSlotFilter,
  countOccupiedCompetitionSlots,
  countOccupiedSlotsByCompetitionIds,
  getCompetitionSlotState,
  assertCompetitionHasOpenSlot,
  isCompetitionRegistrationClosed,
  assertCompetitionAcceptsRegistration,
  assertCompetitionsAcceptRegistration,
};
