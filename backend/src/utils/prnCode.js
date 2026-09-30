'use strict';

/**
 * Permanent Registration Number (10 digits):
 * YY (admission year) + 1 (degree: Engineering) + entry (1 = after 12th, 2 = direct second year)
 * + 0 (common code) + BB (branch 01–09) + SSS (serial 001–999).
 */

const PRN_BRANCHES = {
  '01': 'Computer Engineering',
  '02': 'Electronics and Telecommunication Engineering',
  '03': 'Mechanical Engineering',
  '04': 'Civil Engineering',
  '05': 'Electrical Engineering',
  '06': 'Computer Science and Engineering (Data Science)',
  '07': 'Artificial Intelligence and Machine Learning',
  '08': 'Artificial Intelligence and Data Science',
  '09': 'Information Technology',
};

const PRN_ENTRY_TYPES = {
  1: 'First Year after 12th',
  2: 'Direct Second Year after Diploma',
};

const YEAR_CATEGORY_IDS = ['first_year', 'second_year', 'third_year', 'fourth_year'];
const PRN_CATEGORY_IDS = new Set(YEAR_CATEGORY_IDS);

function normalizePrn(raw) {
  return String(raw || '').replace(/\s+/g, '');
}

/** The spec table and its own example disagree on digit order, so 21 and 12 both mean direct second year. */
function entryTypeFromDigits(pair) {
  if (pair === '11') return 1;
  if (pair === '21' || pair === '12') return 2;
  return 0;
}

/** Academic years start in June: Oct 2026 → 2026, Mar 2027 → 2026. */
function academicStartYear(now = new Date()) {
  return now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * @returns {{ valid: true, prn, admissionYear, entryType, entryLabel, branchCode, branchName, serial, studyYear, categoryId }
 *   | { valid: false, prn, error }}
 */
function parsePrn(raw, now = new Date()) {
  const prn = normalizePrn(raw);
  const fail = (error) => ({ valid: false, prn, error });
  if (!/^\d{10}$/.test(prn)) return fail('PRN must be exactly 10 digits');
  const entryType = entryTypeFromDigits(prn.slice(2, 4));
  if (!entryType) return fail('Digits 3–4 must be 11 (first year) or 21 (direct second year)');
  if (prn[4] !== '0') return fail('5th digit (common code) must be 0');
  const branchCode = prn.slice(5, 7);
  if (!PRN_BRANCHES[branchCode]) return fail('Digits 6–7 must be a branch code from 01 to 09');
  const serial = prn.slice(7);
  if (serial === '000') return fail('Serial number (last 3 digits) must be 001–999');

  const admissionYear = 2000 + Number(prn.slice(0, 2));
  const studyYear = academicStartYear(now) - admissionYear + (entryType === 2 ? 2 : 1);
  if (admissionYear > academicStartYear(now)) return fail('Admission year in the PRN is in the future');

  return {
    valid: true,
    prn,
    admissionYear,
    entryType,
    entryLabel: PRN_ENTRY_TYPES[entryType],
    branchCode,
    branchName: PRN_BRANCHES[branchCode],
    serial,
    studyYear,
    categoryId: YEAR_CATEGORY_IDS[studyYear - 1] || '',
  };
}

module.exports = {
  PRN_BRANCHES,
  PRN_ENTRY_TYPES,
  PRN_CATEGORY_IDS,
  normalizePrn,
  parsePrn,
};
