'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const MANIFEST_PATH = path.resolve(__dirname, '../../scripts/data/catalog-image-recovery-manifest.json');
const BACKUP_DIR = path.resolve(__dirname, '../../tmp/catalog-image-backups');
const DEAD_IMAGE_HOST = /res\.cloudinary\.com\/dyonimhgb\//i;
const COVER_SLOTS = ['page', 'portrait', 'wide', 'hero', 'square', 'landscape', 'video'];

const isDead = (url) => !url || DEAD_IMAGE_HOST.test(String(url));
const identity = (item) => `${item.kind}:${item.id}:${Number.isInteger(item.index) ? item.index : ''}`;

function validateManifestImage(item) {
  if (!item || !['fest', 'fest-gallery', 'competition', 'competition-gallery'].includes(item.kind)) return false;
  if (!/^[a-f\d]{24}$/i.test(String(item.id || ''))) return false;
  if (typeof item.file !== 'string' || !/^[a-z0-9-]+\.(jpg|png|webp)$/i.test(item.file) || path.basename(item.file) !== item.file) return false;
  return item.publicUrl === `https://www.crwdctrl.in/images/catalog-recovery/${item.file}`
    && item.license === 'cc0';
}

async function applyRecovery(req, res) {
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    console.error('[adminCatalogImageRecovery] Could not read manifest:', error.message);
    return res.status(503).json({ error: 'Image recovery manifest is not available on this backend build.' });
  }

  const availableImages = Array.isArray(manifest.images) ? manifest.images.filter(validateManifestImage) : [];
  if (!availableImages.length) return res.status(503).json({ error: 'No verified CC0 recovery images are available.' });
  const requestedKeys = req.body?.imageKeys;
  if (!Array.isArray(requestedKeys) || requestedKeys.length < 1 || requestedKeys.length > availableImages.length) {
    return res.status(400).json({ error: 'Select one or more prepared images to apply.' });
  }
  const imagesByKey = new Map(availableImages.map((image) => [identity(image), image]));
  const uniqueKeys = [...new Set(requestedKeys.map((key) => String(key)))];
  if (uniqueKeys.some((key) => !imagesByKey.has(key))) {
    return res.status(400).json({ error: 'The selected image list is out of date. Refresh this page and select again.' });
  }
  const images = uniqueKeys.map((key) => imagesByKey.get(key));

  const FestOrganizer = require('../model/fest_organizer_model');
  const Competition = require('../model/competition_model');
  const festImages = new Map();
  const competitionImages = new Map();
  for (const image of images) {
    const target = image.kind.startsWith('fest') ? festImages : competitionImages;
    if (!target.has(image.id)) target.set(image.id, []);
    target.get(image.id).push(image);
  }

  const backup = { createdAt: new Date().toISOString(), fests: [], competitions: [] };
  const festOperations = [];
  const competitionOperations = [];
  let replacedImageFields = 0;

  const festRows = await FestOrganizer.find({ _id: { $in: [...festImages.keys()] } })
    .select('coverImage coverImages galleryImages').lean();
  const festRowsById = new Map(festRows.map((row) => [String(row._id), row]));
  for (const [id, records] of festImages) {
    const row = festRowsById.get(id);
    if (!row) continue;
    const set = {};
    const cover = records.find((image) => image.kind === 'fest');
    if (cover && isDead(row.coverImage)) {
      set.coverImage = cover.publicUrl;
      replacedImageFields += 1;
    }
    if (cover) {
      const coverImages = row.coverImages?.toObject ? row.coverImages.toObject() : (row.coverImages || {});
      for (const slot of COVER_SLOTS) {
        if (isDead(coverImages[slot])) {
          set[`coverImages.${slot}`] = cover.publicUrl;
          replacedImageFields += 1;
        }
      }
    }
    const gallery = Array.isArray(row.galleryImages) ? row.galleryImages : [];
    for (const image of records.filter((entry) => entry.kind === 'fest-gallery')) {
      if (isDead(gallery[image.index])) {
        set[`galleryImages.${image.index}`] = image.publicUrl;
        replacedImageFields += 1;
      }
    }
    if (Object.keys(set).length) {
      backup.fests.push({ id, coverImage: row.coverImage, coverImages: row.coverImages, galleryImages: row.galleryImages });
      festOperations.push({ updateOne: { filter: { _id: id }, update: { $set: set } } });
    }
  }

  const competitionRows = await Competition.find({ _id: { $in: [...competitionImages.keys()] } })
    .select('coverImage gallery').lean();
  const competitionRowsById = new Map(competitionRows.map((row) => [String(row._id), row]));
  for (const [id, records] of competitionImages) {
    const row = competitionRowsById.get(id);
    if (!row) continue;
    const set = {};
    const cover = records.find((image) => image.kind === 'competition');
    if (cover && isDead(row.coverImage)) {
      set.coverImage = cover.publicUrl;
      replacedImageFields += 1;
    }
    const gallery = Array.isArray(row.gallery) ? row.gallery : [];
    for (const image of records.filter((entry) => entry.kind === 'competition-gallery')) {
      if (isDead(gallery[image.index])) {
        set[`gallery.${image.index}`] = image.publicUrl;
        replacedImageFields += 1;
      }
    }
    if (Object.keys(set).length) {
      backup.competitions.push({ id, coverImage: row.coverImage, gallery: row.gallery });
      competitionOperations.push({ updateOne: { filter: { _id: id }, update: { $set: set } } });
    }
  }

  if (!festOperations.length && !competitionOperations.length) {
    return res.json({ success: true, message: 'All catalog images already have working replacements.', updatedFests: 0, updatedCompetitions: 0 });
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `catalog-images-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');

  try {
    if (festOperations.length) await FestOrganizer.bulkWrite(festOperations, { ordered: false });
    if (competitionOperations.length) await Competition.bulkWrite(competitionOperations, { ordered: false });
  } catch (error) {
    console.error('[adminCatalogImageRecovery] Apply failed; backup retained at:', backupPath, error);
    return res.status(500).json({ error: 'Image recovery was interrupted. The pre-change backup is retained for rollback.' });
  }

  try {
    const { clearAllCaches } = require('./festOrganizerController');
    clearAllCaches?.();
  } catch (error) {
    console.warn('[adminCatalogImageRecovery] Cache clear failed:', error.message);
  }

  return res.json({
    success: true,
    updatedFests: festOperations.length,
    updatedCompetitions: competitionOperations.length,
    replacedImageFields,
    selectedImages: images.length,
    unmatchedImages: Array.isArray(manifest.failed) ? manifest.failed.length : 0,
    message: 'Recovered images applied. Existing working images were left unchanged.',
  });
}

module.exports = { applyRecovery };
