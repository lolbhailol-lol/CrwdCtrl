#!/usr/bin/env node
/**
 * Quick Google Sheets connectivity check for local dev.
 *
 * Usage:
 *   node scripts/test-google-sheets.js "https://docs.google.com/spreadsheets/d/XXXX/edit"
 *
 * It verifies:
 *   1. The service-account credentials in .env are valid (auth works)
 *   2. The service account actually has access to the given sheet
 *   3. It can append a test row
 */
require('dotenv').config();

const { testGoogleSheetsConnection, appendToEventGoogleSheets } = require('../src/services/googleSheetsService');

async function main() {
  const url = process.argv[2];

  console.log('--- Google Sheets credential check ---');
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(missing)');
  console.log('GOOGLE_PRIVATE_KEY set:', !!process.env.GOOGLE_PRIVATE_KEY);
  console.log('');

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error('❌ Credentials missing in .env. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.');
    process.exit(1);
  }

  if (!url) {
    console.error('⚠️  Pass a sheet URL to fully test access, e.g.:');
    console.error('    node scripts/test-google-sheets.js "https://docs.google.com/spreadsheets/d/XXXX/edit"');
    process.exit(1);
  }

  console.log('1) Testing connection to the sheet...');
  const conn = await testGoogleSheetsConnection(url);
  if (!conn.success) {
    console.error('❌ Connection failed:', conn.error);
    console.error('   → If you see "invalid_grant / account not found": the service account key is invalid. Create a new JSON key.');
    console.error('   → If you see a 403 / permission error: share the sheet with the service account email as Editor.');
    process.exit(1);
  }
  console.log('✅ Connected to sheet:', conn.title);
  console.log('');

  console.log('2) Appending a test row...');
  const result = await appendToEventGoogleSheets(
    url,
    { full_name: 'Test User', notes: 'This is a connectivity test row' },
    {
      eventName: 'Connectivity Test Event',
      registrationId: 'TEST-' + Date.now(),
      amountPaid: 0,
      paymentId: 'TEST-PAYMENT-ID',
      paymentStatus: 'paid',
    },
    { name: 'Test User', email: 'test@example.com', phone: '0000000000' },
    [
      { label: 'Full Name', fieldName: 'full_name', type: 'text' },
      { label: 'Notes', fieldName: 'notes', type: 'text' },
    ],
  );

  if (result.success) {
    console.log('✅ Test row appended successfully!', result.updatedRange || '');
    console.log('🎉 Everything works. Open the sheet to see the test row.');
  } else {
    console.error('❌ Append failed:', result.error);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌ Unexpected error:', e.message);
  process.exit(1);
});
