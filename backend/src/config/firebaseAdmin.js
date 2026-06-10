const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseAdminApp = null;
let initAttempted = false;
let initErrorMessage = null;
let cachedProjectId = null;

function normalizeServiceAccount(serviceAccount) {
  if (!serviceAccount || typeof serviceAccount !== 'object') return null;
  const normalized = { ...serviceAccount };
  if (typeof normalized.private_key === 'string') {
    normalized.private_key = normalized.private_key.replace(/\\n/g, '\n');
  }
  return normalized;
}

function parseServiceAccountJson(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;

  const attempts = [
    raw.trim(),
    raw.trim().replace(/^['"]|['"]$/g, ''),
  ];

  let lastError = null;
  for (const candidate of attempts) {
    try {
      return normalizeServiceAccount(JSON.parse(candidate));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON');
}

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

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()) {
      serviceAccount = parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()) {
      const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (fs.existsSync(filePath)) {
        serviceAccount = normalizeServiceAccount(
          JSON.parse(fs.readFileSync(filePath, 'utf8'))
        );
      } else {
        console.warn(`⚠️ Firebase service account file not found: ${filePath}`);
      }
    }

    if (serviceAccount) {
      firebaseAdminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      initErrorMessage = null;
      cachedProjectId = serviceAccount.project_id || null;
      console.log('✅ Firebase Admin initialized');
      return firebaseAdminApp;
    }

    initErrorMessage = 'FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH not configured';
    console.warn(`⚠️ ${initErrorMessage} — push notifications disabled`);
    return null;
  } catch (initError) {
    initErrorMessage = initError.message;
    console.error('❌ Failed to initialize Firebase Admin:', initError.message);
    return null;
  }
}

function isFirebaseAdminConfigured() {
  return Boolean(getFirebaseAdmin());
}

function getFirebaseAdminStatus() {
  const configured = isFirebaseAdminConfigured();
  return {
    configured,
    projectId: configured ? cachedProjectId : null,
    error: configured ? null : initErrorMessage,
  };
}

module.exports = {
  getFirebaseAdmin,
  isFirebaseAdminConfigured,
  getFirebaseAdminStatus,
  admin,
};
