#!/usr/bin/env node
/*
 * Re-render every CrwdCtrl-designed poster with layout-aware designs (catalog-posters-v2).
 * The existing file is overwritten with the wide layout, so URLs already stored keep
 * working. Fests and listings also get per-slot variants (portrait, square, hero, ...).
 * Run from backend/:
 *   node scripts/regenerate-designed-posters.js render          # writes image files
 *   node scripts/regenerate-designed-posters.js apply           # dry run of slot updates
 *   node scripts/regenerate-designed-posters.js apply --write   # writes after a MongoDB backup
 */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { renderPoster, SLOT_SIZES } = require('./catalog-posters-v2');

const API = 'https://crwdctrl-production-9c58.up.railway.app/api/';
const FRONTEND_PUBLIC = path.resolve(__dirname, '../../frontend/public');
const FEST_MANIFEST = path.resolve(__dirname, 'data/fest-catalog-images.json');
const LISTING_MANIFEST = path.resolve(__dirname, 'data/listing-images.json');
const VARIANTS_PATH = path.resolve(__dirname, 'data/designed-poster-variants.json');
const VARIANT_SLOTS = ['portrait', 'square', 'hero', 'landscape', 'video', 'page'];

const fmtDate = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};
const localPath = (url) => path.join(FRONTEND_PUBLIC, new URL(url).pathname);
const variantUrl = (url, slot) => url.replace(/\.jpg$/, `-${slot}.jpg`);

function listingTopic(kind, name) {
  const raw = String(name).toLowerCase();
  if (kind === 'event-show') {
    if (/kart|drag|motor|race/.test(raw)) return 'sports';
    if (/garba|dandiya|raas/.test(raw)) return 'dance';
    if (/magnificent|miss|fashion/.test(raw)) return 'fashion';
    return 'music';
  }
  if (/resin|workshop|paint|art/.test(raw)) return 'art';
  if (/pickle|tennis/.test(raw)) return 'tennis';
  if (/mafia|games/.test(raw)) return 'quiz';
  if (/music|rave/.test(raw)) return 'music';
  return 'running';
}

async function getJson(endpoint) {
  const response = await fetch(API + endpoint);
  if (!response.ok) throw new Error(`${endpoint} returned HTTP ${response.status}`);
  return response.json();
}

async function collectJobs() {
  const festPayload = await getJson('fests/all?limit=200');
  const fests = Array.isArray(festPayload) ? festPayload : festPayload.fests;
  const festById = new Map(fests.map((fest) => [String(fest._id), fest]));
  const compById = new Map(fests.flatMap((fest) => (fest.competitions || []).map((c) => [String(c._id), { c, fest }])));

  const jobs = [];
  const festManifest = JSON.parse(await fs.readFile(FEST_MANIFEST, 'utf8'));
  for (const entry of festManifest.entries.filter((e) => e.source?.license === 'crwdctrl-designed')) {
    if (entry.kind === 'fest') {
      const fest = festById.get(entry.id) || {};
      const dates = [fmtDate(fest.startDate), fmtDate(fest.endDate)].filter(Boolean);
      jobs.push({ kind: 'fest', id: entry.id, url: entry.url, topic: entry.topic, variants: true,
        title: entry.name, kicker: fest.festType ? `${fest.festType} fest` : 'College fest',
        lines: [fest.collegeName, [...new Set(dates)].join(' – ') || fest.location || fest.venue] });
    } else {
      const { c = {}, fest = {} } = compById.get(entry.id) || {};
      jobs.push({ kind: 'competition', id: entry.id, url: entry.url, topic: entry.topic, variants: false,
        title: entry.name, kicker: fest.festName || entry.fest || 'Competition',
        lines: [fest.collegeName, fmtDate(c.dateTime) || c.venue] });
    }
  }

  const listingSources = { sport: ['sports?limit=500', 'events'], 'run-club': ['run-clubs', 'clubs'], 'event-show': ['events', 'shows'] };
  const listingData = {};
  for (const [kind, [endpoint, key]] of Object.entries(listingSources)) {
    const payload = await getJson(endpoint);
    const home = await getJson('home');
    const homeKey = { sport: 'sports', 'run-club': 'runClubs', 'event-show': 'eventShows' }[kind];
    for (const item of [...(payload[key] || []), ...(home[homeKey] || [])]) listingData[`${kind}:${item._id || item.id}`] = item;
  }
  const listingManifest = JSON.parse(await fs.readFile(LISTING_MANIFEST, 'utf8'));
  for (const entry of listingManifest.entries.filter((e) => e.source === 'crwdctrl-designed')) {
    const item = listingData[`${entry.kind}:${entry.id}`] || {};
    const club = item.runClubId?.name || item.organizer || item.clubName;
    const kicker = entry.kind === 'run-club' ? 'Run club' : entry.kind === 'event-show' ? (item.eventType || 'Live event') : (club || 'Sports');
    const place = item.venue || item.city || item.basedIn || 'Pune';
    jobs.push({ kind: entry.kind, id: entry.id, url: entry.url, topic: listingTopic(entry.kind, entry.name), variants: true,
      title: entry.name, kicker, lines: [place, fmtDate(item.eventDate)] });
  }
  return jobs;
}

async function render() {
  const sharp = require(require.resolve('sharp', { paths: [path.resolve(__dirname, '../../frontend')] }));
  const jobs = await collectJobs();
  const variants = [];
  for (const job of jobs) {
    const base = { title: job.title, kicker: job.kicker, lines: job.lines, topic: job.topic };
    const [w, h] = SLOT_SIZES.wide;
    await sharp(Buffer.from(renderPoster({ ...base, width: w, height: h }))).jpeg({ quality: 86, mozjpeg: true }).toFile(localPath(job.url));
    if (!job.variants) continue;
    const urls = {};
    for (const slot of VARIANT_SLOTS) {
      const [sw, sh] = SLOT_SIZES[slot];
      const url = variantUrl(job.url, slot);
      await sharp(Buffer.from(renderPoster({ ...base, width: sw, height: sh }))).jpeg({ quality: 86, mozjpeg: true }).toFile(localPath(url));
      urls[slot] = url;
    }
    variants.push({ kind: job.kind, id: job.id, baseUrl: job.url, wide: job.url, ...urls });
  }
  await fs.writeFile(VARIANTS_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), variants }, null, 2)}\n`);
  console.log(JSON.stringify({ posters: jobs.length, withSlotVariants: variants.length }, null, 2));
}

async function apply(write) {
  const { variants } = JSON.parse(await fs.readFile(VARIANTS_PATH, 'utf8'));
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    const FestOrganizer = require('../src/model/fest_organizer_model');
    const { LISTING_RECOVERY_KINDS } = require('../src/utils/catalogImageRecoveryListings');
    const { CatalogImageRecoveryBackup } = require('../src/controllers/adminCatalogImageRecoveryController');
    const modelFor = (kind) => (kind === 'fest' ? FestOrganizer : LISTING_RECOVERY_KINDS[kind].model());
    const backup = { createdAt: new Date().toISOString(), source: 'regenerate-designed-posters', rows: [] };
    const plan = [];
    for (const v of variants) {
      const Model = modelFor(v.kind);
      const row = await Model.findById(v.id).select('coverImages').lean();
      if (!row) continue;
      const set = {};
      for (const slot of VARIANT_SLOTS) if (row.coverImages?.[slot] === v.baseUrl) set[`coverImages.${slot}`] = v[slot];
      if (!Object.keys(set).length) continue;
      backup.rows.push({ kind: v.kind, id: v.id, coverImages: row.coverImages });
      plan.push({ Model, id: v.id, set });
    }
    console.log(`${plan.length} fests/listings get per-shape poster variants (${plan.reduce((n, p) => n + Object.keys(p.set).length, 0)} slots).`);
    if (!write) { console.log('Dry run only. Add --write to apply.'); return; }
    if (!plan.length) return;
    const record = await CatalogImageRecoveryBackup.create({ backup });
    for (const item of plan) await item.Model.updateOne({ _id: item.id }, { $set: item.set });
    console.log(`Applied. Backup id: ${record._id}`);
  } finally {
    await mongoose.disconnect();
  }
}

const [command, arg] = process.argv.slice(2);
const run = command === 'render' ? render() : command === 'apply' ? apply(arg === '--write') : Promise.reject(new Error('Use: render | apply [--write]'));
run.catch((error) => { console.error(error.message || error); process.exitCode = 1; });
