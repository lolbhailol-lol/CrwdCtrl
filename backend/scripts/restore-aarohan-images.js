#!/usr/bin/env node
/*
 * Point Aarohan 2026, Aarohan 2027 and Aarohan Multicity at the real event photos
 * shipped in frontend/public/images/fests/aarohan. Only links to the disabled
 * Cloudinary account (or empty values) change; working images are left alone.
 * Run from backend/:
 *   node scripts/restore-aarohan-images.js            # dry run, prints the plan
 *   node scripts/restore-aarohan-images.js --apply    # writes, after saving a backup
 *   node scripts/restore-aarohan-images.js --rollback <backup-id>
 */
'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const BASE = 'https://www.crwdctrl.in/images/fests/aarohan/';
const img = (name) => `${BASE}${name}.jpg`;
const DEAD = /res\.cloudinary\.com\/dyonimhgb\//i;
const isDead = (url) => typeof url === 'string' && DEAD.test(url);
const isDeadOrEmpty = (url) => !url || isDead(url);

const FEST_IDS = ['6956905caf14b9da79fef610', '6a6f9708884bbe0ca158dba8', '6ac22157ec8160dfd660d0d4'];
const FEST_COVER = img('head-bang-band-wars');
const FEST_GALLERY = ['insync-group-dance', 'glamour-nova-fashion-show', 'head-bang-band-wars', 'dastak-street-play', 'box-football', 'inner-flame-solo-dance'].map(img);
const COVER_SLOTS = ['page', 'portrait', 'wide', 'hero', 'square', 'landscape', 'video'];

const COMPETITION_IMAGES = [
  [/^insync$/i, 'insync-group-dance'],
  [/^inner flame$/i, 'inner-flame-solo-dance'],
  [/^head bang$/i, 'head-bang-band-wars'],
  [/^(humming|euphony)$/i, 'humming-solo-singing'],
  [/^dastak$/i, 'dastak-street-play'],
  [/^platform$/i, 'platform-stage-act'],
  [/^art maestro$/i, 'art-maestro'],
  [/^glamour nova$/i, 'glamour-nova-fashion-show'],
  [/^box football$/i, 'box-football'],
  [/^box cricket$/i, 'box-cricket'],
  [/^(bgmi|real cricket 24|valorant|fifa)$/i, 'esports'],
  [/^solo smash$/i, 'solo-smash-badminton'],
  [/^shuttle synergy$/i, 'shuttle-synergy-badminton-duo'],
];

const ARTIST_IMAGES = [
  [/nikhil/i, 'artist-nikhil-dsouza'],
  [/shreya/i, 'artist-shreya-jain'],
  [/vivek|kaustubh/i, 'artist-vivek-samtani-kaustubh-agarwal'],
];

const pick = (rules, name) => {
  const rule = rules.find(([pattern]) => pattern.test(String(name || '').trim()));
  return rule ? img(rule[1]) : null;
};

async function plan(FestOrganizer, Competition) {
  const fests = await FestOrganizer.find({ _id: { $in: FEST_IDS } })
    .select('festName coverImage coverImages galleryImages artists competitions').lean();
  const festOps = [];
  const competitionOps = [];
  const backup = { createdAt: new Date().toISOString(), source: 'restore-aarohan-images', fests: [], competitions: [] };
  const lines = [];

  for (const fest of fests) {
    const set = {};
    if (isDeadOrEmpty(fest.coverImage)) set.coverImage = FEST_COVER;
    for (const slot of COVER_SLOTS) {
      if (isDead(fest.coverImages?.[slot])) set[`coverImages.${slot}`] = FEST_COVER;
    }
    const gallery = Array.isArray(fest.galleryImages) ? fest.galleryImages : [];
    if (gallery.some(isDead)) {
      const kept = gallery.filter((url) => url && !isDead(url));
      set.galleryImages = [...kept, ...FEST_GALLERY.filter((url) => !kept.includes(url))].slice(0, Math.max(gallery.length, FEST_GALLERY.length));
    }
    const artists = Array.isArray(fest.artists) ? fest.artists : [];
    artists.forEach((artist, index) => {
      const replacement = isDeadOrEmpty(artist.image) ? pick(ARTIST_IMAGES, artist.name) : null;
      if (replacement) set[`artists.${index}.image`] = replacement;
      else if (isDead(artist.image)) lines.push(`  ! ${fest.festName}: no real photo for artist "${artist.name}" (left unchanged)`);
    });
    if (Object.keys(set).length) {
      backup.fests.push({ id: String(fest._id), coverImage: fest.coverImage, coverImages: fest.coverImages, galleryImages: fest.galleryImages, artists: fest.artists });
      festOps.push({ updateOne: { filter: { _id: fest._id }, update: { $set: set } } });
      lines.push(`${fest.festName}: ${Object.keys(set).join(', ')}`);
    }

    const competitions = await Competition.find({ _id: { $in: fest.competitions || [] } }).select('name coverImage gallery').lean();
    for (const competition of competitions) {
      const compSet = {};
      const replacement = pick(COMPETITION_IMAGES, competition.name);
      if (replacement && isDeadOrEmpty(competition.coverImage)) compSet.coverImage = replacement;
      else if (!replacement && isDeadOrEmpty(competition.coverImage)) lines.push(`  ! ${fest.festName}: no real photo for competition "${competition.name}" (left unchanged)`);
      if ((competition.gallery || []).some(isDead)) compSet.gallery = competition.gallery.filter((url) => url && !isDead(url));
      if (Object.keys(compSet).length) {
        backup.competitions.push({ id: String(competition._id), coverImage: competition.coverImage, gallery: competition.gallery });
        competitionOps.push({ updateOne: { filter: { _id: competition._id }, update: { $set: compSet } } });
        lines.push(`  ${competition.name}: ${compSet.coverImage ? compSet.coverImage.replace(BASE, '') : '(gallery cleanup only)'}`);
      }
    }
  }
  return { festOps, competitionOps, backup, lines, festCount: fests.length };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set; nothing was changed');
  const args = process.argv.slice(2);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    const FestOrganizer = require('../src/model/fest_organizer_model');
    const Competition = require('../src/model/competition_model');
    const { CatalogImageRecoveryBackup } = require('../src/controllers/adminCatalogImageRecoveryController');

    if (args[0] === '--rollback') {
      const record = await CatalogImageRecoveryBackup.findById(args[1]).lean();
      if (!record) throw new Error(`No backup found with id ${args[1]}`);
      for (const row of record.backup.fests || []) {
        const { id, ...fields } = row;
        await FestOrganizer.updateOne({ _id: id }, { $set: fields });
      }
      for (const row of record.backup.competitions || []) {
        await Competition.updateOne({ _id: row.id }, { $set: { coverImage: row.coverImage, gallery: row.gallery } });
      }
      console.log(`Restored ${record.backup.fests.length} fests and ${record.backup.competitions.length} competitions from ${args[1]}`);
      return;
    }

    const { festOps, competitionOps, backup, lines, festCount } = await plan(FestOrganizer, Competition);
    console.log(`Found ${festCount}/${FEST_IDS.length} Aarohan fests.`);
    console.log(lines.join('\n') || 'Nothing to change.');
    if (args[0] !== '--apply') {
      console.log(`\nDry run: ${festOps.length} fests and ${competitionOps.length} competitions would change. Re-run with --apply to write.`);
      return;
    }
    if (!festOps.length && !competitionOps.length) return;
    const record = await CatalogImageRecoveryBackup.create({ backup });
    if (festOps.length) await FestOrganizer.bulkWrite(festOps, { ordered: false });
    if (competitionOps.length) await Competition.bulkWrite(competitionOps, { ordered: false });
    console.log(`\nApplied: ${festOps.length} fests, ${competitionOps.length} competitions. Backup id: ${record._id}`);
    console.log(`Undo with: node scripts/restore-aarohan-images.js --rollback ${record._id}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
