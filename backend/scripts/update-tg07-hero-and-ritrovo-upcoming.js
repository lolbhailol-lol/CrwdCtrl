/**
 * 1) Touch Grass 07 — fill hero gallery from Delulu / past TG community photos
 * 2) Ritrovo Rush — set Ritrovo poster on portrait/WA; upcoming wide = community photo
 *
 * Run: node scripts/update-tg07-hero-and-ritrovo-upcoming.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const RunClub = require('../src/model/run_club_model');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const RITROVO_POSTER = path.join(__dirname, 'assets', 'ritrovo-rush-poster.png');

function uniq(urls = []) {
  const out = [];
  for (const u of urls) {
    const s = String(u || '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary config required');
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  // ── Touch Grass 07 hero gallery ───────────────────────────────────────
  const tg = await SportsEvent.findOne({ slug: 'touch-grass-07' });
  if (!tg) throw new Error('Touch Grass 07 not found');
  const club = await RunClub.findById(tg.runClubId).lean();
  const past = await SportsEvent.find({
    runClubId: tg.runClubId,
    _id: { $ne: tg._id },
    title: /touch\s*grass/i,
  }).select('images coverImages coverImage').lean();

  const coverSet = new Set(
    [
      tg.coverImage,
      tg.coverImages?.portrait,
      tg.coverImages?.wide,
      tg.coverImages?.hero,
      tg.coverImages?.page,
      tg.coverImages?.square,
    ].filter(Boolean),
  );

  const communityPool = uniq([
    ...(club?.galleryImages || []),
    club?.coverImages?.hero,
    club?.coverImages?.wide,
    club?.coverImages?.portrait,
    ...past.flatMap((p) => [
      ...(p.images || []),
      p.coverImages?.wide,
      p.coverImages?.hero,
    ]),
  ]).filter((u) => !coverSet.has(u));

  // Prefer a solid set for the hero swipe (poster stays in cover slots for WA)
  tg.images = communityPool.slice(0, 8);
  tg.markModified('images');
  await tg.save();

  // ── Ritrovo Rush poster + upcoming community card ─────────────────────
  const rush = await SportsEvent.findOne({ slug: 'ritrovo-rush-27-sep-2026' });
  if (!rush) throw new Error('Ritrovo Rush not found');

  if (!fs.existsSync(RITROVO_POSTER)) throw new Error(`Missing ${RITROVO_POSTER}`);
  const uploaded = await cloudinary.uploader.upload(RITROVO_POSTER, {
    public_id: 'crwdctrl/sports/the-rush/ritrovo-rush-27-sep-2026',
    overwrite: true,
    resource_type: 'image',
  });
  const posterUrl = uploaded.secure_url;

  const gallery = Array.isArray(rush.images) ? rush.images.filter(Boolean) : [];
  // Upcoming wide card — community energy shot (not the poster)
  const upcomingWide =
    gallery.find((u) => /group-banner|upcoming-wide|group-cheer|group-jog/i.test(u))
    || gallery.find((u) => u !== posterUrl)
    || 'https://res.cloudinary.com/dyonimhgb/image/upload/v1790074261/crwdctrl/sports/the-rush/university-rush-2026-group-banner.jpg';

  rush.coverImage = posterUrl;
  rush.coverImages = {
    ...(rush.coverImages?.toObject?.() || rush.coverImages || {}),
    portrait: posterUrl,
    page: posterUrl,
    hero: posterUrl,
    square: posterUrl,
    wide: upcomingWide,
    landscape: upcomingWide,
    video: upcomingWide,
  };
  // Keep gallery community photos; ensure poster not required in images[] for carousel
  rush.images = uniq(gallery.filter((u) => u !== posterUrl));
  if (!rush.images.length) rush.images = [upcomingWide];
  rush.markModified('coverImages');
  rush.markModified('images');
  await rush.save();

  console.log(JSON.stringify({
    ok: true,
    touchGrass07: {
      heroGalleryCount: tg.images.length,
      heroGallery: tg.images,
      posterKept: tg.coverImages?.portrait,
    },
    ritrovoRush: {
      poster: rush.coverImages.portrait,
      upcomingWide: rush.coverImages.wide,
      galleryCount: rush.images.length,
    },
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
