/**
 * Permanent Registration Number (10 digits), mirrors backend/src/utils/prnCode.js:
 * YY admission year + 1 degree + entry type + 0 common code + BB branch + SSS serial.
 */

export const PRN_BRANCHES = {
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

export const PRN_ENTRY_TYPES = {
    1: 'First Year after 12th',
    2: 'Direct Second Year after Diploma',
};

const YEAR_CATEGORY_IDS = ['first_year', 'second_year', 'third_year', 'fourth_year'];
const YEAR_LABELS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];

export const PRN_CATEGORY_IDS = new Set(YEAR_CATEGORY_IDS);

export function cleanPrnInput(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function academicStartYear(now = new Date()) {
    return now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
}

export function parsePrn(raw, now = new Date()) {
    const prn = String(raw || '').replace(/\s+/g, '');
    const fail = (error) => ({ valid: false, prn, error });
    if (!/^\d{10}$/.test(prn)) return fail('PRN must be exactly 10 digits');
    const pair = prn.slice(2, 4);
    const entryType = pair === '11' ? 1 : (pair === '21' || pair === '12' ? 2 : 0);
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
        studyYearLabel: YEAR_LABELS[studyYear - 1] || `Year ${studyYear}`,
        categoryId: YEAR_CATEGORY_IDS[studyYear - 1] || '',
    };
}
