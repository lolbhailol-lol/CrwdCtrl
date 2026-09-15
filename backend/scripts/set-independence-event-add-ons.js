require('dotenv').config();
const mongoose = require('mongoose');

const EVENT_ID = '6a722ada2a151369a4a2ff03';

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

(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  await mongoose.connect(process.env.MONGODB_URI);
  const EventShow = require('../src/model/event_show_model');
  const event = await EventShow.findByIdAndUpdate(
    EVENT_ID,
    {
      $set: {
        addOns,
        'registration.allowCoupons': false,
      },
    },
    { new: true, runValidators: true },
  ).select('title addOns');
  if (!event) throw new Error(`Independence Day event ${EVENT_ID} was not found`);
  console.log(`Updated ${event.title}: ${event.addOns.length} add-ons`);
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error.message || error);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
