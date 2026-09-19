'use strict';

const { MINDSPARK_FEST_ID } = require('./mindspark');

const AUDITORIUM_COMPETITION_NAME = 'MindSpark Auditorium';
const AUDITORIUM_MODULE = 'AUDITORIUM';

/** Seed seat plan — editable later by organizers. Total 910. */
const DEFAULT_AUDITORIUM_CATEGORIES = [
  { id: 'faculty_sponsors', label: 'Faculty & Sponsors', seats: 30, channel: 'invite' },
  { id: 'ex_core', label: 'Ex-Core Team', seats: 30, channel: 'invite' },
  { id: 'core_families', label: 'Families of Core Team', seats: 20, channel: 'invite' },
  { id: 'cultural_club', label: 'Cultural Club Team', seats: 60, channel: 'invite' },
  { id: 'first_year', label: 'First Year', seats: 170, channel: 'public' },
  { id: 'second_year', label: 'Second Year', seats: 150, channel: 'public' },
  { id: 'third_year', label: 'Third Year', seats: 155, channel: 'public' },
  { id: 'fourth_year', label: 'Fourth Year', seats: 150, channel: 'public' },
  { id: 'mtech', label: 'M.Tech', seats: 120, channel: 'public' },
  { id: 'mba', label: 'MBA', seats: 20, channel: 'public' },
  { id: 'buffer', label: 'Buffer', seats: 5, channel: 'desk' },
];

const CHANNELS = new Set(['public', 'invite', 'desk']);

function sanitizeCategory(raw = {}) {
  const id = String(raw.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .slice(0, 64);
  if (!id) return null;
  const channel = CHANNELS.has(String(raw.channel || '').toLowerCase())
    ? String(raw.channel).toLowerCase()
    : 'public';
  const seats = Math.max(0, Math.floor(Number(raw.seats) || 0));
  const label = String(raw.label || id).trim().slice(0, 120) || id;
  return { id, label, seats, channel };
}

function sanitizeCategories(list) {
  if (!Array.isArray(list) || !list.length) {
    return DEFAULT_AUDITORIUM_CATEGORIES.map((c) => ({ ...c }));
  }
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const cat = sanitizeCategory(item);
    if (!cat || seen.has(cat.id)) continue;
    seen.add(cat.id);
    out.push(cat);
  }
  return out.length ? out : DEFAULT_AUDITORIUM_CATEGORIES.map((c) => ({ ...c }));
}

function sumSeats(categories) {
  return sanitizeCategories(categories).reduce((n, c) => n + (Number(c.seats) || 0), 0);
}

function defaultAuditoriumConfig() {
  return {
    enabled: true,
    showPublicTicketBox: true,
    registrationOpen: true,
    requireTicketPhoto: true,
    requireIdAtGate: true,
    enforceMisYear: true,
    categories: DEFAULT_AUDITORIUM_CATEGORIES.map((c) => ({ ...c })),
  };
}

function normalizeAuditoriumConfig(raw = {}) {
  const categories = sanitizeCategories(raw.categories);
  return {
    enabled: raw.enabled !== false,
    showPublicTicketBox: Boolean(raw.showPublicTicketBox),
    registrationOpen: Boolean(raw.registrationOpen),
    requireTicketPhoto: raw.requireTicketPhoto !== false,
    requireIdAtGate: raw.requireIdAtGate !== false,
    enforceMisYear: raw.enforceMisYear !== false,
    categories,
  };
}

/** Academic year start (July-based). Sep 2026 → 2026. */
function currentAcademicStartYear(now = new Date()) {
  const y = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan
  return month < 6 ? y - 1 : y;
}

/**
 * Infer public year category from MIS batch digits (e.g. leading 25 → second year in AY 2026-27).
 * Returns null if unknown / not a year seat (M.Tech, MBA skipped by caller).
 */
function inferYearCategoryFromMis(mis, now = new Date()) {
  const s = String(mis || '').replace(/\s+/g, '');
  if (!s) return null;
  let batchStr = null;
  const lead = s.match(/^(\d{2})/);
  if (lead && Number(lead[1]) >= 20 && Number(lead[1]) <= 29) {
    batchStr = lead[1];
  } else {
    const found = s.match(/2[0-9]/);
    if (found) batchStr = found[0];
  }
  if (!batchStr) return null;

  const envMap = String(process.env.AUDITORIUM_MIS_BATCH_MAP || '').trim();
  if (envMap) {
    try {
      const map = JSON.parse(envMap);
      if (map && typeof map === 'object' && map[batchStr]) {
        return String(map[batchStr]);
      }
    } catch {
      /* ignore bad env */
    }
  }

  const batchYear = 2000 + Number(batchStr);
  const start = currentAcademicStartYear(now);
  const yearInCollege = start - batchYear + 1;
  if (yearInCollege === 1) return 'first_year';
  if (yearInCollege === 2) return 'second_year';
  if (yearInCollege === 3) return 'third_year';
  if (yearInCollege >= 4 && yearInCollege <= 6) return 'fourth_year';
  return null;
}

const YEAR_CATEGORY_IDS = new Set(['first_year', 'second_year', 'third_year', 'fourth_year']);

function cloudinaryPathKey(url) {
  try {
    const u = new URL(String(url || ''));
    return u.pathname.replace(/\/v\d+\//, '/').replace(/\/upload\/[^/]+\//, '/upload/').toLowerCase();
  } catch {
    return String(url || '').split('?')[0].toLowerCase();
  }
}

module.exports = {
  MINDSPARK_FEST_ID,
  AUDITORIUM_COMPETITION_NAME,
  AUDITORIUM_MODULE,
  DEFAULT_AUDITORIUM_CATEGORIES,
  YEAR_CATEGORY_IDS,
  sanitizeCategories,
  sumSeats,
  defaultAuditoriumConfig,
  normalizeAuditoriumConfig,
  inferYearCategoryFromMis,
  currentAcademicStartYear,
  cloudinaryPathKey,
};
