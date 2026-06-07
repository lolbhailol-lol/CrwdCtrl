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
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
  ];
  const missingRecommended = recommended.filter((key) => !process.env[key]?.trim());
  if (missingRecommended.length) {
    console.warn(`⚠️ Recommended production env vars not set: ${missingRecommended.join(', ')}`);
  }
}

module.exports = { assertProductionEnv };
