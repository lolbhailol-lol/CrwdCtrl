require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const EventShow = require('../src/model/event_show_model');
  const id = '6a722ada2a151369a4a2ff03';

  const clean = (s) => String(s || '')
    .replace(/Race\s*-\s*car/gi, 'Race car')
    .replace(/Race-car/gi, 'Race car');

  const description = clean(`Bring your own vehicle and join us for an Independence Day drive from Chandni Chowk to Deccan Ring, Ravet.

We move as a respectful convoy — stay in formation, follow marshals, and keep it safe for everyone on the road.

Flag hoisting at the track at 9:00 AM, followed by Trackday for those who want track time.

Race car Trackday packages are available on request — contact the team for details.

Basic necessities and facilities are available at the track.

Drive and flag hoisting are free; fees apply only for Trackday competitors. Spectators are welcome at Trackday for free.`);

  const processText = `Meeting points (choose one)
1. Irani Cafe Chandni Chowk
2. Autohaus Kalyani Nagar
Reporting 6:30 AM at your chosen meeting point
Convoy drive to Deccan Ring, Ravet
Flag hoisting at 9:00 AM
Trackday begins after the ceremony`;

  const whatsIncluded = clean(`Independence Day convoy from Chandni Chowk to Deccan Ring
Flag hoisting ceremony at the track (9:00 AM)
Trackday session for own vehicles (Trackday fee applies)
Basic necessities and facilities at the track
Drive + flag hoisting only — no fee
Spectators welcome at Trackday — no fee
Race car Trackday packages available on request (contact)`);

  const eligibility = clean('Own vehicles welcome. Trackday competitors pay applicable fees. Drive and flag hoisting are free. Race car packages via phone/email.');

  const generalRules = clean('Own vehicles are welcome. Drive and flag hoisting are free. Trackday competitors must pay Trackday fees. Race car Trackday packages are available on request — contact the organizer by phone or email.');

  const rounds = [
    {
      title: 'Safety Gear Information',
      content: [
        'Helmet is mandatory for all Trackday participants.',
        'Wear closed shoes, full sleeves, and full length trousers on track.',
        'Seat belts must be worn at all times while driving.',
        'Follow all marshal and track safety instructions without exception.',
        'Vehicles must be in safe, roadworthy condition before entering the track.',
      ].join('\n'),
    },
    {
      title: 'Indemnity Information',
      content: [
        'Participation is voluntary and at your own risk.',
        'Organizers are not liable for injury, damage, or loss of property during the drive or Trackday.',
        'You confirm you are medically fit and hold a valid driving licence.',
        'You agree to follow all event, convoy, and track rules shared by the organizers.',
        'Organizers may refuse entry or stop any participant for safety reasons.',
      ].join('\n'),
    },
  ];

  const meetingPoints = [
    { label: 'Irani Cafe Chandni Chowk', mapUrl: 'https://maps.app.goo.gl/oYCpaofzfJmNNoCP9' },
    { label: 'Autohaus Kalyani Nagar', mapUrl: 'https://maps.app.goo.gl/srLWWvgPfjWCzHj4A' },
  ];

  const tiers = [
    {
      id: 'tier_drive_only',
      name: 'Independence Day Drive only',
      description: 'Drive + flag hoisting — no Trackday',
      fee: 0,
      participantCount: 1,
      inclusions: ['Independence Day convoy', 'Flag hoisting at 9:00 AM'],
      order: 0,
    },
    {
      id: 'tier_spectator',
      name: 'Spectators',
      description: 'Watch Trackday from the sidelines — no track time',
      fee: 0,
      participantCount: 1,
      inclusions: ['Spectate Trackday', 'Access to track facilities'],
      order: 1,
    },
    {
      id: 'tier_solo_1',
      name: 'Solo · 1 Lap',
      description: 'Solo Participant Package — 1 driver',
      fee: 750,
      participantCount: 1,
      inclusions: ['1 lap Trackday session'],
      order: 1,
    },
    {
      id: 'tier_solo_2',
      name: 'Solo · 2 Laps',
      description: 'Solo Participant Package — 1 driver',
      fee: 1450,
      participantCount: 1,
      inclusions: ['2 laps Trackday session'],
      order: 2,
    },
    {
      id: 'tier_solo_4',
      name: 'Solo · 4 Laps',
      description: 'Solo Participant Package — 1 driver',
      fee: 2700,
      participantCount: 1,
      inclusions: ['4 laps Trackday session'],
      order: 3,
    },
    {
      id: 'tier_trio_3',
      name: 'Trio · 3 Laps',
      description: 'Group package for 3 drivers only',
      fee: 2050,
      participantCount: 3,
      inclusions: ['3 laps Trackday session', 'Personal details required for all 3 drivers'],
      order: 4,
    },
    {
      id: 'tier_trio_6',
      name: 'Trio · 6 Laps',
      description: 'Group package for 3 drivers only',
      fee: 3850,
      participantCount: 3,
      inclusions: ['6 laps Trackday session', 'Personal details required for all 3 drivers'],
      order: 5,
    },
    {
      id: 'tier_quattro_4',
      name: 'Quattro · 4 Laps',
      description: 'Group package for 4 drivers only',
      fee: 2650,
      participantCount: 4,
      inclusions: ['4 laps Trackday session', 'Personal details required for all 4 drivers'],
      order: 6,
    },
    {
      id: 'tier_quattro_8',
      name: 'Quattro · 8 Laps',
      description: 'Group package for 4 drivers only',
      fee: 5100,
      participantCount: 4,
      inclusions: ['8 laps Trackday session', 'Personal details required for all 4 drivers'],
      order: 7,
    },
    {
      id: 'tier_penta_5',
      name: 'Penta · 5 Laps',
      description: 'Group package for 5 drivers only',
      fee: 3200,
      participantCount: 5,
      inclusions: ['5 laps Trackday session', 'Personal details required for all 5 drivers'],
      order: 8,
    },
    {
      id: 'tier_penta_10',
      name: 'Penta · 10 Laps',
      description: 'Group package for 5 drivers only',
      fee: 6150,
      participantCount: 5,
      inclusions: ['10 laps Trackday session', 'Personal details required for all 5 drivers'],
      order: 9,
    },
  ];

  const bloodOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Prefer not to say'];
  const addOns = [
    {
      id: 'experience_ride',
      name: 'Experience Ride',
      description: 'Get to experience a live race car with a professional racing driver on a track. One entire lap of adrenaline rushing in as you accelerate on the start line.',
      vehicles: 'Fronx & Gypsy',
      fee: 1500,
      enabled: true,
      order: 0,
    },
    {
      id: 'rent_and_drive',
      name: 'Rent & Drive',
      description: "Whether you are a seasoned racer or a beginner, our winning race vehicles will amaze both. Get behind the wheel and don't worry about anything — just you, the track and a roaring machine.",
      vehicles: 'Esteem',
      fee: 2000,
      enabled: true,
      order: 1,
    },
  ];

  const registration = {
    status: 'open',
    mode: 'internal_form',
    formType: 'MULTI_STEP',
    formSchema: [],
    steps: [
      {
        stepNumber: 1,
        stepTitle: 'Independence Day Drive',
        stepDescription: 'Will you join the Independence Day Drive convoy? Drive + flag hoisting are free.',
        fields: [
          {
            id: 'f_join_drive',
            label: 'Joining Independence Day Drive?',
            fieldName: 'join_drive',
            type: 'radio',
            required: true,
            placeholder: '',
            options: ['Yes', 'No'],
          },
        ],
      },
      {
        stepNumber: 2,
        stepTitle: 'Your Details',
        stepDescription: '',
        fields: [
          {
            id: 'f_name',
            label: 'Full Name',
            fieldName: 'name',
            type: 'text',
            required: true,
            placeholder: 'Your full name',
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
            id: 'f_blood',
            label: 'Blood Group',
            fieldName: 'blood_group',
            type: 'select',
            required: true,
            placeholder: '',
            options: bloodOptions,
          },
          {
            id: 'f_vehicle',
            label: 'Vehicle details',
            fieldName: 'vehicle_details',
            type: 'text',
            required: false,
            placeholder: 'Make / model (optional)',
            options: [],
          },
        ],
      },
    ],
    googleSheetsUrl: '',
    allowCoupons: false,
  };

  const updated = await EventShow.findByIdAndUpdate(
    id,
    {
      $set: {
        organizer: 'Deccan Motorsport Klub',
        description,
        process: processText,
        whatsIncluded,
        eligibility,
        generalRules,
        rounds,
        meetingPoints,
        venue: 'Deccan Ring, Pune',
        pricingMode: 'tiers',
        tiers,
        addOns,
        ticketPrice: 0,
        platformFeePercent: 0,
        registration,
      },
    },
    { new: true },
  ).lean();

  if (!updated) throw new Error('Event not found');
  console.log('Updated', updated.title);
  console.log('organizer', updated.organizer);
  console.log('tiers', (updated.tiers || []).map((t) => `${t.id} · ₹${t.fee} · drivers=${t.participantCount}`));
  console.log('add-ons', (updated.addOns || []).map((a) => `${a.name} · ₹${a.fee} · ${a.vehicles}`));
  console.log('registration steps', (updated.registration?.steps || []).map((s) => s.stepTitle));
  console.log('flag time ok?', /9:00 AM/.test(updated.process || ''));
  const blob = [updated.description, updated.whatsIncluded, updated.generalRules, updated.eligibility].join('\n');
  console.log('has Race-car dash?', /Race\s*-\s*car|Race-car/i.test(blob));
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
