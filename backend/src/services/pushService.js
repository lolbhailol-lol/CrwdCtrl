const { getFirebaseAdmin, admin } = require('../config/firebaseAdmin');

/**
 * Send push notification to a specific user
 * @param {string} userId - User's MongoDB ID
 * @param {object} notification - { title, body, link?, icon? }
 * @returns {Promise<object>} - Result of push send
 */
const sendPushNotification = async (userId, notification, options = {}) => {
  try {
    if (!getFirebaseAdmin()) {
      console.log('⚠️ Firebase Admin not initialized — skipping push notification');
      return { success: false, reason: 'firebase_not_initialized' };
    }

    const User = require('../model/usermodel');
    const user = await User.findById(userId).select('fcmTokens notificationPreferences');

    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`📱 No FCM tokens for user ${userId} — skipping push`);
      return { success: false, reason: 'no_tokens' };
    }

    if (options.preferenceKey) {
      const prefs = user.notificationPreferences || {};
      if (prefs[options.preferenceKey] === false) {
        return { success: false, reason: 'preference_disabled' };
      }
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
