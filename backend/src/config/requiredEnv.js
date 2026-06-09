function assertProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length) {
    console.error(`❌ Missing required production env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const recommended = [
    'CASHFREE_CLIENT_ID',
    'CASHFREE_CLIENT_SECRET',
    'CASHFREE_ENV',
    'CASHFREE_WEBHOOK_SECRET',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD_HASH',
    'FIREBASE_SERVICE_ACCOUNT_KEY',
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
}

module.exports = { assertProductionEnv };
