const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseAdminApp = null;
let initAttempted = false;

/**
 * Initialize Firebase Admin once (shared by push notifications and ID token verification).
 * Returns null if credentials are not configured.
 */
function getFirebaseAdmin() {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  if (initAttempted) {
    return null;
  }
  initAttempted = true;

  try {
    firebaseAdminApp = admin.app();
    return firebaseAdminApp;
  } catch (_) {
    // Not initialized yet — try below
  }

  try {
    let serviceAccount = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (fs.existsSync(filePath)) {
        serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else {
        console.warn(`⚠️ Firebase service account file not found: ${filePath}`);
      }
    }

    if (serviceAccount) {
      firebaseAdminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized');
      return firebaseAdminApp;
    }

    console.warn(
      '⚠️ FIREBASE_SERVICE_ACCOUNT_KEY / FIREBASE_SERVICE_ACCOUNT_PATH not set — Firebase Admin disabled'
    );
    return null;
  } catch (initError) {
    console.error('❌ Failed to initialize Firebase Admin:', initError.message);
    return null;
  }
}

function isFirebaseAdminConfigured() {
  return Boolean(getFirebaseAdmin());
}

module.exports = { getFirebaseAdmin, isFirebaseAdminConfigured, admin };
