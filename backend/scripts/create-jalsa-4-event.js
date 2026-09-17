/**
 * Upsert Jalsa 4.0 event show from organiser WhatsApp brief (Sep 2026).
 * Run: node scripts/create-jalsa-4-event.js
 */
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const EventShow = require('../src/model/event_show_model');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TITLE = 'Jalsa 4.0';
const POSTER_LOCAL = path.join(__dirname, 'assets/jalsa-4/poster.png');
const POSTER_FALLBACK =
  'https://res.cloudinary.com/dyonimhgb/image/upload/v1789663442/crwdctrl/events/jalsa-4/poster.jpg';

const TIERS = [
  {
    id: 'tier_ga',
    name: 'GA',
    description: 'General Admission — 1 person',
    fee: 399,
    participantCount: 1,
    inclusions: ['GA entry for 1', 'Access to main dance floor'],
    order: 0,
  },
  {
    id: 'tier_vip',
    name: 'VIP',
    description: 'VIP — 1 person',
    fee: 599,
    participantCount: 1,
    inclusions: ['VIP entry for 1', 'VIP zone access'],
    order: 1,
  },
  {
    id: 'tier_couple_ga',
    name: 'Couple GA',
    description: 'General Admission — couple (2 people)',
    fee: 749,
    participantCount: 2,
    inclusions: ['GA entry for 2', 'Access to main dance floor'],
    order: 2,
  },
  {
    id: 'tier_couple_vip',
    name: 'Couple VIP',
    description: 'VIP — couple (2 people)',
    fee: 999,
    participantCount: 2,
    inclusions: ['VIP entry for 2', 'VIP zone access'],
    order: 3,
  },
  {
    id: 'tier_group5_ga',
    name: 'Group of 5 · GA',
    description: 'General Admission — group of 5',
    fee: 1799,
    participantCount: 5,
    inclusions: ['GA entry for 5', 'Access to main dance floor'],
    order: 4,
  },
  {
    id: 'tier_group5_vip',
    name: 'Group of 5 · VIP',
    description: 'VIP — group of 5',
    fee: 2699,
    participantCount: 5,
    inclusions: ['VIP entry for 5', 'VIP zone access'],
    order: 5,
  },
  {
    id: 'tier_group10_ga',
    name: 'Group of 10 · GA',
    description: 'General Admission — group of 10',
    fee: 3399,
    participantCount: 10,
    inclusions: ['GA entry for 10', 'Access to main dance floor'],
    order: 6,
  },
  {
    id: 'tier_group10_vip',
    name: 'Group of 10 · VIP',
    description: 'VIP — group of 10',
    fee: 5399,
    participantCount: 10,
    inclusions: ['VIP entry for 10', 'VIP zone access'],
    order: 7,
  },
];

const DESCRIPTION = [
  'Jalsa 4.0 — a night of music, dance, and celebration in Pune.',
  '',
  'Featuring Artist: Sourabh Raaj Jain',
  'Expected crowd: 10,000+',
  '',
  'Join thousands for an unforgettable evening at Vardhaman Lawns.',
].join('\n');

const WHATS_INCLUDED = [
  'Entry as per selected ticket tier (GA / VIP)',
  'Live performance by Sourabh Raaj Jain',
  'Dance floor access',
].join('\n');

const REGISTRATION_PROCESS = [
  'Choose a ticket tier (solo, couple, or group).',
  'Complete registration with guest details for every person on the ticket.',
  'Pay online to confirm your booking.',
  'Show your QR ticket at the gate for check-in.',
].join('\n');

const GENERAL_RULES = [
  'Valid QR ticket required at entry.',
  'Follow venue security and organiser instructions at all times.',
  'Outside food and beverages may not be allowed — follow gate rules.',
  'Management reserves the right to refuse entry for safety or misconduct.',
  'Tickets are non-transferable unless approved by the organiser.',
].join('\n');

async function resolvePosterUrl() {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const fs = require('fs');
      if (fs.existsSync(POSTER_LOCAL)) {
        const up = await cloudinary.uploader.upload(POSTER_LOCAL, {
          folder: 'crwdctrl/events/jalsa-4',
          public_id: 'poster',
          overwrite: true,
          resource_type: 'image',
        });
        return up.secure_url;
      }
    } catch (err) {
      console.warn('Poster upload failed, using fallback:', err.message);
    }
  }
  return POSTER_FALLBACK;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const posterUrl = await resolvePosterUrl();

  const payload = {
    title: TITLE,
    displayName: 'Jalsa 4.0',
    description: DESCRIPTION,
    eventType: 'musical',
    eventHeading: 'Live Night · Garba / Celebration',
    organizer: 'Jalsa',
    cast: ['Sourabh Raaj Jain'],
    venue: 'Vardhaman Lawns',
    city: 'Pune',
    mapUrl: '',
    showTimings: [
      { date: new Date('2026-10-18T12:00:00.000Z'), time: '5 PM onwards' },
    ],
    duration: 'Night',
    gatesOpen: '5:00 PM',
    endsAt: '11:00 PM',
    language: 'Hindi / Marathi',
    ageRating: '',
    ticketPrice: 399,
    pricingMode: 'tiers',
    tiers: TIERS,
    addOns: [],
    platformFeePercent: 2,
    seatingCapacity: 10000,
    priceLabel: '399/- onwards',
    performerDetails: 'Sourabh Raaj Jain',
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
      'Gates open — check your ticket SMS / app for exact time.',
      'Artist: Sourabh Raaj Jain',
      'Dance and celebration through the night.',
    ].join('\n'),
    prizePool: '',
    whatsIncluded: WHATS_INCLUDED,
    benefits: '',
    eligibility: '',
    dressCode: [
      '💃 Women: Chaniya choli or lehenga — light fabric, easy to spin.',
      '🕺 Men: Kediyu or kurta — festive and comfortable for long sets.',
      '👟 Tip: Soft footwear; pin dupattas and keep jewellery light.',
    ].join('\n'),
    slots: '10,000 capacity',
    registrationProcess: REGISTRATION_PROCESS,
    rounds: [],
    contacts: [
      {
        name: 'Organiser',
        role: 'Booking / Info',
        phone: '+91 96659 94939',
      },
    ],
    galleryImages: [],
    registration: {
      status: 'open',
      mode: 'internal_form',
      formType: 'SINGLE_STEP',
      formSchema: [
        {
          id: 'f_name',
          label: 'Full Name',
          fieldName: 'full_name',
          type: 'text',
          required: true,
          placeholder: 'Your full name',
          options: [],
        },
        {
          id: 'f_phone',
          label: 'Phone',
          fieldName: 'phone',
          type: 'tel',
          required: true,
          placeholder: '10-digit mobile',
          options: [],
        },
        {
          id: 'f_email',
          label: 'Email',
          fieldName: 'email',
          type: 'email',
          required: true,
          placeholder: 'you@email.com',
          options: [],
        },
      ],
      steps: [],
      googleSheetsUrl: '',
      allowCoupons: true,
      paymentQR: '',
      paymentQRMessage: '',
      paymentUpiId: '',
      qrAutoConfirm: false,
    },
    pageSection: 'spotlight',
    pagePriority: 1,
    status: 'published',
  };

  const existing = await EventShow.findOne({ title: /^Jalsa\s*4\.0$/i });
  let doc;
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    doc = existing;
    console.log('Updated Jalsa 4.0:', doc._id.toString());
  } else {
    doc = await EventShow.create(payload);
    console.log('Created Jalsa 4.0:', doc._id.toString());
  }

  console.log(JSON.stringify({
    id: doc._id.toString(),
    title: doc.title,
    venue: doc.venue,
    city: doc.city,
    poster: doc.poster,
    date: doc.showTimings?.[0]?.date,
    tiers: doc.tiers?.map((t) => ({ name: t.name, fee: t.fee, people: t.participantCount })),
    registration: doc.registration?.status,
    pageSection: doc.pageSection,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
