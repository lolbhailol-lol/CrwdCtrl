const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const FestOrganizer = require('../src/model/fest_organizer_model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const allFests = await FestOrganizer.find({}, { festName: 1 });
console.log('Saare fests:', allFests.map(f => f.festName));
  const fest = await FestOrganizer.findOne({ festName: /mindspark/i });

  if (!fest) {
    console.log('MindSpark fest nahi mila. Naam check karo DB me.');
    process.exit(1);
  }

  console.log('Mila:', fest.festName, '| Current stallBrand:', fest.stallBrand || '(empty)');

  fest.stallBrand = 'Jio';
  await fest.save();

  console.log('Updated! Naya stallBrand:', fest.stallBrand);
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
