let admin;
let firebaseInitialized = false;

try {
  admin = require('firebase-admin');
  const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });

  firebaseInitialized = true;
  console.log('[Firebase] Admin SDK initialized');
} catch (error) {
  console.warn('[Firebase] Admin SDK not available - Google OAuth verification disabled');
}

module.exports = { admin, firebaseInitialized };
