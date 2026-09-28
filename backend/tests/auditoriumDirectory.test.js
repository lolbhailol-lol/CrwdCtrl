const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'auditorium-directory-test-secret-with-enough-length';

const {
  normalizeDirectoryEmail,
  directoryEmailHash,
  signEligibilityToken,
  verifyEligibilityToken,
  extractDirectoryEmails,
} = require('../src/utils/auditoriumDirectory');

test('directory emails normalize and hash without retaining plaintext', () => {
  assert.equal(normalizeDirectoryEmail(' Student@COEP.AC.IN '), 'student@coep.ac.in');
  assert.equal(normalizeDirectoryEmail('not-an-email'), '');
  assert.equal(directoryEmailHash('Student@COEP.AC.IN'), directoryEmailHash(' student@coep.ac.in '));
  assert.doesNotMatch(directoryEmailHash('student@coep.ac.in'), /student|coep/i);
});

test('eligibility token retains the bound user, competition and year', () => {
  const token = signEligibilityToken({
    userId: 'user-1', competitionId: 'competition-1', email: 'student@coep.ac.in',
    emailHash: directoryEmailHash('student@coep.ac.in'), categoryId: 'second_year',
  });
  const decoded = verifyEligibilityToken(token);
  assert.equal(decoded.purpose, 'auditorium-directory');
  assert.equal(decoded.userId, 'user-1');
  assert.equal(decoded.competitionId, 'competition-1');
  assert.equal(decoded.categoryId, 'second_year');
});

test('CSV directory parser finds unique valid emails in any column', async () => {
  const csv = Buffer.from('Name,College Email\nA,ONE@COEP.AC.IN\nB,two@coep.ac.in\nC,invalid\nD,one@coep.ac.in\n');
  const emails = await extractDirectoryEmails(csv, 'first-year.csv');
  assert.deepEqual(emails.sort(), ['one@coep.ac.in', 'two@coep.ac.in']);
});

test('XLSX directory parser finds emails across worksheets', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Students').addRows([
    ['MIS', 'Email'], ['112233', 'third.year@coep.ac.in'], ['445566', 'fourth.year@coep.ac.in'],
  ]);
  workbook.addWorksheet('Extra').addRow(['duplicate', 'THIRD.YEAR@COEP.AC.IN']);
  const buffer = await workbook.xlsx.writeBuffer();
  const emails = await extractDirectoryEmails(Buffer.from(buffer), 'students.xlsx');
  assert.deepEqual(emails.sort(), ['fourth.year@coep.ac.in', 'third.year@coep.ac.in']);
});
