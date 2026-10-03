/**
 * Upsert Radhe Radhe Dandiya Night 2026 (Phool Wali Ladki) + its organizer login.
 * Offline pass flow: guests request a pass, organizer calls back, pass delivered with cash on delivery.
 * Run: node scripts/create-radhe-radhe-dandiya-event.js
 */
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const EventShow = require('../src/model/event_show_model');
const EventShowOrganizerAccount = require('../src/model/event_show_organizer_account_model');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TITLE = 'Radhe Radhe Dandiya Night 2026';
const ORGANIZER_USERNAME = 'radhe';
const POSTER_LOCAL = path.join(__dirname, 'assets/radhe-radhe/poster.jpg');

const TIERS = [
  { id: 'tier_kids', name: 'Kids Below 5 Yrs', description: 'Entry for 1 child below 5 years', fee: 199, participantCount: 1, inclusions: ['Entry for 1 child (below 5 yrs)'], order: 0 },
  { id: 'tier_general', name: 'General Pass (Only Entry)', description: 'Only entry · Fast filling', fee: 599, participantCount: 1, inclusions: ['Entry for 1'], order: 1 },
  { id: 'tier_couple_p1', name: 'Couple Pass - Phase 1', description: 'Entry for 2 people', fee: 1199, participantCount: 2, inclusions: ['Entry for 2'], order: 2 },
  { id: 'tier_vip', name: 'VIP Pass', description: 'VIP entry for 1', fee: 1599, participantCount: 1, inclusions: ['VIP entry for 1'], order: 3 },
  { id: 'tier_group5', name: 'Group of 5', description: 'Entry for 5 people', fee: 2599, participantCount: 5, inclusions: ['Entry for 5'], order: 4 },
  { id: 'tier_group10', name: 'Group of 10', description: 'Entry for 10 people', fee: 4999, participantCount: 10, inclusions: ['Entry for 10'], order: 5 },
];

const OFFLINE_SUCCESS_MESSAGE =
  'You will get a call from the Radhe Radhe Dandiya Night team for cash on delivery and offline pass delivery.';

const DESCRIPTION = [
  '🌸 PHOOL WALI LADKI IS COMING TO PUNE! 🌸',
  '',
  'The energy, the garba, the madness — it’s all getting bigger this year. 🔥',
  '',
  '✨ Celebrity appearance: Akanksha Choudhary aka Phool Wali Ladki (Splitsvilla & Lock Upp fame)',
  '🎧 DJ Dev Mutha — Special Bollywood Dandiya Set',
  '🎤 Emcee: Anchor Neetu Bhatia',
  '',
  'Pune’s OG Dandiya Night is back for its 11th year — Garba • Music • Masti.',
  '',
  'Presented by Good Times Entertainment × Radhe Radhe Dandiya Night.',
  'Artist managed by Akshay Thorat.',
  'Instagram: @radhe_radhe_dandiya_night',
].join('\n');

const WHATS_INCLUDED = [
  'Entry as per selected ticket',
  'Celebrity appearance by Akanksha Choudhary (Phool Wali Ladki)',
  'Special Bollywood Dandiya set by DJ Dev Mutha',
  'Dance floor access',
].join('\n');

const REGISTRATION_PROCESS = [
  'Choose your pass.',
  'Fill in your name, phone and delivery address, then submit your request.',
  'The Radhe Radhe team will call you to confirm.',
  'Your pass is delivered to your address — pay cash on delivery.',
].join('\n');

const GENERAL_RULES = [
  'Valid QR ticket required at entry.',
  'Follow venue security and organiser instructions at all times.',
  'Outside food and beverages may not be allowed — follow gate rules.',
  'Management reserves the right to refuse entry for safety or misconduct.',
  'Tickets are non-transferable unless approved by the organiser.',
].join('\n');

async function resolvePosterUrl() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !fs.existsSync(POSTER_LOCAL)) return '';
  const up = await cloudinary.uploader.upload(POSTER_LOCAL, {
    folder: 'crwdctrl/events/radhe-radhe-2026',
    public_id: 'poster',
    overwrite: true,
    resource_type: 'image',
  });
  return up.secure_url;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const posterUrl = await resolvePosterUrl();
  if (!posterUrl) throw new Error('Poster upload failed — check CLOUDINARY_* env and poster file');

  const payload = {
    title: TITLE,
    displayName: TITLE,
    description: DESCRIPTION,
    eventType: 'musical',
    eventHeading: 'Dandiya Night · Garba / Navratri',
    organizer: 'Radhe Radhe Dandiya Night',
    cast: ['Akanksha Choudhary (Phool Wali Ladki)', 'DJ Dev Mutha'],
    venue: 'Yash Lawns, Bibwewadi',
    city: 'Pune',
    mapUrl: '',
    showTimings: [
      { date: new Date('2026-10-16T11:30:00.000Z'), time: '5 PM onwards' },
    ],
    duration: 'Night',
    gatesOpen: '5:00 PM',
    language: 'Hindi / Gujarati / Marathi',
    ticketPrice: 199,
    pricingMode: 'tiers',
    tiers: TIERS,
    addOns: [],
    platformFeePercent: 0,
    priceLabel: '₹199 onwards · Pay on delivery',
    performerDetails: 'Akanksha Choudhary aka Phool Wali Ladki (celebrity appearance) · DJ Dev Mutha (Bollywood Dandiya set) · Emcee Neetu Bhatia',
    poster: posterUrl,
    banner: posterUrl,
    coverImages: {
      page: posterUrl,
      wide: posterUrl,
      landscape: posterUrl,
      hero: posterUrl,
      portrait: posterUrl,
    },
    generalRules: GENERAL_RULES,
    process: [
      'Gates open at 5 PM.',
      'Akanksha Choudhary (Phool Wali Ladki) appearance + DJ Dev Mutha Bollywood Dandiya set.',
      'Dandiya and garba through the night.',
    ].join('\n'),
    whatsIncluded: WHATS_INCLUDED,
    dressCode: [
      '💃 Women: Chaniya choli or lehenga — light fabric, easy to spin.',
      '🕺 Men: Kediyu or kurta — festive and comfortable for long sets.',
      '👟 Tip: Soft footwear; pin dupattas and keep jewellery light.',
    ].join('\n'),
    registrationProcess: REGISTRATION_PROCESS,
    rounds: [],
    contacts: [
      { name: 'Passes & Sponsorship', role: 'Booking / Info', phone: '+91 77740 40923' },
      { name: 'Passes & Sponsorship', role: 'Booking / Info', phone: '+91 95959 20091' },
    ],
    galleryImages: [],
    registration: {
      status: 'open',
      mode: 'offline_cod',
      offlineSuccessMessage: OFFLINE_SUCCESS_MESSAGE,
      commissionPercent: 5,
      formType: 'SINGLE_STEP',
      formSchema: [
        { id: 'f_name', label: 'Full Name', fieldName: 'full_name', type: 'text', required: true, placeholder: 'Your full name', options: [] },
        { id: 'f_phone', label: 'Phone', fieldName: 'phone', type: 'tel', required: true, placeholder: '10-digit mobile', options: [] },
        { id: 'f_email', label: 'Email', fieldName: 'email', type: 'email', required: true, placeholder: 'you@email.com', options: [] },
        { id: 'f_address', label: 'Pass Delivery Address', fieldName: 'address', type: 'textarea', required: true, placeholder: 'House / flat, street, area, landmark, pincode', options: [] },
      ],
      steps: [],
      googleSheetsUrl: '',
      allowCoupons: false,
      paymentQR: '',
      paymentQRMessage: '',
      paymentUpiId: '',
      qrAutoConfirm: false,
    },
    pageSection: 'spotlight',
    pagePriority: 2,
    status: 'published',
  };

  const existing = await EventShow.findOne({ title: /^Radhe\s*Radhe\s*Dandiya\s*Night/i });
  let doc;
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    doc = existing;
    console.log('Updated event:', doc._id.toString());
  } else {
    doc = await EventShow.create(payload);
    console.log('Created event:', doc._id.toString());
  }

  let account = await EventShowOrganizerAccount.findOne({ username: ORGANIZER_USERNAME });
  let password = null;
  if (account) {
    const ids = (account.assignedEventShowIds || []).map(String);
    if (!ids.includes(doc._id.toString())) {
      account.assignedEventShowIds.push(doc._id);
      await account.save();
    }
    console.log(`Organizer "${ORGANIZER_USERNAME}" already exists — event assigned, password unchanged.`);
  } else {
    password = crypto.randomBytes(6).toString('base64url');
    account = await EventShowOrganizerAccount.create({
      name: 'Radhe Radhe Dandiya Night',
      username: ORGANIZER_USERNAME,
      passwordHash: await EventShowOrganizerAccount.hashPassword(password),
      assignedEventShowIds: [doc._id],
      status: 'approved',
      isActive: true,
      approvedAt: new Date(),
    });
    console.log(`Created organizer "${ORGANIZER_USERNAME}".`);
  }

  console.log(JSON.stringify({
    id: doc._id.toString(),
    title: doc.title,
    venue: doc.venue,
    date: doc.showTimings?.[0]?.date,
    status: doc.status,
    registration: doc.registration?.status,
    organizerUsername: ORGANIZER_USERNAME,
    organizerPassword: password || '(unchanged)',
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
