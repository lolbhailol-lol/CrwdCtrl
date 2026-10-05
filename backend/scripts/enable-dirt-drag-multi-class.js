/**
 * Enable Dirt Drag multi-class select + align category names to organiser form.
 * Run: node scripts/enable-dirt-drag-multi-class.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EventShow = require('../src/model/event_show_model');

const EVENT_ID = '6a722ada2a151369a4a2ff03';

const CLASSES = [
  { id: 'class_stock_suv_petrol_1600', name: '1. Stock SUV Petrol - Up to 1600 cc' },
  { id: 'class_stock_suv_petrol_3000', name: '2. Stock SUV Petrol - 1601-3000 cc' },
  { id: 'class_stock_suv_petrol_above', name: '3. Stock SUV Petrol - Above 3000 cc' },
  { id: 'class_stock_suv_diesel_2700', name: '4. Stock SUV Diesel - Up to 2700 cc' },
  { id: 'class_stock_suv_diesel_above', name: '5. Stock SUV Diesel - 2701 cc & Above' },
  { id: 'class_mod_suv_petrol_1600', name: '6. Modified SUV Petrol - Up to 1600 cc' },
  { id: 'class_mod_suv_petrol_3000', name: '7. Modified SUV Petrol - 1601-3000 cc' },
  { id: 'class_mod_suv_diesel_2700', name: '8. Modified SUV Diesel - Up to 2700 cc' },
  { id: 'class_mod_suv_diesel_above', name: '9. Modified SUV Diesel - 2701 cc & Above' },
  { id: 'class_suv_open', name: '10. SUV Open' },
  { id: 'class_lwb_suv_open', name: '11. LWB SUV - Open' },
  { id: 'class_ladies_open', name: '12. Ladies - Open' },
  { id: 'class_2w_open_2400', name: '13. 2W Open - Up to 2400 cc' },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const tiers = [
    {
      id: 'tier_spectator',
      name: 'Spectators',
      description: 'Spectate Dirt Drag — free entry. No competition class.',
      fee: 0,
      participantCount: 1,
      inclusions: ['Spectator access', 'Viewing area access'],
      order: -1,
    },
    ...CLASSES.map((c, i) => ({
      id: c.id,
      name: c.name,
      description: 'Rs 10,000 per class. Select multiple classes — total adds up.',
      fee: 10000,
      participantCount: 1,
      inclusions: [
        'Competitor entry for selected class',
        'Timed & categorised dirt-drag run',
        'Staging, recovery & first-aid access',
      ],
      order: i,
    })),
  ];

  const updated = await EventShow.findByIdAndUpdate(
    EVENT_ID,
    {
      $set: {
        pricingMode: 'tiers',
        tiersMultiSelect: true,
        tiers,
        ticketPrice: 10000,
        priceLabel: 'Rs 10,000 / class · Spectators free',
        registrationProcess: [
          'Tap Register and enter your personal details.',
          'Choose Participant or Spectator.',
          'Participants complete vehicle & insurance details, then select one or more classes (Rs 10,000 each — total adds up).',
          'Spectators register free with no class selection.',
          'Pay online via Cashfree when a fee applies. Download and sign the Indemnity Bond as instructed by the Organiser.',
        ].join('\n'),
        'registration.steps.0.stepTitle': 'Personal details',
        'registration.steps.0.stepDescription': 'Your contact and emergency information.',
      },
    },
    { new: true },
  ).lean();

  if (!updated) throw new Error('Event not found');
  console.log(JSON.stringify({
    ok: true,
    title: updated.title,
    tiersMultiSelect: updated.tiersMultiSelect,
    tiers: (updated.tiers || []).map((t) => `${t.name} · ₹${t.fee}`),
  }, null, 2));
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
