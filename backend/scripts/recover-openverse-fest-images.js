#!/usr/bin/env node
/*
 * Recover dead fest/competition images with CC0 photos, keeping a reversible
 * backup of the Mongo fields. Run from backend/:
 *   node scripts/recover-openverse-fest-images.js prepare
 *   node scripts/recover-openverse-fest-images.js prepare-listings
 *   node scripts/recover-openverse-fest-images.js apply
 *   node scripts/recover-openverse-fest-images.js rollback <backup-file | backup-id>
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

const LISTING_SOURCES = [
  { path: 'treks?limit=500', key: 'treks', kind: 'trek' },
  { path: 'trek-communities', key: 'communities', kind: 'trek-community' },
  { path: 'sports?limit=500', key: 'events', kind: 'sport' },
  { path: 'run-clubs', key: 'clubs', kind: 'run-club' },
  { path: 'events', key: 'shows', kind: 'event-show' },
  { path: 'home', key: 'sports', kind: 'sport' },
  { path: 'home', key: 'runClubs', kind: 'run-club' },
  { path: 'home', key: 'eventShows', kind: 'event-show' },
];
const LISTING_API_BASE = 'https://crwdctrl-production-9c58.up.railway.app/api/';
const LISTING_IMAGE_FIELDS = ['coverImage', 'poster', 'banner', 'images', 'heroImages', 'galleryImages'];

function listingHasDeadImage(item) {
  const values = LISTING_IMAGE_FIELDS.flatMap((field) => (Array.isArray(item[field]) ? item[field] : [item[field]]))
    .concat(Object.values(item.coverImages || {}));
  return values.some((value) => typeof value === 'string' && DEACTIVATED_CLOUD.test(value));
}

function trekPlaceQuery(name) {
  return String(name || '')
    .replace(/\b(night|day|monsoon|winter|summer|weekend|trek|trekking|hike|camping|camp|tour|trip|batch|special|edition|with|and|the|20\d\d)\b/gi, ' ')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const LISTING_BLOCKLIST = /rodent|mouse|\brat\b|squirrel|insect|spider|beetle|moth|fung|mushroom|bikini|swimsuit|lingerie|nude|coin|lego|toy|figurine|statue|sculpture|map\b|diagram|chart|poster|cartoon|drawing|painting|render|3d|military|army|tank|weapon|gun|dog|cat\b|goose|duck|bird|car\b|vintage|portrait|selfie|wedding/i;

const Q = (q, require) => ({ q, require });
const MOUNTAIN = /mountain|hill|ghat|valley|peak|trek|hik|trail|fort|cliff|ridge|summit|forest|landscape|waterfall/i;
const WATERFALL = /waterfall|falls|cascade/i;
const RUNNING = /run|marathon|race|jog|athlet|sprint/i;
const CONCERT = /concert|festival|stage|crowd|band|music|gig|live/i;

function trekQueries(item) {
  const raw = `${item.trekName || item.title || ''} ${item.trekCategory || ''}`.toLowerCase();
  const place = trekPlaceQuery(item.trekName || item.title);
  const queries = [];
  if (/temple|darshan|jyotirling|mahakal|pilgrim/.test(raw)) queries.push(Q('hindu temple india', /temple|shrine|mandir/i));
  if (/beach|alibaug|konkan|sea|coast/.test(raw)) queries.push(Q('beach camping', /beach|coast|sea|shore/i));
  if (/lake|camping|pawna|panshet/.test(raw)) queries.push(Q('lakeside camping tent', /lake|camp|tent/i));
  if (/waterfall|falls/.test(raw)) queries.push(Q('waterfall forest', WATERFALL), Q('monsoon waterfall', WATERFALL));
  if (/fort|gad\b|gad /.test(raw) || /gad$/.test(place.toLowerCase())) queries.push(Q('hill fort india', /fort|castle|ruin|wall/i));
  if (place) queries.push(Q(`${place} maharashtra`, MOUNTAIN));
  queries.push(Q('western ghats mountains', MOUNTAIN), Q('mountain hiking trail', MOUNTAIN), Q('hikers mountain', MOUNTAIN));
  return queries;
}

function sportQueries(item) {
  const raw = `${item.title || ''} ${item.sportType || ''} ${item.runCategory || ''}`.toLowerCase();
  if (/pickle/.test(raw)) return [Q('pickleball', /pickle|paddle|tennis|court/i), Q('tennis court', /tennis|court/i)];
  if (/resin|workshop|clock|craft|art/.test(raw)) return [Q('art workshop', /workshop|craft|art|class/i), Q('craft workshop', /craft|workshop/i)];
  if (/mafia|murder|mystery|board.?game/.test(raw)) return [Q('board game friends', /game|board|cards|friends/i), Q('people playing board game', /game|board/i)];
  if (/touch.?grass|picnic|park/.test(raw)) return [Q('picnic park friends', /picnic|park|grass|friends/i), Q('park lawn', /park|lawn|grass/i)];
  if (/cycl|bike|ride/.test(raw)) return [Q('cycling race', /cycl|bike|bicycle/i)];
  const topic = competitionTopic({ name: item.title, competitionType: item.sportType || '' });
  const queries = ['campus', 'running', 'sports'].includes(topic) ? [] : [Q(topic, new RegExp(topic.split(' ')[0], 'i'))];
  return queries.concat([Q('marathon runners', RUNNING), Q('running race', RUNNING), Q('fun run', RUNNING)]);
}

function eventShowQueries(show) {
  const raw = `${show.eventType || ''} ${show.title || ''}`.toLowerCase();
  if (/kart|drag|motor|octane|race|rally/.test(raw)) return [Q('go kart racing', /kart|race|racing|motor/i), Q('motorsport race', /motor|race|racing|rally/i)];
  if (/comedy|stand.?up|open.?mic/.test(raw)) return [Q('stand up comedy', /comed|stand.?up|mic|stage/i), Q('comedian stage', /comed|stage|mic/i)];
  if (/garba|dandiya|navratri|raas/.test(raw)) return [Q('garba dance navratri', /garba|dandiya|navratri|dance/i), Q('indian folk dance', /dance|folk/i)];
  if (/pageant|mr\b|miss|mrs|model|fashion/.test(raw)) return [Q('fashion show runway', /fashion|runway|catwalk|model/i), Q('stage show audience', /stage|show|audience/i)];
  if (/theatre|theater|drama|play/.test(raw)) return [Q('theatre stage', /theat|stage|drama|play/i)];
  if (/workshop|class|craft|resin|pottery|art/.test(raw)) return [Q('art workshop', /workshop|craft|art|class/i)];
  return [Q('concert crowd', CONCERT), Q('music festival stage', CONCERT)];
}

function listingTask(kind, item) {
  const id = String(item._id || item.id || '');
  if (kind === 'trek') return { kind, id, name: item.trekName || item.title, college: item.city || '', queries: trekQueries(item) };
  if (kind === 'trek-community') {
    return { kind, id, name: item.name, college: item.basedIn || '', queries: [Q('hikers mountain', MOUNTAIN), Q('hiking group', /hik|trek|trail|mountain/i), Q('trekking group mountains', MOUNTAIN)] };
  }
  if (kind === 'sport') return { kind, id, name: item.title, college: item.city || '', queries: sportQueries(item) };
  if (kind === 'run-club') {
    return { kind, id, name: item.name, college: item.basedIn || '', queries: [Q('marathon runners', RUNNING), Q('group of runners', RUNNING), Q('running race', RUNNING), Q('fun run', RUNNING)] };
  }
  return { kind, id, name: item.title || item.displayName, college: item.city || '', queries: eventShowQueries(item) };
}

function candidateMatches(candidate, require) {
  const text = `${candidate.title || ''} ${(candidate.tags || []).map((tag) => tag.name || '').join(' ')}`;
  return require.test(text) && !LISTING_BLOCKLIST.test(text);
}

async function readListingCatalog() {
  const responses = new Map();
  const items = new Map();
  for (const source of LISTING_SOURCES) {
    if (!responses.has(source.path)) {
      const response = await fetch(LISTING_API_BASE + source.path, { headers: IMAGE_HEADERS });
      if (!response.ok) throw new Error(`${source.path} returned HTTP ${response.status}`);
      responses.set(source.path, await response.json());
    }
    for (const item of responses.get(source.path)?.[source.key] || []) {
      const id = String(item._id || item.id || '');
      if (/^[a-f\d]{24}$/i.test(id) && listingHasDeadImage(item)) items.set(`${source.kind}:${id}`, { kind: source.kind, item });
    }
  }
  return [...items.values()];
}

async function prepareListings() {
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const existing = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  const listingKinds = new Set(['trek', 'trek-community', 'sport', 'run-club', 'event-show']);
  const keptImages = (existing.images || []).filter((image) => !listingKinds.has(image.kind));
  const keptFailed = (existing.failed || []).filter((image) => !listingKinds.has(image.kind));
  const usedUrls = new Set(keptImages.map((image) => image.sourceUrl));
  const usedHashes = new Set();
  const tasks = (await readListingCatalog()).map(({ kind, item }) => listingTask(kind, item));
  const completed = [];
  const failed = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      try {
        let recovered = null;
        for (const { q: query, require } of task.queries) {
          for (const page of [1, 2]) {
            const candidates = (await openverseResults(query, page))
              .filter((candidate) => candidateMatches(candidate, require))
              .sort((a, b) => candidateScore(b, { ...task, query }) - candidateScore(a, { ...task, query }));
            for (const candidate of candidates) {
              recovered = await downloadPhoto(candidate, { ...task, query }, usedUrls, usedHashes);
              if (recovered) break;
            }
            if (recovered) break;
          }
          if (recovered) break;
        }
        if (recovered) {
          delete recovered.queries;
          completed.push(recovered);
        } else {
          failed.push({ kind: task.kind, id: task.id, name: task.name, reason: 'No suitable CC0 photo found' });
        }
      } catch (error) {
        failed.push({ kind: task.kind, id: task.id, name: task.name, reason: error.message });
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  completed.sort((a, b) => taskIdentity(a).localeCompare(taskIdentity(b)));
  const images = [...keptImages, ...completed];
  const allFailed = [...keptFailed, ...failed];
  const manifest = {
    ...existing,
    generatedAt: new Date().toISOString(),
    catalog: { ...existing.catalog, listings: tasks.length },
    totals: { requested: images.length + allFailed.length, prepared: images.length, failed: allFailed.length },
    images,
    failed: allFailed,
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(MANIFEST_PATH, manifestJson, 'utf8');
  await fs.writeFile(PUBLIC_MANIFEST_PATH, manifestJson, 'utf8');
  console.log(JSON.stringify({ listingsNeedingImages: tasks.length, prepared: completed.length, failed: failed.length, failedNames: failed.map((item) => `${item.kind}: ${item.name}`) }, null, 2));
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
  const mongoose = require('mongoose');
  const FestOrganizer = require('../src/model/fest_organizer_model');
  const Competition = require('../src/model/competition_model');
  const { LISTING_RECOVERY_KINDS } = require('../src/utils/catalogImageRecoveryListings');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    let backup;
    if (/^[a-f\d]{24}$/i.test(backupPath)) {
      const { CatalogImageRecoveryBackup } = require('../src/controllers/adminCatalogImageRecoveryController');
      const record = await CatalogImageRecoveryBackup.findById(backupPath).lean();
      if (!record) throw new Error(`No recovery backup found with id ${backupPath}`);
      backup = record.backup;
    } else {
      backup = JSON.parse(await fs.readFile(path.resolve(backupPath), 'utf8'));
    }
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
    for (const row of backup.listings || []) {
      const config = LISTING_RECOVERY_KINDS[row.kind];
      if (config) await config.model().updateOne({ _id: row.id }, { $set: row.fields });
    }
    console.log(JSON.stringify({ restoredFests: backup.fests?.length || 0, restoredCompetitions: backup.competitions?.length || 0, restoredListings: backup.listings?.length || 0 }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === 'prepare') return prepare();
  if (command === 'prepare-listings') return prepareListings();
  if (command === 'apply') return applyMigration();
  if (command === 'rollback') return rollback(arg);
  throw new Error('Use: prepare | prepare-listings | apply | rollback <backup-file | backup-id>');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
