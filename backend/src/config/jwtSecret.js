function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  console.warn('⚠️ JWT_SECRET not set — using development fallback');
  return 'dev-only-jwt-secret-change-me';
}

module.exports = { getJwtSecret };
