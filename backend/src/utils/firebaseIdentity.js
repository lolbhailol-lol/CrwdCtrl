const { verifyFirebaseIdToken } = require('../services/firebaseAuthService');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Resolve trusted Firebase identity from a client ID token.
 * Security: never trust client-supplied firebaseUid/providerId without cryptographic verification.
 */
async function resolveFirebaseIdentity({ idToken, clientUid }) {
  if (!idToken?.trim()) {
    if (isProd) {
      const err = new Error('Firebase ID token is required');
      err.status = 401;
      throw err;
    }
    if (clientUid) {
      console.warn('[SECURITY] Dev-only: accepting Firebase UID without idToken verification');
      return { uid: clientUid, email: null, emailVerified: false };
    }
    const err = new Error('Firebase ID token is required');
    err.status = 401;
    throw err;
  }

  const decoded = await verifyFirebaseIdToken(idToken);

  if (!decoded) {
    if (!isProd && clientUid) {
      console.warn('[SECURITY] Dev-only: Firebase Admin unavailable — trusting client UID');
      return { uid: clientUid, email: null, emailVerified: false };
    }
    const err = new Error('Firebase ID token verification failed');
    err.status = 401;
    throw err;
  }

  if (clientUid && clientUid !== decoded.uid) {
    const err = new Error('Firebase UID does not match ID token');
    err.status = 401;
    throw err;
  }

  return {
    uid: decoded.uid,
    email: decoded.email || null,
    emailVerified: Boolean(decoded.email_verified),
  };
}

module.exports = { resolveFirebaseIdentity };
