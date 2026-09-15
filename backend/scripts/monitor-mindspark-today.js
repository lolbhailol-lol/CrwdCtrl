require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const INTERVAL_MS = 5 * 60 * 1000;
const logPath = path.resolve(__dirname, '../../reports/mindspark-monitor-2026-09-10.log');
const end = new Date();
end.setHours(23, 59, 30, 0);

function emit(level, details) {
  const line = JSON.stringify({ at: new Date().toISOString(), level, ...details });
  fs.appendFileSync(logPath, `${line}\n`);
  console.log(line);
}

async function check() {
  const result = { api: 'unknown', dbWrite: 'unknown' };
  try {
    const response = await fetch('https://www.crwdctrl.in/api/health', {
      signal: AbortSignal.timeout(15000),
    });
    result.api = response.ok ? 'ok' : `http-${response.status}`;
  } catch (error) {
    result.api = `error:${error.message}`;
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
      });
    }
    const db = mongoose.connection.db;
    const probe = db.collection('_monitor_write_probe');
    const inserted = await probe.insertOne({ at: new Date() });
    await probe.deleteOne({ _id: inserted.insertedId });
    result.dbWrite = 'ok';
    result.registrations = await db.collection('registrations').estimatedDocumentCount();
    result.paymentOrders = await db.collection('paymentorders').estimatedDocumentCount();
    result.analytics = await db.collection('analytics').estimatedDocumentCount().catch(() => 0);
    result.userActivityLogs = await db.collection('useractivitylogs').estimatedDocumentCount().catch(() => 0);
    const stats = await db.command({ dbStats: 1, scale: 1024 * 1024 });
    result.databaseMB = Number(((stats.storageSize || 0) + (stats.indexSize || 0)).toFixed(2));
  } catch (error) {
    result.dbWrite = `error:${error.message}`;
  }

  const unhealthy = result.api !== 'ok' || result.dbWrite !== 'ok' || result.databaseMB > 350;
  emit(unhealthy ? 'ALERT' : 'OK', result);
}

(async () => {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  emit('START', { intervalMinutes: 5, endsAt: end.toISOString() });
  await check();
  while (Date.now() < end.getTime()) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    await check();
  }
  await mongoose.disconnect().catch(() => {});
  emit('STOP', { reason: 'end-of-day' });
})().catch((error) => {
  emit('ALERT', { fatal: error.message });
  process.exit(1);
});
