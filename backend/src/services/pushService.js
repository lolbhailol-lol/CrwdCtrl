const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin if not already done
let firebaseAdminApp;
try {
  firebaseAdminApp = admin.app();
} catch (_) {
  // Firebase Admin not initialized — try to initialize
  try {
    let serviceAccount = null;

    // Option 1: JSON string in env var
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    }
    // Option 2: Path to JSON file
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
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
      console.log('✅ Firebase Admin initialized for push notifications');
    } else {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY / FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications disabled');
    }
  } catch (initError) {
    console.error('❌ Failed to initialize Firebase Admin:', initError.message);
  }
}

/**
 * Send push notification to a specific user
 * @param {string} userId - User's MongoDB ID
 * @param {object} notification - { title, body, link?, icon? }
 * @returns {Promise<object>} - Result of push send
 */
const sendPushNotification = async (userId, notification) => {
  try {
    if (!firebaseAdminApp) {
      console.log('⚠️ Firebase Admin not initialized — skipping push notification');
      return { success: false, reason: 'firebase_not_initialized' };
    }

    const User = require('../model/usermodel');
    const user = await User.findById(userId).select('fcmTokens');

    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`📱 No FCM tokens for user ${userId} — skipping push`);
      return { success: false, reason: 'no_tokens' };
    }

    const tokens = user.fcmTokens.map(t => t.token);

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        link: notification.link || '/',
        type: notification.type || 'system',
      },
      webpush: {
        notification: {
          icon: notification.icon || '/icon-192x192.png',
          badge: '/icon-192x192.png',
          vibrate: [200, 100, 200],
          actions: [
            { action: 'open', title: 'Open' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        },
        fcmOptions: {
          link: notification.link || '/',
        },
      },
    };

    // Send to all user tokens
    const results = await Promise.allSettled(
      tokens.map(token =>
        admin.messaging().send({ ...message, token })
      )
    );

    // Clean up invalid tokens
    const invalidTokens = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const errorCode = result.reason?.code;
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    // Remove invalid tokens from user
    if (invalidTokens.length > 0) {
      user.fcmTokens = user.fcmTokens.filter(t => !invalidTokens.includes(t.token));
      await user.save();
      console.log(`🧹 Removed ${invalidTokens.length} invalid FCM tokens for user ${userId}`);
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    console.log(`📱 Push sent to user ${userId}: ${successCount}/${tokens.length} succeeded`);

    return { success: true, sent: successCount, total: tokens.length };
  } catch (error) {
    console.error('❌ Push notification error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to multiple users
 * @param {string[]} userIds - Array of user IDs
 * @param {object} notification - { title, body, link?, icon? }
 */
const sendPushToMultipleUsers = async (userIds, notification) => {
  const results = await Promise.allSettled(
    userIds.map(userId => sendPushNotification(userId, notification))
  );
  return results;
};

module.exports = {
  sendPushNotification,
  sendPushToMultipleUsers,
};
