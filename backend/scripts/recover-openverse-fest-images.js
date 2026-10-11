#!/usr/bin/env node
/*
 * Recover dead fest/competition images with CC0 photos, keeping a reversible
 * backup of the Mongo fields. Run from backend/:
 *   node scripts/recover-openverse-fest-images.js prepare
 *   node scripts/recover-openverse-fest-images.js apply
 *   node scripts/recover-openverse-fest-images.js rollback <backup-file>
 *
 * `prepare` downloads image files into frontend/public so they deploy with the
 * site. `apply` changes only missing or deactivated Cloudinary URLs.
 */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const API_URL = 'https://crwdctrl-production-9c58.up.railway.app/api/fests/all?limit=200';
const OPENVERSE_URL = 'https://api.openverse.org/v1/images/';
const FRONTEND_PUBLIC = path.resolve(__dirname, '../../frontend/public');
const ASSET_DIR = path.join(FRONTEND_PUBLIC, 'images/catalog-recovery');
const MANIFEST_PATH = path.join(__dirname, 'data/catalog-image-recovery-manifest.json');
const PUBLIC_MANIFEST_PATH = path.join(ASSET_DIR, 'catalog-image-recovery-manifest.json');
const DEACTIVATED_CLOUD = /res\.cloudinary\.com\/dyonimhgb\//i;
const SAFE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const IMAGE_HEADERS = {
  'user-agent': 'CrwdCtrlMediaRecovery/1.0 (https://www.crwdctrl.in; support@crwdctrl.com)',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stableName = (...parts) => parts.map((part) => String(part || '')).join(' ').trim();
const safeSlug = (value) => String(value || 'image')
  .normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 52) || 'image';
const shortHash = (value) => crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 10);
const isDead = (url) => !url || DEACTIVATED_CLOUD.test(url);

function competitionTopic(competition) {
  const raw = `${competition.competitionType || ''} ${competition.name || ''}`.toLowerCase();
  if (/badminton/.test(raw)) return 'badminton';
  if (/basketball/.test(raw)) return 'basketball';
  if (/squash/.test(raw)) return 'squash';
  if (/robot|robotics|robo|kart/.test(raw)) return 'robotics';
  if (/football|soccer/.test(raw)) return 'football';
  if (/cricket/.test(raw)) return 'cricket match';
  if (/volleyball/.test(raw)) return 'volleyball';
  if (/kabaddi/.test(raw)) return 'kabaddi';
  if (/archery/.test(raw)) return 'archery';
  if (/swim/.test(raw)) return 'swimming';
  if (/chess/.test(raw)) return 'chess';
  if (/tennis/.test(raw)) return 'tennis';
  if (/athletic|race|run|marathon/.test(raw)) return 'running';
  if (/drone|uav|uav-x/.test(raw)) return 'drone';
  if (/gaming|esport|bgmi|valorant|free.?fire|fifa|video.?game/.test(raw)) return 'gaming';
  if (/code|coding|programming|hack|cyber|software|web.?app/.test(raw)) return 'coding';
  if (/quiz|trivia|rapid.?fire/.test(raw)) return 'quiz';
  if (/debate|public.?speaking|elocution/.test(raw)) return 'debate';
  if (/startup|business|marketing|finance|entrepreneur|case.?study|management|pitch|ideathon|bullrun|innovation/.test(raw)) return 'startup';
  if (/photo|pixel|camera|photography/.test(raw)) return 'photography';
  if (/film|cinema|movie|short.?film|video.?production|reel/.test(raw)) return 'film';
  if (/dance|nritya|step.?off|step.?up|footloose|classical/.test(raw)) return 'dance';
  if (/sing|humming|vocal|music|band|antakshari|head.?bang|beats|concert|melody|rap.?battle/.test(raw)) return 'music';
  if (/fashion|model|runway|glamour/.test(raw)) return 'fashion';
  if (/theatre|theater|drama|acting/.test(raw)) return 'theatre';
  if (/poetry|literary|story|writing|kalam|kavita/.test(raw)) return 'poetry';
  if (/drawing|painting|sketch|logo|art|design|craft|kal[aā]/.test(raw)) return 'art';
  if (/(^|\s)(sports|sport|boys|girls|mixed)(\s|$)/.test(raw)) return 'sports';
  if (/dance/.test(competition.competitionType || '')) return 'dance';
  if (/music/.test(competition.competitionType || '')) return 'music';
  if (/photography|media/.test(competition.competitionType || '')) return 'photography';
  if (/art|design/.test(competition.competitionType || '')) return 'art';
  if (/debate/.test(competition.competitionType || '')) return 'debate';
  if (/quiz/.test(competition.competitionType || '')) return 'quiz';
  if (/business|finance|marketing|management/.test(competition.competitionType || '')) return 'startup';
  if (/esports/.test(competition.competitionType || '')) return 'gaming';
  if (/marathon/.test(competition.competitionType || '')) return 'running';
  if (/technical/.test(competition.competitionType || '')) return 'technology';
  if (/cultural|informals/.test(competition.competitionType || '')) return 'festival';
  return 'campus';
}

function buildAssetTasks(fests) {
  const tasks = [];
  for (const fest of fests) {
    const festId = String(fest._id);
    if (isDead(fest.coverImage)) {
      tasks.push({ kind: 'fest', id: festId, name: fest.festName, college: fest.collegeName,
        query: `${fest.festName}` });
    }
    (fest.galleryImages || []).forEach((url, index) => {
      if (isDead(url)) tasks.push({ kind: 'fest-gallery', id: festId, index,
        name: `${fest.festName} gallery ${index + 1}`,
        query: 'festival' });
    });
    for (const competition of fest.competitions || []) {
      if (isDead(competition.coverImage)) {
        tasks.push({ kind: 'competition', id: String(competition._id), festId,
          name: competition.name, college: fest.collegeName,
          query: competitionTopic(competition) });
      }
      (competition.gallery || []).forEach((url, index) => {
        if (isDead(url)) tasks.push({ kind: 'competition-gallery', id: String(competition._id), index,
          name: `${competition.name} gallery ${index + 1}`,
          query: competitionTopic(competition) });
      });
    }
  }
  return tasks;
}

async function readFestCatalog() {
  const response = await fetch(API_URL, { headers: IMAGE_HEADERS });
  if (!response.ok) throw new Error(`Public fest catalog returned HTTP ${response.status}`);
  const payload = await response.json();
  const fests = Array.isArray(payload) ? payload : payload.fests || payload.data?.fests || payload.data;
  if (!Array.isArray(fests)) throw new Error('Could not find the fest array in the public API response');
  return fests;
}

async function openverseResults(query, page = 1) {
  const url = new URL(OPENVERSE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', '20');
  url.searchParams.set('license', 'cc0');
  const response = await fetch(url, { headers: IMAGE_HEADERS });
  if (response.status === 429) {
    await delay(1500);
    return openverseResults(query, page);
  }
  if (!response.ok) throw new Error(`Openverse search returned HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.results || []).filter((item) => {
    const title = String(item.title || '');
    return item.license === 'cc0'
      && !item.mature
      && Number(item.width) >= 320
      && Number(item.height) >= 200
      && !/logo|icon|clip.?art|vector|illustration|screenshot|map/i.test(title)
      && item.thumbnail;
  });
}

function taskIdentity(task) {
  return `${task.kind}-${task.id}${Number.isInteger(task.index) ? `-${task.index}` : ''}`;
}

function candidateScore(candidate, task) {
  const topicWords = String(task.query || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  const nameWords = String(task.name || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  const title = String(candidate.title || '').toLowerCase();
  const topicMatches = topicWords.reduce((total, word) => total + (title.includes(word) ? 1 : 0), 0);
  const nameMatches = nameWords.reduce((total, word) => total + (title.includes(word) ? 1 : 0), 0);
  const ratio = Number(candidate.width) / Math.max(1, Number(candidate.height));
  const reasonableRatio = ratio >= 0.45 && ratio <= 2.3 ? 1 : 0;
  return topicMatches * 5 + nameMatches + reasonableRatio;
}

async function downloadPhoto(candidate, task, usedUrls, usedHashes) {
  const pages = [candidate];
  let selected = pages.find((item) => !usedUrls.has(item.url));
  if (!selected) return null;
  // Reserve synchronously before awaiting the download so parallel workers
  // cannot assign the same source photo to different catalog entries.
  usedUrls.add(selected.url);
  let keepReservation = false;
  let reservedHash = '';
  try {
    const thumbnail = new URL(selected.thumbnail);
    thumbnail.searchParams.set('width', '1000');
    const response = await fetch(thumbnail, { headers: IMAGE_HEADERS });
    const extension = SAFE_EXTENSIONS[String(response.headers.get('content-type') || '').split(';')[0].toLowerCase()];
    if (!response.ok || !extension) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 8_000 || bytes.length > 2_500_000) return null;
    reservedHash = crypto.createHash('sha256').update(bytes).digest('hex');
    if (usedHashes.has(reservedHash)) {
      reservedHash = '';
      return null;
    }
    usedHashes.add(reservedHash);
    const fileName = `${safeSlug(task.kind)}-${safeSlug(task.name)}-${shortHash(taskIdentity(task))}.${extension}`;
    const destination = path.join(ASSET_DIR, fileName);
    await fs.writeFile(destination, bytes);
    keepReservation = true;
    return {
      ...task,
      file: fileName,
      publicUrl: `https://www.crwdctrl.in/images/catalog-recovery/${fileName}`,
      sourceUrl: selected.url,
      sourcePage: selected.foreign_landing_url,
      title: selected.title,
      creator: selected.creator,
      license: selected.license,
      licenseUrl: selected.license_url,
      attribution: selected.attribution,
    };
  } finally {
    if (!keepReservation) usedUrls.delete(selected.url);
    if (!keepReservation && reservedHash) usedHashes.delete(reservedHash);
  }
}

async function prepare() {
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const fests = await readFestCatalog();
  const tasks = buildAssetTasks(fests);
  const usedUrls = new Set();
  const usedHashes = new Set();
  const completed = [];
  const failed = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      try {
        const results = await openverseResults(task.query);
        const candidates = results.sort((a, b) => candidateScore(b, task) - candidateScore(a, task));
        let recovered = null;
        for (const candidate of candidates) {
          recovered = await downloadPhoto(candidate, task, usedUrls, usedHashes);
          if (recovered) break;
        }
        if (!recovered) {
          const fallback = task.kind.startsWith('fest') ? 'festival' : task.query;
          const firstPage = parseInt(shortHash(taskIdentity(task)), 16) % 12;
          for (let offset = 0; offset < 6 && !recovered; offset += 1) {
            const page = ((firstPage + offset) % 12) + 1;
            for (const candidate of await openverseResults(fallback, page)) {
              recovered = await downloadPhoto(candidate, task, usedUrls, usedHashes);
              if (recovered) break;
            }
          }
        }
        if (recovered) completed.push(recovered);
        else failed.push({ ...task, reason: 'No suitable CC0 photo found' });
      } catch (error) {
        failed.push({ ...task, reason: error.message });
      }
      if ((completed.length + failed.length) % 25 === 0) {
        process.stdout.write(`Prepared ${completed.length + failed.length}/${tasks.length}; photos ${completed.length}; no match ${failed.length}\n`);
      }
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  completed.sort((a, b) => taskIdentity(a).localeCompare(taskIdentity(b)));
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'Openverse CC0 image search',
    catalog: { fests: fests.length, competitions: fests.reduce((sum, fest) => sum + (fest.competitions || []).length, 0) },
    totals: { requested: tasks.length, prepared: completed.length, failed: failed.length },
    images: completed,
    failed,
  };
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(MANIFEST_PATH, manifestJson, 'utf8');
  await fs.writeFile(PUBLIC_MANIFEST_PATH, manifestJson, 'utf8');
  console.log(JSON.stringify({ manifest: MANIFEST_PATH, assets: ASSET_DIR, ...manifest.totals }, null, 2));
}

async function applyMigration() {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set; no data was changed');
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    const { applyRecovery } = require('../src/controllers/adminCatalogImageRecoveryController');
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await applyRecovery({}, response);
    if (response.statusCode >= 400) throw new Error(response.body?.error || `Recovery apply failed (${response.statusCode})`);
    console.log(JSON.stringify(response.body, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

async function rollback(backupPath) {
  if (!backupPath) throw new Error('Provide the backup file path printed by apply');
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set; no data was changed');
  const backup = JSON.parse(await fs.readFile(path.resolve(backupPath), 'utf8'));
  const mongoose = require('mongoose');
  const FestOrganizer = require('../src/model/fest_organizer_model');
  const Competition = require('../src/model/competition_model');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    for (const row of backup.fests || []) {
      await FestOrganizer.updateOne({ _id: row.id }, { $set: {
        coverImage: row.coverImage,
        coverImages: row.coverImages,
        galleryImages: row.galleryImages,
      } });
    }
    for (const row of backup.competitions || []) {
      await Competition.updateOne({ _id: row.id }, { $set: { coverImage: row.coverImage, gallery: row.gallery } });
    }
    console.log(JSON.stringify({ restoredFests: backup.fests?.length || 0, restoredCompetitions: backup.competitions?.length || 0 }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === 'prepare') return prepare();
  if (command === 'apply') return applyMigration();
  if (command === 'rollback') return rollback(arg);
  throw new Error('Use: prepare | apply | rollback <backup-file>');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
