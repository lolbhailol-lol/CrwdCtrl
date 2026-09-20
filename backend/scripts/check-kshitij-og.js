require('dotenv').config();
const mongoose = require('mongoose');
const { resolveOgHtml } = require('../src/services/seoOgService');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const html = await resolveOgHtml('/view-details/kshitij-pune-multicity-event-2026');
  const img = html?.match(/property="og:image" content="([^"]+)"/)?.[1];
  const title = html?.match(/property="og:title" content="([^"]+)"/)?.[1];
  console.log(JSON.stringify({ title, img }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
