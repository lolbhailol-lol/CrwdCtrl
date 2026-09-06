require('dotenv').config();
const mongoose = require('mongoose');

const EVENT_ID = '6a722ada2a151369a4a2ff03';

const spectatorTier = {
  id: 'tier_spectator',
  name: 'Spectators',
  description: 'Watch Trackday from the sidelines — no track time',
  fee: 0,
  participantCount: 1,
  inclusions: ['Spectate Trackday', 'Access to track facilities'],
  order: 1,
};

(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  await mongoose.connect(process.env.MONGODB_URI);
  const EventShow = require('../src/model/event_show_model');
  const event = await EventShow.findById(EVENT_ID).select('title tiers');
  if (!event) throw new Error(`Independence Day event ${EVENT_ID} was not found`);

  const tiers = Array.isArray(event.tiers) ? event.tiers.map((tier) => tier.toObject?.() || tier) : [];
  const index = tiers.findIndex((tier) => String(tier.id || '') === spectatorTier.id);
  if (index >= 0) {
    tiers[index] = { ...tiers[index], ...spectatorTier };
  } else {
    const driveIndex = tiers.findIndex((tier) => String(tier.id || '') === 'tier_drive_only');
    const insertAt = driveIndex >= 0 ? driveIndex + 1 : 0;
    tiers.splice(insertAt, 0, spectatorTier);
  }

  event.tiers = tiers;
  event.markModified('tiers');
  await event.save();

  console.log(`Updated ${event.title}: ${event.tiers.length} packages`);
  console.log((event.tiers || []).map((t) => `${t.id} · ${t.name} · ₹${t.fee}`).join('\n'));
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error.message || error);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
