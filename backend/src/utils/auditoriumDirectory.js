'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { getJwtSecret } = require('../config/jwtSecret');

const DIRECTORY_YEARS = new Set(['first_year', 'second_year', 'third_year', 'fourth_year']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeDirectoryEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : '';
}

function directoryEmailHash(email) {
  return crypto.createHmac('sha256', getJwtSecret()).update(normalizeDirectoryEmail(email)).digest('hex');
}

function otpCodeHash(challengeId, emailHash, code) {
  return crypto.createHmac('sha256', getJwtSecret())
    .update(`${challengeId}|${emailHash}|${String(code || '').trim()}`)
    .digest('hex');
}

function signEligibilityToken(payload) {
  return jwt.sign({ ...payload, purpose: 'auditorium-directory' }, getJwtSecret(), { expiresIn: '20m' });
}

function verifyEligibilityToken(token) {
  const decoded = jwt.verify(String(token || ''), getJwtSecret());
  if (decoded.purpose !== 'auditorium-directory') throw new Error('Invalid eligibility token');
  return decoded;
}

async function extractDirectoryEmails(buffer, filename = '') {
  const workbook = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer);
  }
  const emails = new Set();
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const raw = cell?.value?.text || cell?.value?.result || cell?.value;
        const email = normalizeDirectoryEmail(raw);
        if (email) emails.add(email);
      });
    });
  });
  return [...emails];
}

module.exports = {
  DIRECTORY_YEARS,
  normalizeDirectoryEmail,
  directoryEmailHash,
  otpCodeHash,
  signEligibilityToken,
  verifyEligibilityToken,
  extractDirectoryEmails,
};
