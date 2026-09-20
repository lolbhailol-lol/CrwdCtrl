const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const FestOrganizer = require('../src/model/fest_organizer_model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await FestOrganizer.findOne({ festName: /mindspark/i });
  if (existing) {
    console.log('Already exists:', existing.festName);
    process.exit(0);
  }

  const fest = await FestOrganizer.create({
    festName: 'MindSpark Jio Fest',
    collegeName: 'Test College',
    festType: 'technical',
    festDate: 'TBD',
    venue: 'Test Venue',
    description: 'Test fest for stall coupon feature testing',
    isApproved: true,
    stallBrand: 'Svvad Pro',
    stallDiscountPercent: 20,
    registration: {
      mode: 'INTERNAL_FORM',
      formType: 'SINGLE_STEP',
      formSchema: [
        { id: 'name', label: 'Full Name', fieldName: 'name', type: 'text', required: true },
      ],
    },
  });

  console.log('Created fest:', fest._id.toString(), '|', fest.festName, '| stallBrand:', fest.stallBrand);
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});