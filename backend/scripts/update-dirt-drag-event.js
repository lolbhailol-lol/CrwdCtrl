/**
 * Rebrand Independence Day Drive EventShow → Elite Octane Dirt Drag 2026.
 * Poster + Google Form registration from organiser brief (Sep 2026).
 * Run: node scripts/update-dirt-drag-event.js
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

const EVENT_ID = '6a722ada2a151369a4a2ff03';
const POSTER_LOCAL = path.join(__dirname, 'assets/dirt-drag/poster.png');
const MAP_URL =
  'https://www.google.com/maps/search/?api=1&query=Aamby%20Valley%20City%20Air%20Strip%20Maharashtra';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const stamp = Date.now();
  const uploaded = await cloudinary.uploader.upload(POSTER_LOCAL, {
    folder: 'crwdctrl/events/dirt-drag',
    public_id: `dirt-drag-poster-${stamp}`,
    overwrite: true,
    invalidate: true,
  });
  const posterUrl = uploaded.secure_url;

  const description = [
    'DIRT DRAG — Power Meets Dirt.',
    '',
    'Presented by Elite Octane · Organised by Deccan Motorsports Klub.',
    '',
    'Timed, categorised dirt-drag runs at Aamby Valley City Air Strip, Maharashtra.',
    'Stock or modified — all enthusiasts welcome. Marshals, support crew, staging, recovery and first aid on site.',
    '',
    'All vehicles are subject to technical and safety scrutiny before participation.',
    'The organiser reserves the right to inspect, reclassify, reject or disqualify any vehicle that does not comply with applicable technical and safety regulations.',
  ].join('\n');

  const whatsIncluded = [
    'Safe environment — marshals & support crew',
    'Organised runs — timed & categorised',
    'Driver-friendly facility — staging | recovery | first aid',
    'Open to all enthusiasts — stock or modified welcome',
  ].join('\n');

  const processText = [
    'Complete competitor registration via the official Google Form.',
    'Bring your vehicle for technical and safety scrutiny on event day.',
    'Staging → timed dirt-drag runs by category → recovery support as needed.',
    'Follow all marshal and organiser instructions on site.',
  ].join('\n');

  const generalRules = [
    'Motorsport is inherently dangerous and involves risks including serious injury, death and damage to property.',
    'Participation is entirely at the competitor\'s own risk.',
    'The Organiser, its officials, marshals, staff, volunteers, sponsors, venue owners and associated personnel shall not be responsible or liable for any injury, death, loss or damage arising from participation in or attendance at the event.',
    'Competitors are responsible for their own safety, vehicle and equipment and must comply with all event rules, technical regulations and instructions issued by event officials.',
    'All vehicles are subject to technical and safety scrutiny before participation.',
  ].join('\n');

  const eligibility =
    'Open to motorsport enthusiasts with stock or modified vehicles. Valid driving licence and compliance with technical/safety regulations required. All entries subject to organiser scrutiny.';

  const registrationProcess =
    'Tap Book / Register, choose your competition class (Rs 10,000 per class), complete the in-app form, and pay online. Sign and submit the Indemnity Bond as instructed. To enter another class, register again.';

  const contacts = [
    {
      name: 'Warun Lal',
      role: 'Enquiries & Registrations',
      phone: '+919823317125',
      email: '',
      instagramId: '',
    },
    {
      name: 'Vineet Mane',
      role: 'Enquiries & Registrations',
      phone: '+917745882845',
      email: '',
      instagramId: '',
    },
    {
      name: 'Ankur Mirkale',
      role: 'Enquiries & Registrations',
      phone: '+917498811455',
      email: '',
      instagramId: '',
    },
    {
      name: 'Elite Octane',
      role: 'Presented by',
      phone: '+918910701010',
      email: '',
      instagramId: 'ELITEOCTANEINC',
    },
    {
      name: 'Deccan Motorsports Klub',
      role: 'Organised by',
      phone: '',
      email: '',
      instagramId: '',
    },
  ];

  // Registration form + class tiers are owned by setup-dirt-drag-internal-form.js
  // (do not overwrite mode/steps/tiers here).

  const updated = await EventShow.findByIdAndUpdate(
    EVENT_ID,
    {
      $set: {
        title: 'Elite Octane Dirt Drag 2026',
        displayName: 'Dirt Drag',
        eventType: 'other',
        eventHeading: 'Motorsport · Dirt Drag',
        organizer: 'Elite Octane · Deccan Motorsports Klub',
        description,
        process: processText,
        whatsIncluded,
        eligibility,
        generalRules,
        registrationProcess,
        venue: 'Aamby Valley City Air Strip, Maharashtra',
        city: 'Maharashtra',
        mapUrl: MAP_URL,
        meetingPoints: [],
        showTimings: [{ date: new Date('2026-10-04T04:30:00.000Z'), time: 'Sunday · event day' }],
        duration: '1 day',
        language: 'English',
        ageRating: '',
        gatesOpen: '',
        endsAt: '',
        prizePool: '',
        slots: '',
        dressCode: '',
        rounds: [
          {
            title: 'Safety & scrutiny',
            content:
              'All vehicles undergo technical and safety scrutiny before participation. Marshals and support crew on site.',
          },
          {
            title: 'Organised dirt-drag runs',
            content:
              'Timed and categorised runs. Staging, recovery and first aid available. Stock or modified — all welcome.',
          },
        ],
        contacts,
        poster: posterUrl,
        banner: posterUrl,
        coverImages: {
          page: posterUrl,
          portrait: posterUrl,
          wide: posterUrl,
          hero: posterUrl,
          square: posterUrl,
          landscape: posterUrl,
          video: '',
        },
        galleryImages: [posterUrl],
        pageSection: 'upcoming',
        pagePriority: 1,
        status: 'published',
        showOnHomeSlide: false,
        homeSection: null,
        homePriority: 999,
      },
    },
    { new: true },
  ).lean();

  if (!updated) throw new Error('Event not found: ' + EVENT_ID);

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: String(updated._id),
        title: updated.title,
        venue: updated.venue,
        showTimings: updated.showTimings,
        pageSection: updated.pageSection,
        status: updated.status,
        registration: {
          status: updated.registration?.status,
          mode: updated.registration?.mode,
        },
        registrationLink: updated.registrationLink,
        poster: updated.poster,
        contacts: (updated.contacts || []).map((c) => `${c.name} · ${c.phone || c.instagramId || ''}`),
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
