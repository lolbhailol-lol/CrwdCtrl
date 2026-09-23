/**
 * Apply Kshitij Pune Multicity organizer content + asset updates from local backend assets.
 * Usage (from backend/): node scripts/update-kshitij-pune-2026-content.js [--dry-run]
 *
 * - Brand logo hero (cover-wide / cover-portrait)
 * - Gallery: Kshitij ’25 set + strong event extras from covers-2026
 * - Per-event competition covers
 * - Description, clear judgingCriteria + winner claim, duration → rules
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');

const DRY = process.argv.includes('--dry-run');
const ASSETS = path.join(__dirname, 'assets/kshitij-pune-regionals');
const COVERS_DIR = path.join(ASSETS, 'compressed/covers-2026');
const GALLERY_DIR = path.join(ASSETS, 'compressed/gallery-25');

const SLUG = 'kshitij-pune-multicity-event-2026';
const LEGACY_SLUG = 'kshitij-pune-regionals-2026';

const DESCRIPTION = [
  'Kshitij`26 is taking over Pune!',
  '',
  'Bringing the Kshitij experience to a new city, this edition brings together culture, competition and creativity across two action-packed days. From performing arts, gaming and sports, informals and business events, Pune is set to experience Kshitij like never before.',
].join('\n');

/** Drive folder name → competition.name in DB */
const EVENT_COVER_MAP = {
  Badminton: 'Shuttle Showdown',
  'Bollywood group dance': 'Bollywood Dhamaka',
  'Bollywood solo singing': 'Sur Taal',
  'Family Feud': 'Know It All',
  FIFA: 'Kick and Conquer',
};

/** Extra gallery photos (strong event shots) — after the ’25 set */
const GALLERY_EXTRAS = [
  { rel: 'cover-photo.jpg', id: 'extra-01-concert-fireworks' },
  { rel: path.join('Bollywood group dance', 'E16A8450.jpg'), id: 'extra-02-bollywood-group-dance' },
  { rel: path.join('Bollywood solo singing', '7RV08735.jpg'), id: 'extra-03-bollywood-solo' },
  { rel: path.join('Family Feud', 'DSC05854.jpg'), id: 'extra-04-family-feud' },
  { rel: path.join('FIFA', 'DSC05573.jpg'), id: 'extra-05-fifa' },
  { rel: path.join('IPL auction', '449A8780.jpg'), id: 'extra-06-ipl-auction' },
  { rel: path.join('Badminton', 'download (28).jpg'), id: 'extra-07-badminton' },
];

const PERFORMANCE_DURATION = {
  'Sur Taal': 'Performance duration: 1-2 minutes.',
  'Bollywood Dhamaka': 'Performance duration: 2-3 minutes.',
};

/** Cash prize for 1st place only */
const PRIZE_BY_NAME = {
  'Bollywood Dhamaka': '1st Place: ₹6,000/-',
};
const DEFAULT_PRIZE = '1st Place: ₹2,000/-';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function firstImageInDir(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp|gif|heic)$/i.test(f) || !path.extname(f))
    .map((f) => path.join(dir, f))
    .filter((p) => fs.statSync(p).isFile() && fs.statSync(p).size > 1000);
  files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  return files[0] || null;
}

function listGalleryImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => path.join(dir, f))
    .filter((p) => fs.statSync(p).isFile() && fs.statSync(p).size > 1000)
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

async function uploadLocal(filePath, publicId) {
  if (DRY) {
    console.log(`[dry-run] upload ${filePath} → ${publicId}`);
    return { secure_url: `dry-run://${publicId}` };
  }
  return cloudinary.uploader.upload(filePath, {
    public_id: publicId,
    overwrite: true,
    resource_type: 'image',
  });
}

function stripDurationFromText(text) {
  return String(text || '')
    .replace(/\s*Performance duration:\s*[\d.]+\s*-\s*[\d.]+\s*minutes\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

function ensureDurationInRules(rules, durationLine) {
  const list = Array.isArray(rules) ? rules.map((r) => String(r).trim()).filter(Boolean) : [];
  const without = list.filter((r) => !/performance\s+duration/i.test(r));
  if (!durationLine) return without;
  if (without.some((r) => r.toLowerCase() === durationLine.toLowerCase())) return without;
  return [durationLine, ...without];
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required');
  if (!DRY && !process.env.CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary configuration is required');

  const brandWide = path.join(ASSETS, 'cover-wide.jpg');
  const brandPortrait = path.join(ASSETS, 'cover-portrait.jpg');
  if (!fs.existsSync(brandWide) || !fs.existsSync(brandPortrait)) {
    throw new Error('Original Kshitij cover-wide.jpg / cover-portrait.jpg missing under assets');
  }

  const galleryFiles = listGalleryImages(GALLERY_DIR);
  if (galleryFiles.length < 1) throw new Error(`No gallery images in ${GALLERY_DIR}`);

  console.log(`Hero: ${brandWide}`);
  console.log(`Gallery ’25: ${galleryFiles.length}`);
  console.log(`Gallery extras: ${GALLERY_EXTRAS.length}`);

  const coverUp = await uploadLocal(
    brandWide,
    'crwdctrl/fests/kshitij-pune-regionals-2026/cover-wide',
  );
  const portraitUp = await uploadLocal(
    brandPortrait,
    'crwdctrl/fests/kshitij-pune-regionals-2026/cover-portrait',
  );

  // 1) Concert opener first
  const galleryUrls = [];
  const concert = path.join(COVERS_DIR, 'cover-photo.jpg');
  if (fs.existsSync(concert)) {
    const up = await uploadLocal(
      concert,
      'crwdctrl/fests/kshitij-pune-regionals-2026/gallery/extra-01-concert-fireworks',
    );
    galleryUrls.push(up.secure_url);
  }

  // 2) Full Kshitij ’25 set from backend assets
  for (let i = 0; i < galleryFiles.length; i += 1) {
    const file = galleryFiles[i];
    const up = await uploadLocal(
      file,
      `crwdctrl/fests/kshitij-pune-regionals-2026/gallery/${String(i + 1).padStart(2, '0')}-${path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    );
    galleryUrls.push(up.secure_url);
  }

  // 3) Remaining event extras (skip concert already added)
  for (const extra of GALLERY_EXTRAS) {
    if (extra.id === 'extra-01-concert-fireworks') continue;
    const file = path.join(COVERS_DIR, extra.rel);
    if (!fs.existsSync(file)) {
      console.warn(`Missing gallery extra ${extra.id}`);
      continue;
    }
    const up = await uploadLocal(
      file,
      `crwdctrl/fests/kshitij-pune-regionals-2026/gallery/${extra.id}`,
    );
    galleryUrls.push(up.secure_url);
  }

  const eventCoverUrls = {};
  for (const [folder, compName] of Object.entries(EVENT_COVER_MAP)) {
    const img = firstImageInDir(path.join(COVERS_DIR, folder));
    if (!img) {
      console.warn(`Missing event cover for ${compName} (${folder})`);
      continue;
    }
    const up = await uploadLocal(
      img,
      `crwdctrl/fests/kshitij-pune-regionals-2026/competitions/${compName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    );
    eventCoverUrls[compName] = up.secure_url;
  }

  // Boardroom: use IPL auction shot as best available business-event photo
  const boardroomImg = firstImageInDir(path.join(COVERS_DIR, 'IPL auction'));
  if (boardroomImg) {
    const up = await uploadLocal(
      boardroomImg,
      'crwdctrl/fests/kshitij-pune-regionals-2026/competitions/the-boardroom',
    );
    eventCoverUrls['The Boardroom Battle'] = up.secure_url;
    eventCoverUrls['The Boardroom'] = up.secure_url;
  }

  await mongoose.connect(uri);
  const fest = await Fest.findOne({
    $or: [
      { slug: SLUG },
      { slug: LEGACY_SLUG },
      { previousSlugs: LEGACY_SLUG },
      { festName: /^Kshitij Pune (?:Regionals|Multicity(?: Event)?)$/i },
    ],
  });
  if (!fest) throw new Error('Kshitij fest not found');

  const festSet = {
    description: DESCRIPTION,
    coverImage: coverUp.secure_url,
    coverImages: {
      ...(fest.coverImages?.toObject?.() || fest.coverImages || {}),
      page: coverUp.secure_url,
      wide: coverUp.secure_url,
      landscape: coverUp.secure_url,
      hero: coverUp.secure_url,
      portrait: portraitUp.secure_url,
    },
    galleryImages: galleryUrls,
  };

  console.log(`Fest ${fest.festName} (${fest.slug}) dryRun=${DRY} gallery=${galleryUrls.length}`);
  if (!DRY) {
    Object.assign(fest, festSet);
    await fest.save();
  }

  const comps = await Competition.find({ fest: fest._id });
  for (const comp of comps) {
    const set = {
      judgingCriteria: [],
      prizePool: PRIZE_BY_NAME[comp.name] || DEFAULT_PRIZE,
    };

    if (eventCoverUrls[comp.name]) {
      set.coverImage = eventCoverUrls[comp.name];
      set.gallery = [eventCoverUrls[comp.name]];
    }

    let description = stripDurationFromText(comp.description);
    const durationLine = PERFORMANCE_DURATION[comp.name];
    if (durationLine) {
      set.commonRules = ensureDurationInRules(comp.commonRules, durationLine);
      description = stripDurationFromText(description);
      set.description = description;
    } else if (description !== (comp.description || '')) {
      set.description = description;
    }

    if (Array.isArray(comp.rounds) && durationLine) {
      set.rounds = comp.rounds.map((round) => {
        const next = round.toObject ? round.toObject() : { ...round };
        next.description = stripDurationFromText(next.description);
        next.rules = ensureDurationInRules(next.rules, durationLine);
        return next;
      });
    }

    console.log(`  ${comp.name}: ok${eventCoverUrls[comp.name] ? ' +cover' : ''}${durationLine ? ' +duration' : ''}`);
    if (!DRY) {
      await Competition.findByIdAndUpdate(comp._id, { $set: set }, { runValidators: true });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: DRY,
    festId: String(fest._id),
    slug: fest.slug,
    gallery: galleryUrls.length,
    eventCovers: Object.keys(eventCoverUrls),
  }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState) await mongoose.disconnect();
    });
}
