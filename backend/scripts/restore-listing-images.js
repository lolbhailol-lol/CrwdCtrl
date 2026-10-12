#!/usr/bin/env node
/*
 * Replace dead Cloudinary images on sports events, run clubs and event shows
 * (treks are intentionally excluded). Real posters are used where we have them;
 * everything else gets a designed CrwdCtrl poster. Dead gallery entries are removed.
 * Run from backend/:
 *   node scripts/restore-listing-images.js prepare        # builds images + manifest
 *   node scripts/restore-listing-images.js apply          # dry run
 *   node scripts/restore-listing-images.js apply --write  # writes after a MongoDB backup
 *   node scripts/restore-listing-images.js rollback <backup-id>
 */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { posterSvg } = require('./fest-catalog-posters');

const API = 'https://crwdctrl-production-9c58.up.railway.app/api/';
const ASSET_DIR = path.resolve(__dirname, '../../frontend/public/images/listings');
const PUBLIC_BASE = 'https://www.crwdctrl.in/images/listings/';
const MANIFEST_PATH = path.resolve(__dirname, 'data/listing-images.json');
const DOWNLOADS = path.join(process.env.USERPROFILE || 'C:/Users/KARAN', 'Downloads');
const DEAD = /res\.cloudinary\.com\/dyonimhgb\//i;
const COVER_SLOTS = ['page', 'portrait', 'wide', 'hero', 'square', 'landscape', 'video'];

const SOURCES = [
  { path: 'sports?limit=500', key: 'events', kind: 'sport' },
  { path: 'run-clubs', key: 'clubs', kind: 'run-club' },
  { path: 'events', key: 'shows', kind: 'event-show' },
  { path: 'home', key: 'sports', kind: 'sport' },
  { path: 'home', key: 'runClubs', kind: 'run-club' },
  { path: 'home', key: 'eventShows', kind: 'event-show' },
];

// Real posters/photos supplied by organizers, matched by listing name. Only clear matches.
const REAL_IMAGES = {
  'jalsa 4.0': 'finalllllllllll-jalsa.4-0.png',
  'smash karts championship 2026': 'smash_karts_poster_v3.jpg',
  'elite octane dirt drag 2026': 'WhatsApp Image 2026-09-20 at 7.17.40 PM.jpeg',
  'pankhida raasgarba 2026': 'ChatGPT Image Sep 26, 2026 at 10_07_35 PM.png',
  'mr, miss & mrs magnificent maharashtra 2026': 'WhatsApp Image 2026-06-24 at 7.22.46 PM.jpeg',
  'ritrovo rush': 'WhatsApp Image 2026-09-22 at 7.59.55 PM.jpeg',
  'mafia files 02': 'WhatsApp Image 2026-09-08 at 10.37.02 PM.jpeg',
  verve: 'WhatsApp Image 2026-07-13 at 7.21.55 PM.jpeg',
  stridetribe: 'WhatsApp Image 2026-08-04 at 12.19.31 PM.jpeg',
  'delulu athletes': 'WhatsApp Image 2026-08-17 at 10.46.48 PM.jpeg',
};

const isDead = (url) => typeof url === 'string' && DEAD.test(url);
const isDeadOrEmpty = (url) => !url || isDead(url);
const slug = (value) => String(value || 'listing').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 48);
const hash = (value) => crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 8);
const nameOf = (item) => item.title || item.name || item.displayName || '';

function posterTopic(kind, name) {
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

async function readListings() {
  const cache = {};
  const items = new Map();
  for (const source of SOURCES) {
    if (!cache[source.path]) {
      const response = await fetch(API + source.path);
      if (!response.ok) throw new Error(`${source.path} returned HTTP ${response.status}`);
      cache[source.path] = await response.json();
    }
    for (const item of cache[source.path][source.key] || []) {
      const id = String(item._id || item.id || '');
      if (/^[a-f\d]{24}$/i.test(id) && DEAD.test(JSON.stringify(item))) items.set(`${source.kind}:${id}`, { kind: source.kind, id, item });
    }
  }
  return [...items.values()];
}

async function prepare() {
  const sharp = require(require.resolve('sharp', { paths: [path.resolve(__dirname, '../../frontend')] }));
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const entries = [];
  for (const { kind, id, item } of await readListings()) {
    const name = nameOf(item);
    const realFile = REAL_IMAGES[name.trim().toLowerCase()];
    const file = `${kind}-${slug(name)}-${hash(id)}.jpg`;
    if (realFile) {
      await sharp(path.join(DOWNLOADS, realFile)).rotate()
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(ASSET_DIR, file));
      entries.push({ kind, id, name, file, url: `${PUBLIC_BASE}${file}`, source: 'organizer-poster' });
    } else {
      const svg = await posterSvg({ title: name, subtitle: item.city || item.basedIn || item.venue || 'Pune', topic: posterTopic(kind, name) });
      await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(ASSET_DIR, file));
      entries.push({ kind, id, name, file, url: `${PUBLIC_BASE}${file}`, source: 'crwdctrl-designed' });
    }
  }
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`);
  console.log(JSON.stringify({ listings: entries.length, realPosters: entries.filter((e) => e.source === 'organizer-poster').length, designed: entries.filter((e) => e.source === 'crwdctrl-designed').length }, null, 2));
}

async function connect() {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set; nothing was changed');
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  return mongoose;
}

async function apply(write) {
  const { entries } = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  const mongoose = await connect();
  try {
    const { LISTING_RECOVERY_KINDS } = require('../src/utils/catalogImageRecoveryListings');
    const { CatalogImageRecoveryBackup } = require('../src/controllers/adminCatalogImageRecoveryController');
    const backup = { createdAt: new Date().toISOString(), source: 'restore-listing-images', listings: [] };
    const plan = [];
    for (const entry of entries) {
      const config = LISTING_RECOVERY_KINDS[entry.kind];
      const Model = config.model();
      const hasPath = (field) => Boolean(Model.schema.path(field));
      const coverFields = ['coverImage', ...config.coverFields].filter(hasPath);
      const arrays = config.arrays.filter(hasPath);
      const fields = [...coverFields, 'coverImages', ...arrays];
      const row = await Model.findById(entry.id).select(fields.join(' ')).lean();
      if (!row) continue;
      const set = {};
      for (const field of coverFields) if (isDeadOrEmpty(row[field])) set[field] = entry.url;
      for (const slot of COVER_SLOTS) if (isDead(row.coverImages?.[slot])) set[`coverImages.${slot}`] = entry.url;
      for (const field of arrays) {
        const current = Array.isArray(row[field]) ? row[field] : [];
        const kept = current.filter((url) => url && !isDead(url));
        if (kept.length !== current.length) set[field] = !kept.length && config.primaryArrays.includes(field) ? [entry.url] : kept;
      }
      if (!Object.keys(set).length) continue;
      backup.listings.push({ kind: entry.kind, id: entry.id, fields: Object.fromEntries(fields.map((field) => [field, row[field] ?? null])) });
      plan.push({ Model, id: entry.id, set, label: `${entry.kind}: ${entry.name}` });
    }
    for (const item of plan) console.log(`${item.label} -> ${Object.keys(item.set).join(', ')}`);
    console.log(`\n${plan.length} listings to update.`);
    if (!write) { console.log('Dry run only. Add --write to apply.'); return; }
    if (!plan.length) return;
    const record = await CatalogImageRecoveryBackup.create({ backup });
    for (const item of plan) await item.Model.updateOne({ _id: item.id }, { $set: item.set });
    console.log(`Applied. Backup id: ${record._id}\nUndo: node scripts/restore-listing-images.js rollback ${record._id}`);
  } finally {
    await mongoose.disconnect();
  }
}

async function rollback(id) {
  const mongoose = await connect();
  try {
    const { LISTING_RECOVERY_KINDS } = require('../src/utils/catalogImageRecoveryListings');
    const { CatalogImageRecoveryBackup } = require('../src/controllers/adminCatalogImageRecoveryController');
    const record = await CatalogImageRecoveryBackup.findById(id).lean();
    if (!record) throw new Error(`No backup found with id ${id}`);
    for (const row of record.backup.listings || []) await LISTING_RECOVERY_KINDS[row.kind].model().updateOne({ _id: row.id }, { $set: row.fields });
    console.log(`Restored ${record.backup.listings.length} listings.`);
  } finally {
    await mongoose.disconnect();
  }
}

const [command, arg] = process.argv.slice(2);
const run = command === 'prepare' ? prepare()
  : command === 'apply' ? apply(arg === '--write')
    : command === 'rollback' ? rollback(arg)
      : Promise.reject(new Error('Use: prepare | apply [--write] | rollback <backup-id>'));
run.catch((error) => { console.error(error.message || error); process.exitCode = 1; });
