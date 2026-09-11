'use strict';

/**
 * Non-working bank days for Cashfree T+N settlement estimates.
 * Cashfree docs: business days exclude weekends and bank holidays.
 * Holiday list is Maharashtra / common India dates (FIMMDA-style), 2025–2027.
 * Update yearly from RBI / FIMMDA if needed.
 */
const INDIA_BANK_HOLIDAYS = new Set([
  // 2025
  '2025-01-26', // Republic Day
  '2025-02-26', // Maha Shivaratri
  '2025-03-14', // Holi
  '2025-03-31', // Id-ul-Fitr
  '2025-04-10', // Mahavir Jayanti
  '2025-04-14', // Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-05-12', // Buddha Purnima
  '2025-06-07', // Bakri Id
  '2025-07-06', // Muharram
  '2025-08-15', // Independence Day
  '2025-08-16', // Parsi New Year
  '2025-08-27', // Ganesh Chaturthi
  '2025-09-05', // Id-e-Milad
  '2025-10-02', // Gandhi Jayanti
  '2025-10-21', // Dussehra
  '2025-11-01', // Diwali
  '2025-11-05', // Diwali Bali Pratipada
  '2025-11-15', // Guru Nanak Jayanti
  '2025-12-25', // Christmas

  // 2026 (FIMMDA Maharashtra + common national)
  '2026-01-26', // Republic Day
  '2026-02-19', // Shivaji Jayanti
  '2026-03-03', // Holi
  '2026-03-19', // Gudhi Padwa
  '2026-03-21', // Ramzan Id
  '2026-03-26', // Ram Navami
  '2026-03-31', // Mahavir Jayanti
  '2026-04-03', // Good Friday
  '2026-04-14', // Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-05-28', // Bakri Id
  '2026-06-26', // Muharram
  '2026-08-15', // Independence Day
  '2026-08-26', // Id-e-Milad
  '2026-09-14', // Ganesh Chaturthi
  '2026-10-02', // Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-10', // Diwali Bali Pratipada
  '2026-11-24', // Guru Nanak Jayanti
  '2026-12-25', // Christmas

  // 2027 (core national — extend as needed)
  '2027-01-26',
  '2027-08-15',
  '2027-10-02',
  '2027-12-25',
]);

function isIndiaBankHoliday(ymd) {
  return INDIA_BANK_HOLIDAYS.has(String(ymd || ''));
}

module.exports = {
  INDIA_BANK_HOLIDAYS,
  isIndiaBankHoliday,
};
