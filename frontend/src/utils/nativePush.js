import { PushNotifications } from '@capacitor/push-notifications';
import { isNativeApp, isAndroid } from './capacitorPlatform';

/**
 * Register for native push (FCM on Android). Returns FCM token or null.
 */
export async function registerNativePushToken() {
  if (!isNativeApp()) return null;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return null;

  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 15000);

    const finish = (token) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(token);
    };

    PushNotifications.addListener('registration', (token) => {
      finish(token.value);
    });

    PushNotifications.addListener('registrationError', () => {
      finish(null);
    });

    PushNotifications.register().catch(() => finish(null));
  });
}

export function getPushDeviceType() {
  if (isAndroid()) return 'android';
  if (isNativeApp()) return 'native';
  return 'web';
}

/**
 * Wire notification tap → in-app navigation.
 */
export function initNativePushNavigation(navigate) {
  if (!isNativeApp() || typeof navigate !== 'function') return () => {};

  let handle = null;

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const link = action.notification?.data?.link;
    if (link && typeof link === 'string' && link.startsWith('/')) {
      navigate(link);
    }
  }).then((h) => {
    handle = h;
  });

  return () => {
    handle?.remove();
  };
}
