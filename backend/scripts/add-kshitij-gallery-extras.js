/**
 * Append strong Kshitij event photos to the fest gallery.
 * Usage (from backend/): node scripts/add-kshitij-gallery-extras.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ROOT = path.join(__dirname, 'assets/kshitij-pune-regionals/compressed/covers-2026');
const EXTRAS = [
  { file: path.join(ROOT, 'cover-photo.jpg'), id: 'gallery/extra-01-concert-fireworks' },
  { file: path.join(ROOT, 'Bollywood group dance/E16A8450.jpg'), id: 'gallery/extra-02-bollywood-group-dance' },
  { file: path.join(ROOT, 'Bollywood solo singing/7RV08735.jpg'), id: 'gallery/extra-03-bollywood-solo' },
  { file: path.join(ROOT, 'Family Feud/DSC05854.jpg'), id: 'gallery/extra-04-family-feud' },
  { file: path.join(ROOT, 'FIFA/DSC05573.jpg'), id: 'gallery/extra-05-fifa' },
  { file: path.join(ROOT, 'IPL auction/449A8780.jpg'), id: 'gallery/extra-06-ipl-auction' },
  { file: path.join(ROOT, 'Badminton/download (28).jpg'), id: 'gallery/extra-07-badminton' },
];

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');

  for (const item of EXTRAS) {
    if (!fs.existsSync(item.file)) throw new Error(`Missing ${item.file}`);
  }

  const uploaded = [];
  for (const item of EXTRAS) {
    const up = await cloudinary.uploader.upload(item.file, {
      public_id: `crwdctrl/fests/kshitij-pune-regionals-2026/${item.id}`,
      overwrite: true,
      resource_type: 'image',
    });
    uploaded.push({ id: item.id, url: up.secure_url });
    console.log(`up ${item.id} ${Math.round(up.bytes / 1024)}KB`);
  }

  await mongoose.connect(uri);
  const fest = await Fest.findOne({ slug: 'kshitij-pune-multicity-event-2026' });
  if (!fest) throw new Error('Kshitij fest not found');

  const existing = (Array.isArray(fest.galleryImages) ? fest.galleryImages : [])
    .filter((url) => !String(url).includes('/gallery/extra-'));

  // Fireworks first (strong opener), then existing ’25 set, then other extras
  const [fireworks, ...rest] = uploaded.map((x) => x.url);
  const merged = [fireworks, ...existing, ...rest];
  const seen = new Set();
  fest.galleryImages = merged.filter((url) => {
    const key = String(url).replace(/\/v\d+\//, '/');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await fest.save();
  console.log(JSON.stringify({ total: fest.galleryImages.length, added: uploaded.length }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
