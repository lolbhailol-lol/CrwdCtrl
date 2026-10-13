#!/usr/bin/env node
/*
 * Replace dead Cloudinary images on fests and competitions (Aarohan excluded; it
 * uses restore-aarohan-images.js). Real assets are used where we have them; the rest
 * get topic-matched CC0 photos from Openverse that must pass keyword and blocklist
 * checks. Dead gallery entries are removed rather than filled with stock photos.
 * Run from backend/:
 *   node scripts/restore-fest-catalog-images.js prepare          # downloads photos + manifest
 *   node scripts/restore-fest-catalog-images.js posters 2,5,7     # keep reviewed photos, poster the rest
 *   node scripts/restore-fest-catalog-images.js apply            # dry run
 *   node scripts/restore-fest-catalog-images.js apply --write    # writes, after a DB backup
 *   node scripts/restore-fest-catalog-images.js rollback <backup-id>
 */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const API_URL = 'https://api.crwdctrl.in/api/fests/all?limit=200';
const OPENVERSE_URL = 'https://api.openverse.org/v1/images/';
const ASSET_DIR = path.resolve(__dirname, '../../frontend/public/images/fests/catalog');
const PUBLIC_BASE = 'https://www.crwdctrl.in/images/fests/catalog/';
const MANIFEST_PATH = path.resolve(__dirname, 'data/fest-catalog-images.json');
const DEAD = /res\.cloudinary\.com\/dyonimhgb\//i;
const HEADERS = { 'user-agent': 'CrwdCtrlMediaRecovery/1.0 (https://www.crwdctrl.in; support@crwdctrl.com)' };
const COVER_SLOTS = ['page', 'portrait', 'wide', 'hero', 'square', 'landscape', 'video'];

const isDead = (url) => typeof url === 'string' && DEAD.test(url);
const isDeadOrEmpty = (url) => !url || isDead(url);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slug = (value) => String(value || 'image').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 48) || 'image';
const hash = (value) => crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 8);

// Local real assets keyed by fest name, copied into ASSET_DIR during prepare.
const REAL_FEST_COVERS = [
  { match: /^techfest$/i, source: path.resolve(__dirname, '../../preview/emails/assets/techfest-iit-bombay-campaign-hero.png'), file: 'techfest-iit-bombay-official.jpg' },
];

const BLOCKLIST = /rodent|mouse|\brat\b|squirrel|insect|spider|beetle|moth|fung|mushroom|bikini|swimsuit|lingerie|nude|naked|coin|lego|toy|figurine|statue|sculpture|\bmap\b|diagram|chart|cartoon|clip.?art|vector|icon|logo|screenshot|render|military|army|tank|weapon|\bgun|dog\b|\bcat\b|goose|duck|bird|vintage|antique|wedding|funeral|church|mosque|protest|police|prison|hospital|injur|blood/i;

// topic -> [Openverse query, regex the photo title/tags must match]
const TOPICS = {
  dance: ['dance performance stage', /danc/i],
  music: ['live music concert stage', /music|concert|band|sing|guitar|stage|gig/i],
  robotics: ['robot competition', /robot/i],
  football: ['football match', /football|soccer/i],
  cricket: ['cricket match', /cricket/i],
  basketball: ['basketball game', /basketball/i],
  badminton: ['badminton', /badminton|shuttle/i],
  volleyball: ['volleyball', /volleyball/i],
  kabaddi: ['kabaddi', /kabaddi/i],
  chess: ['chess game', /chess/i],
  tennis: ['table tennis', /tennis|ping.?pong/i],
  swimming: ['swimming race', /swim/i],
  archery: ['archery', /archery|archer|bow/i],
  squash: ['squash sport', /squash/i],
  running: ['running race marathon', /run|marathon|race|athlet/i],
  drone: ['drone flying', /drone|quadcopter|uav/i],
  gaming: ['esports gaming tournament', /esport|gaming|gamer|video.?game|console|lan.?party/i],
  coding: ['hackathon coding', /hackathon|coding|code|programm|developer|laptop|computer/i],
  quiz: ['quiz competition students', /quiz|trivia|students|competition/i],
  debate: ['debate public speaking', /debate|speech|speaker|podium|conference|panel/i],
  startup: ['startup pitch conference', /startup|pitch|business|entrepreneur|conference|meeting|panel/i],
  photography: ['photographer camera', /camera|photograph/i],
  film: ['film making camera', /film|cinema|movie|camera|video/i],
  fashion: ['fashion show runway', /fashion|runway|catwalk|model/i],
  theatre: ['theatre stage performance', /theat|drama|stage|actor|play|perform/i],
  poetry: ['poetry reading', /poet|poem|reading|book|writing|spoken/i],
  art: ['art painting students', /art|paint|draw|sketch|canvas|mural/i],
  technology: ['technology exhibition', /technolog|electronic|circuit|robot|engineer|expo|exhibit/i],
  festival: ['college festival crowd', /festival|concert|crowd|celebrat|stage|carnival/i],
  sports: ['sports competition', /sport|athlet|match|game|race|stadium/i],
  campus: ['university students event', /university|college|campus|students/i],
};
// Art photos legitimately contain paintings/drawings, so those words are only blocked elsewhere.
const ART_SAFE_BLOCKLIST = new RegExp(BLOCKLIST.source.replace('|cartoon|clip.?art|vector', '|clip.?art|vector'), 'i');

function competitionTopic(competition) {
  const raw = `${competition.competitionType || ''} ${competition.name || ''}`.toLowerCase();
  const rules = [
    [/mathlet|math/, 'quiz'], [/bull.?run|stock|trading|invest/, 'startup'],
    [/badminton|shuttle/, 'badminton'], [/basketball/, 'basketball'], [/squash/, 'squash'],
    [/robot|robo|bot.?wrestl|kart/, 'robotics'], [/football|soccer|futsal/, 'football'], [/cricket/, 'cricket'],
    [/volleyball/, 'volleyball'], [/kabaddi/, 'kabaddi'], [/archery/, 'archery'], [/swim/, 'swimming'],
    [/chess/, 'chess'], [/tennis|table|ping.?pong|velocity/, 'tennis'], [/athletic|race|run|marathon|sprint|relay/, 'running'],
    [/drone|uav/, 'drone'], [/gaming|esport|bgmi|valorant|free.?fire|fifa|video.?game|call of duty|codm/, 'gaming'],
    [/code|coding|programm|hack|cyber|software|web|app|ai\b|neural|ml\b/, 'coding'], [/quiz|trivia|rapid.?fire|mathlet/, 'quiz'],
    [/debate|public.?speaking|elocution|mun\b|parliament/, 'debate'], [/startup|business|marketing|finance|entrepreneur|case.?study|management|pitch|ideathon|bull|innovation|stock/, 'startup'],
    [/photo|pixel|camera/, 'photography'], [/film|cinema|movie|short.?film|reel/, 'film'],
    [/dance|nritya|step|footloose|classical|choreo/, 'dance'], [/sing|humming|vocal|music|band|antakshari|head.?bang|beats|concert|melody|rap/, 'music'],
    [/fashion|model|runway|glamour|ramp/, 'fashion'], [/theatre|theater|drama|acting|mime|skit|nukkad|street.?play/, 'theatre'],
    [/poetry|literary|story|writing|kalam|kavita|shayari/, 'poetry'], [/drawing|painting|sketch|logo|art|design|craft|mehendi|rangoli|tattoo/, 'art'],
    [/circuit|electronic|etch|revit|cad|bridge|structur|torque|mechan|civil|edifex|assembl/, 'technology'],
  ];
  const hit = rules.find(([pattern]) => pattern.test(raw));
  if (hit) return hit[1];
  const type = String(competition.competitionType || '').toLowerCase();
  if (/sport/.test(type)) return 'sports';
  if (/technical|tech/.test(type)) return 'technology';
  if (/cultural|informal/.test(type)) return 'festival';
  return 'campus';
}

function festTopic(fest) {
  const type = String(fest.festType || '').toLowerCase();
  if (/tech/.test(type) || /tech|startup|spark/i.test(fest.festName)) return 'technology';
  if (/sport/.test(type) || /run|pace/i.test(fest.festName)) return 'sports';
  return 'festival';
}

async function readFests() {
  const response = await fetch(API_URL, { headers: HEADERS });
  if (!response.ok) throw new Error(`Fest catalog returned HTTP ${response.status}`);
  const payload = await response.json();
  const fests = Array.isArray(payload) ? payload : payload.fests || payload.data;
  return fests.filter((fest) => !/aarohan/i.test(fest.festName || ''));
}

const searchCache = new Map();
let searchQueue = Promise.resolve();
// Openverse rate-limits anonymous clients, so searches run one at a time and are cached per query/page.
function search(query, page) {
  const key = `${query}|${page}`;
  if (!searchCache.has(key)) {
    const task = searchQueue.then(async () => {
      const url = new URL(OPENVERSE_URL);
      url.search = new URLSearchParams({ q: query, page: String(page), page_size: '20', license: 'cc0' }).toString();
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await delay(1500);
        const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) }).catch(() => null);
        if (response?.status === 429) { await delay(15000 * (attempt + 1)); continue; }
        if (!response?.ok) continue;
        return (await response.json()).results || [];
      }
      return [];
    });
    searchQueue = task.catch(() => []);
    searchCache.set(key, task);
  }
  return searchCache.get(key);
}

function acceptable(candidate, topic) {
  const [, require] = TOPICS[topic];
  const text = `${candidate.title || ''} ${(candidate.tags || []).map((tag) => tag.name || '').join(' ')}`;
  const blocklist = topic === 'art' ? ART_SAFE_BLOCKLIST : BLOCKLIST;
  const ratio = Number(candidate.width) / Math.max(1, Number(candidate.height));
  return candidate.license === 'cc0' && !candidate.mature && candidate.thumbnail
    && Number(candidate.width) >= 600 && ratio >= 0.6 && ratio <= 2.2
    && require.test(text) && !blocklist.test(text);
}

async function download(candidate, fileBase, used) {
  if (used.urls.has(candidate.url)) return null;
  used.urls.add(candidate.url);
  try {
    const thumb = new URL(candidate.thumbnail);
    thumb.searchParams.set('width', '1200');
    const response = await fetch(thumb, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
    if (!response.ok || !/image\/(jpeg|png|webp)/.test(response.headers.get('content-type') || '')) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 15000) return null;
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (used.hashes.has(digest)) return null;
    used.hashes.add(digest);
    const sharp = require(require.resolve('sharp', { paths: [path.resolve(__dirname, '../../frontend')] }));
    const file = `${fileBase}.jpg`;
    await sharp(bytes).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(ASSET_DIR, file));
    return {
      file,
      url: `${PUBLIC_BASE}${file}`,
      source: { title: candidate.title, creator: candidate.creator, page: candidate.foreign_landing_url, license: 'cc0' },
    };
  } catch {
    used.urls.delete(candidate.url);
    return null;
  }
}

async function findPhoto(topic, fileBase, used, startPage) {
  const [query] = TOPICS[topic];
  for (let offset = 0; offset < 5; offset += 1) {
    const page = ((startPage + offset) % 5) + 1;
    for (const candidate of (await search(query, page)).filter((item) => acceptable(item, topic))) {
      const photo = await download(candidate, fileBase, used);
      if (photo) return photo;
    }
  }
  return null;
}

async function prepare() {
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const sharp = require(require.resolve('sharp', { paths: [path.resolve(__dirname, '../../frontend')] }));
  const fests = await readFests();
  const used = { urls: new Set(), hashes: new Set() };
  const entries = [];
  const failed = [];
  const tasks = [];
  for (const fest of fests) {
    const real = REAL_FEST_COVERS.find((item) => item.match.test(fest.festName || ''));
    if (isDeadOrEmpty(fest.coverImage)) {
      if (real) {
        await sharp(real.source).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(ASSET_DIR, real.file));
        entries.push({ kind: 'fest', id: String(fest._id), name: fest.festName, url: `${PUBLIC_BASE}${real.file}`, file: real.file, source: { license: 'official', title: 'Official campaign artwork' } });
      } else {
        tasks.push({ kind: 'fest', id: String(fest._id), name: fest.festName, topic: festTopic(fest) });
      }
    }
    for (const competition of fest.competitions || []) {
      if (isDeadOrEmpty(competition.coverImage)) {
        tasks.push({ kind: 'competition', id: String(competition._id), name: competition.name, fest: fest.festName, topic: competitionTopic(competition) });
      }
    }
  }
  const topicCounters = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      topicCounters[task.topic] = (topicCounters[task.topic] || 0) + 1;
      const startPage = Math.floor(topicCounters[task.topic] / 8) % 5;
      try {
        let photo = await findPhoto(task.topic, `${task.kind}-${slug(task.fest || '')}-${slug(task.name)}-${hash(task.id)}`.replace(/^competition--/, 'competition-'), used, startPage);
        if (!photo && task.kind === 'competition') {
          const fallback = ['sports', 'technology', 'festival'].includes(task.topic) ? 'campus' : task.topic === 'campus' ? 'festival' : null;
          if (fallback) photo = await findPhoto(fallback, `${task.kind}-${slug(task.name)}-${hash(task.id)}`, used, startPage);
        }
        if (photo) entries.push({ ...task, ...photo });
        else failed.push(task);
      } catch (error) {
        failed.push({ ...task, reason: error.message });
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  entries.sort((a, b) => `${a.fest || a.name}${a.kind}${a.name}`.localeCompare(`${b.fest || b.name}${b.kind}${b.name}`));
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), entries, failed }, null, 2)}\n`);
  console.log(JSON.stringify({ prepared: entries.length, failed: failed.length, failedItems: failed.map((item) => `${item.fest || ''} / ${item.name} (${item.topic})`) }, null, 2));
}

async function buildPosters(approvedArg) {
  const { posterSvg } = require('./fest-catalog-posters');
  const sharp = require(require.resolve('sharp', { paths: [path.resolve(__dirname, '../../frontend')] }));
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  if (manifest.finalized) throw new Error('Posters were already built for this manifest; run prepare again to start over');
  const approvedIndexes = new Set(String(approvedArg || '').split(',').map((value) => Number(value.trim())).filter(Boolean));
  const fests = await readFests();
  const festById = new Map(fests.map((fest) => [String(fest._id), fest]));
  const festOfCompetition = new Map(fests.flatMap((fest) => (fest.competitions || []).map((competition) => [String(competition._id), fest])));
  const kept = [];
  const rejectedFiles = [];
  manifest.entries.forEach((entry, index) => {
    if (entry.source?.license === 'official' || approvedIndexes.has(index + 1)) kept.push(entry);
    else rejectedFiles.push(entry.file);
  });
  const keptIds = new Set(kept.map((entry) => `${entry.kind}:${entry.id}`));
  const needPoster = [...manifest.entries, ...manifest.failed].filter((entry) => !keptIds.has(`${entry.kind}:${entry.id}`));
  const posters = [];
  for (const task of needPoster) {
    const fest = task.kind === 'fest' ? festById.get(task.id) : festOfCompetition.get(task.id);
    const isFest = task.kind === 'fest';
    const file = `poster-${task.kind}-${slug(isFest ? task.name : `${fest?.festName || ''}-${task.name}`)}-${hash(task.id)}.jpg`;
    const svg = await posterSvg({
      title: task.name,
      subtitle: isFest ? fest?.collegeName : [fest?.festName, fest?.collegeName].filter(Boolean).join(' · '),
      topic: task.topic,
      width: isFest ? 1600 : 1200,
      height: 900,
    });
    await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(ASSET_DIR, file));
    posters.push({ kind: task.kind, id: task.id, name: task.name, fest: task.fest, topic: task.topic, file, url: `${PUBLIC_BASE}${file}`, source: { license: 'crwdctrl-designed', title: 'Designed CrwdCtrl poster' } });
  }
  for (const file of rejectedFiles) await fs.rm(path.join(ASSET_DIR, file), { force: true });
  const entries = [...kept, ...posters];
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), finalized: true, entries, failed: [] }, null, 2)}\n`);
  console.log(JSON.stringify({ photos: kept.length, posters: posters.length, deletedRejectedPhotos: rejectedFiles.length }, null, 2));
}

async function connect() {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set; nothing was changed');
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  return mongoose;
}

async function apply(write) {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  const mongoose = await connect();
  try {
    const FestOrganizer = require('../src/model/fest_organizer_model');
    const Competition = require('../src/model/competition_model');
    const { CatalogImageRecoveryBackup } = require('../src/controllers/adminCatalogImageRecoveryController');
    const festCovers = new Map(manifest.entries.filter((entry) => entry.kind === 'fest').map((entry) => [entry.id, entry.url]));
    const compCovers = new Map(manifest.entries.filter((entry) => entry.kind === 'competition').map((entry) => [entry.id, entry.url]));
    const fests = await FestOrganizer.find({ festName: { $not: /aarohan/i } }).select('festName coverImage coverImages galleryImages competitions').lean();
    const backup = { createdAt: new Date().toISOString(), source: 'restore-fest-catalog-images', fests: [], competitions: [] };
    const festOps = [];
    const compOps = [];
    for (const fest of fests) {
      const set = {};
      const cover = festCovers.get(String(fest._id));
      if (cover && isDeadOrEmpty(fest.coverImage)) set.coverImage = cover;
      for (const slot of COVER_SLOTS) {
        if (isDead(fest.coverImages?.[slot])) set[`coverImages.${slot}`] = cover || '';
      }
      if ((fest.galleryImages || []).some(isDead)) set.galleryImages = fest.galleryImages.filter((url) => url && !isDead(url));
      if (Object.keys(set).length) {
        backup.fests.push({ id: String(fest._id), coverImage: fest.coverImage, coverImages: fest.coverImages, galleryImages: fest.galleryImages });
        festOps.push({ updateOne: { filter: { _id: fest._id }, update: { $set: set } } });
      }
    }
    const competitions = await Competition.find({ _id: { $in: fests.flatMap((fest) => fest.competitions || []) } }).select('name coverImage gallery').lean();
    for (const competition of competitions) {
      const set = {};
      const cover = compCovers.get(String(competition._id));
      if (cover && isDeadOrEmpty(competition.coverImage)) set.coverImage = cover;
      if ((competition.gallery || []).some(isDead)) set.gallery = competition.gallery.filter((url) => url && !isDead(url));
      if (Object.keys(set).length) {
        backup.competitions.push({ id: String(competition._id), coverImage: competition.coverImage, gallery: competition.gallery });
        compOps.push({ updateOne: { filter: { _id: competition._id }, update: { $set: set } } });
      }
    }
    const coverChanges = festOps.filter((op) => op.updateOne.update.$set.coverImage).length;
    const compCoverChanges = compOps.filter((op) => op.updateOne.update.$set.coverImage).length;
    console.log(`Fests to update: ${festOps.length} (${coverChanges} new covers). Competitions to update: ${compOps.length} (${compCoverChanges} new covers).`);
    if (!write) { console.log('Dry run only. Add --write to apply.'); return; }
    if (!festOps.length && !compOps.length) return;
    const record = await CatalogImageRecoveryBackup.create({ backup });
    if (festOps.length) await FestOrganizer.bulkWrite(festOps, { ordered: false });
    if (compOps.length) await Competition.bulkWrite(compOps, { ordered: false });
    console.log(`Applied. Backup id: ${record._id}\nUndo with: node scripts/restore-fest-catalog-images.js rollback ${record._id}`);
  } finally {
    await mongoose.disconnect();
  }
}

async function rollback(id) {
  const mongoose = await connect();
  try {
    const FestOrganizer = require('../src/model/fest_organizer_model');
    const Competition = require('../src/model/competition_model');
    const { CatalogImageRecoveryBackup } = require('../src/controllers/adminCatalogImageRecoveryController');
    const record = await CatalogImageRecoveryBackup.findById(id).lean();
    if (!record) throw new Error(`No backup found with id ${id}`);
    for (const { id: festId, ...fields } of record.backup.fests || []) await FestOrganizer.updateOne({ _id: festId }, { $set: fields });
    for (const row of record.backup.competitions || []) await Competition.updateOne({ _id: row.id }, { $set: { coverImage: row.coverImage, gallery: row.gallery } });
    console.log(`Restored ${record.backup.fests.length} fests and ${record.backup.competitions.length} competitions.`);
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { competitionTopic };

if (require.main === module) {
const [command, arg] = process.argv.slice(2);
const run = command === 'prepare' ? prepare()
  : command === 'posters' ? buildPosters(arg)
  : command === 'apply' ? apply(arg === '--write')
    : command === 'rollback' ? rollback(arg)
      : Promise.reject(new Error('Use: prepare | posters <approved-indexes> | apply [--write] | rollback <backup-id>'));
run.catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
}
