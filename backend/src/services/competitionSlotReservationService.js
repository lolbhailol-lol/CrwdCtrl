const crypto = require('crypto');
const CompetitionSlotReservation = require('../model/competition_slot_reservation_model');
const {
  getCompetitionSlotState,
  assertCompetitionAcceptsRegistration,
} = require('../utils/competitionSlots');

const RESERVATION_MS = 30 * 60 * 1000;

async function acquireCompetitionSlot({ competition, userId }) {
  const state = await assertCompetitionAcceptsRegistration(competition);
  if (!state.limited) return null;
  const competitionId = competition._id || competition;
  await CompetitionSlotReservation.deleteMany({ competitionId, expiresAt: { $lte: new Date() } });
  const refreshed = await getCompetitionSlotState(competition);
  for (let slot = refreshed.filled + 1; slot <= refreshed.allotted; slot += 1) {
    try {
      return await CompetitionSlotReservation.create({
        competitionId,
        slot,
        token: crypto.randomBytes(18).toString('hex'),
        userId: userId || null,
        expiresAt: new Date(Date.now() + RESERVATION_MS),
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  const error = new Error('This competition is full. No slots remaining.');
  error.status = 409;
  error.code = 'SLOTS_FULL';
  throw error;
}

async function attachReservationToOrder(token, orderId) {
  if (!token) return;
  await CompetitionSlotReservation.updateOne({ token }, { $set: { orderId } });
}

async function releaseCompetitionSlot(token) {
  if (!token) return;
  await CompetitionSlotReservation.deleteOne({ token });
}

module.exports = {
  RESERVATION_MS,
  acquireCompetitionSlot,
  attachReservationToOrder,
  releaseCompetitionSlot,
};
