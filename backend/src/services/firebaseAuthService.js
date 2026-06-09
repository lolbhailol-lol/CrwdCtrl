const { getFirebaseAdmin, isFirebaseAdminConfigured } = require('../config/firebaseAdmin');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Verify a Firebase ID token from the client.
 * Returns decoded token on success; throws on failure.
 * Production: fails closed if Firebase Admin is not configured.
 */
async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    const err = new Error('Firebase ID token is required');
    err.code = 'FIREBASE_ID_TOKEN_REQUIRED';
    throw err;
  }

  const firebaseAdmin = getFirebaseAdmin();
  if (!firebaseAdmin) {
    if (isDev) {
      console.warn('⚠️ [SECURITY] Firebase Admin not configured — skipping ID token verification (dev only)');
      return null;
    }
    const err = new Error('Firebase authentication is not configured on the server');
    err.code = 'FIREBASE_ADMIN_NOT_CONFIGURED';
    throw err;
  }

  // Security: cryptographic proof that the client holds a valid Firebase session
  const decoded = await firebaseAdmin.auth().verifyIdToken(idToken.trim());
  return decoded;
}

module.exports = { verifyFirebaseIdToken, isFirebaseAdminConfigured };
