/**
 * Verify Firebase Admin credentials load correctly (push notifications).
 * Usage: node scripts/verify-firebase-admin.js
 */
require('dotenv').config();

const { getFirebaseAdminStatus } = require('../src/config/firebaseAdmin');

const status = getFirebaseAdminStatus();

if (status.configured) {
  console.log('✅ Firebase Admin OK');
  console.log('   projectId:', status.projectId);
  process.exit(0);
}

console.error('❌ Firebase Admin NOT configured');
console.error('   error:', status.error || 'unknown');
console.error('');
console.error('Fix: set FIREBASE_SERVICE_ACCOUNT_KEY on Railway (full JSON one-liner).');
console.error('     FIREBASE_SERVICE_ACCOUNT_PATH is optional if KEY is set.');
process.exit(1);
