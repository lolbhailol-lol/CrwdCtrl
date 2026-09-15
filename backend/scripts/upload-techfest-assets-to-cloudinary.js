/**
 * Upload Techfest local public assets to Cloudinary (same storage as admin dashboard),
 * then update the fest coverImage + galleryImages with secure URLs.
 *
 * Usage: node scripts/upload-techfest-assets-to-cloudinary.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');

const SLUG = 'techfest-iit-bombay-2026';
const FOLDER = 'crwdctrl/fests/techfest';
const PUBLIC_ROOT = path.resolve(__dirname, '../../frontend/public/fests/techfest');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ASSETS = [
  { local: 'theme-logo.webp', publicId: `${FOLDER}/theme-logo`, role: 'cover' },
  { local: 'gallery/compi2.webp', publicId: `${FOLDER}/gallery/compi2`, role: 'gallery' },
  { local: 'gallery/compi1.webp', publicId: `${FOLDER}/gallery/compi1`, role: 'gallery' },
  { local: 'gallery/ws1.png', publicId: `${FOLDER}/gallery/ws1`, role: 'gallery' },
  { local: 'gallery/ws2.png', publicId: `${FOLDER}/gallery/ws2`, role: 'gallery' },
  { local: 'gallery/exhi1.jpeg', publicId: `${FOLDER}/gallery/exhi1`, role: 'gallery' },
  { local: 'gallery/exhi2.jpeg', publicId: `${FOLDER}/gallery/exhi2`, role: 'gallery' },
  { local: 'gallery/exhi3.jpeg', publicId: `${FOLDER}/gallery/exhi3`, role: 'gallery' },
  { local: 'gallery/exhi4.jpeg', publicId: `${FOLDER}/gallery/exhi4`, role: 'gallery' },
  { local: 'gallery/edm1.webp', publicId: `${FOLDER}/gallery/edm1`, role: 'gallery' },
  { local: 'gallery/edm2.webp', publicId: `${FOLDER}/gallery/edm2`, role: 'gallery' },
  { local: 'gallery/edm3.webp', publicId: `${FOLDER}/gallery/edm3`, role: 'gallery' },
  { local: 'gallery/lec1.jpeg', publicId: `${FOLDER}/gallery/lec1`, role: 'gallery' },
  { local: 'gallery/lec2.jpeg', publicId: `${FOLDER}/gallery/lec2`, role: 'gallery' },
  { local: 'gallery/lec3.jpeg', publicId: `${FOLDER}/gallery/lec3`, role: 'gallery' },
  { local: 'gallery/lec4.jpeg', publicId: `${FOLDER}/gallery/lec4`, role: 'gallery' },
];

async function uploadOne(asset) {
  const abs = path.join(PUBLIC_ROOT, asset.local);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing file: ${abs}`);
  }
  const result = await cloudinary.uploader.upload(abs, {
    public_id: asset.publicId,
    folder: undefined,
    overwrite: true,
    resource_type: 'image',
  });
  console.log('  uploaded', asset.local, '→', result.secure_url.slice(0, 80) + '…');
  return result.secure_url;
}

(async () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.MONGODB_URI) {
    throw new Error('CLOUDINARY_* and MONGODB_URI required');
  }

  console.log('Uploading Techfest assets from', PUBLIC_ROOT);
  const urls = {};
  for (const asset of ASSETS) {
    urls[asset.local] = await uploadOne(asset);
  }

  const coverImage = urls['theme-logo.webp'];
  const galleryImages = ASSETS.filter((a) => a.role === 'gallery').map((a) => urls[a.local]);

  await mongoose.connect(process.env.MONGODB_URI);
  const fest = await Fest.findOne({ slug: SLUG });
  if (!fest) throw new Error(`Fest not found: ${SLUG}`);

  fest.coverImage = coverImage;
  fest.galleryImages = galleryImages;
  await fest.save();

  const mapPath = path.join(__dirname, 'techfest-cloudinary-urls.json');
  fs.writeFileSync(
    mapPath,
    JSON.stringify({ coverImage, galleryImages, uploadedAt: new Date().toISOString() }, null, 2),
  );

  console.log('\nUpdated fest', fest._id.toString());
  console.log('coverImage:', coverImage);
  console.log('galleryImages:', galleryImages.length);
  console.log('URL map written:', mapPath);

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
