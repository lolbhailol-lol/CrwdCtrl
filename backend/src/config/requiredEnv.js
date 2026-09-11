function assertProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD_HASH',
    'CASHFREE_CLIENT_ID',
    'CASHFREE_CLIENT_SECRET',
    'CASHFREE_ENV',
    'FRONTEND_URL',
  ];

  // Campus Hunt is feature-flagged. When enabled, its offline bundle signing key
  // must be distinct from JWT_SECRET so it can be rotated independently.
  if (process.env.CAMPUS_HUNT_ENABLED === 'true') {
    required.push('OFFLINE_BUNDLE_KEY', 'CAMPUS_HUNT_CREDENTIAL_KEY');
  }

  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length) {
    console.error(`❌ Missing required production env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (process.env.JWT_SECRET.trim().length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }

  if (
    process.env.CAMPUS_HUNT_ENABLED === 'true'
    && process.env.OFFLINE_BUNDLE_KEY?.trim() === process.env.JWT_SECRET?.trim()
  ) {
    console.error('❌ OFFLINE_BUNDLE_KEY must be distinct from JWT_SECRET');
    process.exit(1);
  }

  const recommended = [
    'FIREBASE_SERVICE_ACCOUNT_KEY',
    'SENTRY_DSN',
    'RESEND_API_KEY',
    'CASHFREE_WEBHOOK_SECRET',
  ];
  const missingRecommended = recommended.filter((key) => !process.env[key]?.trim());
  if (missingRecommended.length) {
    console.warn(`⚠️ Recommended production env vars not set: ${missingRecommended.join(', ')}`);
  }

  if (process.env.ADMIN_PASSWORD?.trim() && !process.env.ADMIN_PASSWORD_HASH?.trim()) {
    console.warn(
      '⚠️ ADMIN_PASSWORD is set without ADMIN_PASSWORD_HASH — run: node scripts/hash-admin-password.js'
    );
  }

  if (process.env.CASHFREE_ENV !== 'production' && process.env.CASHFREE_ENV !== 'sandbox') {
    console.error('❌ CASHFREE_ENV must be "production" or "sandbox"');
    process.exit(1);
  }
}

function validateEnv() {
  assertProductionEnv();
}

module.exports = { assertProductionEnv, validateEnv };
