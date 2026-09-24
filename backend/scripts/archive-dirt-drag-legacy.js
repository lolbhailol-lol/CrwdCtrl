/** Archive the August predecessor without deleting registrations or payment history.
 * Default: read-only preview. Apply: --apply. Undo: --rollback.
 * Original BSON documents remain in event_archive_migrations for recovery/audit.
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { isDeepStrictEqual } = require('node:util');
const { ObjectId } = mongoose.Types;
const SOURCE = new ObjectId('6a722ada2a151369a4a2ff03');
const KEY = 'dirt-drag-archive-independence-2026-v1';
const CUTOFF = new Date('2026-09-01T00:00:00Z');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const events = db.collection('event_shows');
  const regs = db.collection('eventshowregistrations');
  const orders = db.collection('paymentorders');
  const audit = db.collection('event_archive_migrations');
  const previous = await audit.findOne({ _id: KEY });
  if (process.argv.includes('--rollback')) {
    if (!previous || previous.status !== 'applied') throw new Error('No applied migration to roll back');
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (await regs.countDocuments({ eventShow: previous.archiveEventId }, { session }) !== previous.registrations.length
          || await orders.countDocuments({ entityType: 'event_show', entityId: previous.archiveEventId }, { session }) !== previous.orders.length) throw new Error('Archive acquired new records; manual reconciliation required');
        for (const [collection, originals, field] of [[regs, previous.registrations, 'eventShow'], [orders, previous.orders, 'entityId']]) {
          for (const original of originals) {
            const current = await collection.findOne({ _id: original._id }, { session });
            const expected = { ...original, [field]: previous.archiveEventId };
            if (!isDeepStrictEqual(current, expected)) throw new Error('Record changed after archive; manual reconciliation required');
            await collection.replaceOne({ _id: original._id }, original, { session });
          }
        }
        await events.deleteOne({ _id: previous.archiveEventId }, { session });
        await audit.updateOne({ _id: KEY }, { $set: { status: 'rolled_back', rolledBackAt: new Date() } }, { session });
      });
    } finally { await session.endSession(); }
    console.log('Rollback verified and completed');
    return;
  }
  if (previous) {
    console.log(JSON.stringify({ migration: previous.status, archiveEventId: previous.archiveEventId, archivedRegistrations: previous.registrations.length, activeRegistrations: await regs.countDocuments({ eventShow: SOURCE }) }));
    return;
  }
  const event = await events.findOne({ _id: SOURCE });
  if (event?.title !== 'Elite Octane Dirt Drag 2026' || event.status !== 'published') throw new Error('Unexpected live event');
  const allRegs = await regs.find({ eventShow: SOURCE }).toArray();
  const allOrders = await orders.find({ entityType: 'event_show', entityId: SOURCE }).toArray();
  const oldRegs = allRegs.filter(r => r.createdAt && r.createdAt < CUTOFF);
  const oldOrders = allOrders.filter(o => o.createdAt && o.createdAt < CUTOFF);
  for (const r of oldRegs) {
    if ((r.additionalEntries || []).some(e => !e.submittedAt || e.submittedAt >= CUTOFF || String(e.tierId).startsWith('class_')) || String(r.tierId).startsWith('class_')) throw new Error('Mixed old/new registration requires manual split');
  }
  const summary = {
    event: event.title, oldRegistrations: oldRegs.length, retainedRegistrations: allRegs.length - oldRegs.length,
    oldOrders: oldOrders.length, retainedOrders: allOrders.length - oldOrders.length,
    firstRegistration: oldRegs.map(r => r.createdAt).sort((a,b) => a-b)[0],
    lastRegistration: oldRegs.map(r => r.createdAt).sort((a,b) => b-a)[0],
    oldPaymentTotal: oldRegs.reduce((n,r) => n + (r.amountPaid || 0), 0),
    oldOrderStatuses: oldOrders.reduce((a,o) => { a[o.status] = (a[o.status] || 0) + 1; return a; }, {}),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!process.argv.includes('--apply')) return;
  if (!oldRegs.length) throw new Error('Nothing to archive');
  if (oldOrders.some(o => String(o.orderTags?.tierId).startsWith('class_') || o.orderTags?.registrationDraft)) throw new Error('Old order contains a current class or fulfillment draft; review required');
  const archiveId = new ObjectId();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Snapshot equality prevents archiving registrations changed during preview.
      for (const [collection, originals] of [[regs, oldRegs], [orders, oldOrders]]) {
        for (const original of originals) {
          if (!isDeepStrictEqual(await collection.findOne({ _id: original._id }, { session }), original)) throw new Error('Concurrent change detected; retry preview');
        }
      }
      await audit.insertOne({ _id: KEY, status: 'applied', appliedAt: new Date(), sourceEventId: SOURCE, archiveEventId: archiveId, sourceEventSnapshot: event, registrations: oldRegs, orders: oldOrders }, { session });
      await events.insertOne({
        _id: archiveId, title: 'Independence Day Drive 2026 (Archive)', displayName: 'Independence Day Drive 2026 (Archive)',
        eventType: 'other', organizer: 'Deccan Motorsport Klub', status: 'completed',
        description: 'Archived August 2026 registrations from the event listing subsequently reused for Dirt Drag.',
        venue: 'Deccan Ring, Pune', city: 'Pune', showTimings: [{ date: new Date('2026-08-15T00:00:00Z'), time: 'Archived event' }],
        registration: { enabled: false }, showOnHomeSlide: false, pageSection: null,
        createdAt: new Date(), updatedAt: new Date(), archivedFromEventId: SOURCE,
      }, { session });
      for (const [collection, originals, field] of [[regs, oldRegs, 'eventShow'], [orders, oldOrders, 'entityId']]) {
        if (!originals.length) continue;
        const result = await collection.updateMany({ _id: { $in: originals.map(r => r._id) }, [field]: SOURCE }, { $set: { [field]: archiveId } }, { session });
        if (result.modifiedCount !== originals.length) throw new Error('Archive count mismatch');
        for (const original of originals) {
          const moved = await collection.findOne({ _id: original._id }, { session });
          if (!isDeepStrictEqual(moved, { ...original, [field]: archiveId })) throw new Error('Preservation verification failed');
        }
      }
      if (!isDeepStrictEqual(await events.findOne({ _id: SOURCE }, { session }), event)) throw new Error('Live event changed; retry');
    });
  } finally { await session.endSession(); }
  console.log(JSON.stringify({ result: 'archived_and_verified', archiveEventId: archiveId, activeRegistrations: await regs.countDocuments({ eventShow: SOURCE }), archivedRegistrations: await regs.countDocuments({ eventShow: archiveId }), archivedOrders: await orders.countDocuments({ entityType: 'event_show', entityId: archiveId }) }, null, 2));
}

main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
