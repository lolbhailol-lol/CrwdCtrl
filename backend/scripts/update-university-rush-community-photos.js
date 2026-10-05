/**
 * Attach THE RUSH community photos to University Rush:
 * - portrait / WhatsApp → keep event poster
 * - wide / upcoming card → landscape community shot
 * - hero gallery (images[]) → all 4 community photos
 *
 * Run: node scripts/update-university-rush-community-photos.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');

const SLUG = 'university-rush-sppu-27-sep-2026';
const DIR = path.join(__dirname, 'assets', 'the-rush-community');

const FILES = [
  { file: 'dance-crowd-portrait.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-dance', key: 'dance' },
  { file: 'group-banner-landscape.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-group-banner', key: 'groupBanner' },
  { file: 'plank-session-portrait.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-plank', key: 'plank' },
  { file: 'group-cheer-landscape.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-group-cheer', key: 'groupCheer' },
  // Separate public_id so wide-card URL ≠ gallery URL (detail hero filters cover slots).
  { file: 'group-banner-landscape.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-upcoming-wide', key: 'upcomingWide' },
];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadOne({ file, id }) {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) throw new Error(`Missing ${full}`);
  const uploaded = await cloudinary.uploader.upload(full, {
    public_id: id,
    overwrite: true,
    resource_type: 'image',
  });
  return uploaded.secure_url;
}

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary config required');
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const event = await SportsEvent.findOne({ slug: SLUG });
  if (!event) throw new Error(`Event not found: ${SLUG}`);

  const poster =
    event.coverImages?.portrait
    || event.coverImage
    || '';
  if (!poster) throw new Error('Poster URL missing on event — run create-the-rush-university-rush.js first');

  const uploaded = {};
  for (const item of FILES) {
    uploaded[item.key] = await uploadOne(item);
  }
  const { dance, groupBanner, plank, groupCheer, upcomingWide } = uploaded;

  // Upcoming wide card uses community energy shot.
  // Portrait + WhatsApp keep the designed poster.
  // Hero gallery = all 4 photos (URLs distinct from cover slots).
  event.coverImages = {
    ...(event.coverImages && typeof event.coverImages === 'object' ? event.coverImages.toObject?.() || event.coverImages : {}),
    portrait: poster,
    page: poster,
    square: poster,
    wide: upcomingWide,
    landscape: upcomingWide,
    hero: poster,
    video: upcomingWide,
  };
  event.coverImage = poster;
  event.images = [dance, groupBanner, plank, groupCheer];
  event.markModified('coverImages');
  event.markModified('images');
  await event.save();

  console.log(JSON.stringify({
    ok: true,
    slug: event.slug,
    portraitWhatsApp: poster,
    upcomingWide,
    heroGallery: event.images,
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
