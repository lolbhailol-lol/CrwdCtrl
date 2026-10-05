/**
 * Append outdoor run gallery photos + alt phone to University Rush.
 * Run: node scripts/update-university-rush-gallery-and-phone.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const SportsEvent = require('../src/model/sports_model');
const RunClub = require('../src/model/run_club_model');

const SLUG = 'university-rush-sppu-27-sep-2026';
const ALT_PHONE = '8010463942';
const DIR = path.join(__dirname, 'assets', 'the-rush-community');

const FILES = [
  { file: 'run-street-front.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-run-street-front' },
  { file: 'crew-warmup-under-canopy.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-crew-warmup' },
  { file: 'run-from-behind-street.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-run-behind' },
  { file: 'group-jog-side.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-group-jog' },
  { file: 'crew-courtyard.png', id: 'crwdctrl/sports/the-rush/university-rush-2026-crew-courtyard' },
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
  const club = await RunClub.findById(event.runClubId).select('contactPhone contactPhones').lean();

  const urls = [];
  for (const item of FILES) {
    urls.push(await uploadOne(item));
  }

  const existing = Array.isArray(event.images) ? event.images.filter(Boolean) : [];
  const merged = [...existing];
  for (const url of urls) {
    if (!merged.includes(url)) merged.push(url);
  }
  event.images = merged;

  const primary = String(club?.contactPhone || event.contactPhone || '').trim();
  const phones = [];
  if (primary) phones.push(primary);
  if (!phones.includes(ALT_PHONE)) phones.push(ALT_PHONE);
  // Keep any other event phones already set
  for (const p of (event.contactPhones || [])) {
    const n = String(p || '').trim();
    if (n && !phones.includes(n)) phones.push(n);
  }
  event.contactPhones = phones;
  event.contactPhone = phones[0] || ALT_PHONE;

  event.markModified('images');
  event.markModified('contactPhones');
  await event.save();

  console.log(JSON.stringify({
    ok: true,
    slug: event.slug,
    galleryCount: event.images.length,
    added: urls.length,
    contactPhones: event.contactPhones,
    contactPhone: event.contactPhone,
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
