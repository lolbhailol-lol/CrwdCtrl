'use strict';

const Registration = require('../model/registration_model');
const AuditoriumSeatCounter = require('../model/auditorium_seat_counter_model');
const { sanitizeCategories } = require('../modules/fest/plugins/mindsparkAuditorium');

function occupiedFilter(competitionId, categoryId) {
  const filter = {
    competitionId,
    status: { $in: ['approved', 'pending'] },
    $or: [
      { paymentStatus: 'free' },
      { paymentStatus: 'paid' },
    ],
  };
  if (categoryId) {
    filter['responses.auditorium_category_id'] = String(categoryId);
  }
  return filter;
}

async function countCategoryFilled(competitionId, categoryId) {
  if (!competitionId || !categoryId) return 0;
  return Registration.countDocuments(occupiedFilter(competitionId, categoryId));
}

async function countTotalFilled(competitionId) {
  if (!competitionId) return 0;
  return Registration.countDocuments(occupiedFilter(competitionId));
}

async function buildCategoryStats(competition) {
  const categories = sanitizeCategories(competition?.auditorium?.categories || []);
  const competitionId = competition._id || competition;
  const stats = [];
  for (const cat of categories) {
    const filled = await countCategoryFilled(competitionId, cat.id);
    const seats = Number(cat.seats) || 0;
    stats.push({
      ...cat,
      filled,
      left: seats > 0 ? Math.max(0, seats - filled) : null,
      full: seats > 0 && filled >= seats,
    });
  }
  const totalSeats = categories.reduce((n, c) => n + (Number(c.seats) || 0), 0);
  const totalFilled = await countTotalFilled(competitionId);
  return {
    categories: stats,
    totalSeats,
    totalFilled,
    totalLeft: totalSeats > 0 ? Math.max(0, totalSeats - totalFilled) : null,
  };
}

/**
 * Atomically claim one seat in a category.
 * Counter may sit above live count while a create is in-flight — never sync down
 * during claim. Sync up when live registrations outpaced the counter.
 * Callers must releaseCategorySeat if Registration.create fails.
 */
async function claimCategorySeat(competitionId, categoryId, seats) {
  const cap = Math.max(0, Math.floor(Number(seats) || 0));
  if (!competitionId || !categoryId || cap <= 0) {
    const err = new Error('Invalid category seats');
    err.status = 400;
    err.code = 'INVALID_CATEGORY';
    throw err;
  }

  const fullError = () => {
    const err = new Error('No seats left in this category.');
    err.status = 409;
    err.code = 'CATEGORY_FULL';
    return err;
  };

  await AuditoriumSeatCounter.updateOne(
    { competitionId, categoryId },
    { $setOnInsert: { filled: 0 } },
    { upsert: true },
  );

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const liveFilled = await countCategoryFilled(competitionId, categoryId);
    if (liveFilled >= cap) {
      await AuditoriumSeatCounter.updateOne(
        { competitionId, categoryId },
        { $max: { filled: liveFilled } },
      );
      throw fullError();
    }

    const counter = await AuditoriumSeatCounter.findOne({ competitionId, categoryId })
      .select('filled')
      .lean();
    const counterFilled = Math.max(0, Number(counter?.filled) || 0);

    // Counter behind live regs (e.g. releases missed) — catch up before claim.
    // Never sync down: counter > live means an in-flight claim still owns a seat.
    if (counterFilled < liveFilled) {
      await AuditoriumSeatCounter.updateOne(
        { competitionId, categoryId, filled: counterFilled },
        { $set: { filled: liveFilled } },
      );
      continue;
    }

    if (counterFilled >= cap) {
      throw fullError();
    }

    const claimed = await AuditoriumSeatCounter.findOneAndUpdate(
      { competitionId, categoryId, filled: { $lt: cap } },
      { $inc: { filled: 1 } },
      { new: true },
    );
    if (claimed) return claimed;
  }

  throw fullError();
}

async function releaseCategorySeat(competitionId, categoryId) {
  if (!competitionId || !categoryId) return;
  await AuditoriumSeatCounter.findOneAndUpdate(
    { competitionId, categoryId, filled: { $gt: 0 } },
    { $inc: { filled: -1 } },
  );
}

async function syncCategoryCounter(competitionId, categoryId) {
  const filled = await countCategoryFilled(competitionId, categoryId);
  await AuditoriumSeatCounter.findOneAndUpdate(
    { competitionId, categoryId },
    { $set: { filled } },
    { upsert: true },
  );
  return filled;
}

module.exports = {
  countCategoryFilled,
  countTotalFilled,
  buildCategoryStats,
  claimCategorySeat,
  releaseCategorySeat,
  syncCategoryCounter,
  occupiedFilter,
};
