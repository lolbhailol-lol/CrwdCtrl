import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from "firebase/messaging";
import { isNativeApp } from "../utils/capacitorPlatform";
import { app } from "./app.js";
import { safeConsoleLog, safeConsoleWarn } from "../utils/safeLog";

// ===== FIREBASE CLOUD MESSAGING (Push Notifications) =====
// PushManager presence ≠ Firebase isSupported() (Safari/Instagram/in-app browsers).
let messaging = null;
let messagingInitPromise = null;

export const ensureMessaging = async () => {
    if (messaging) return messaging;
    if (messagingInitPromise) return messagingInitPromise;

    messagingInitPromise = (async () => {
        try {
            if (isNativeApp() || typeof window === 'undefined') return null;
            if (!('serviceWorker' in navigator)) return null;
            const supported = await isMessagingSupported().catch(() => false);
            if (!supported) {
                safeConsoleLog('Firebase Messaging unsupported in this browser');
                return null;
            }
            messaging = getMessaging(app);
            safeConsoleLog('Firebase Messaging initialized');
            return messaging;
        } catch (err) {
            safeConsoleWarn('Firebase Messaging not available:', err);
            return null;
        }
    })();

    return messagingInitPromise;
};

export const getFcmTokenWithRegistration = async () => {
    const fcm = await ensureMessaging();
    if (!fcm) return null;

    // Reuse the PWA worker. A second root-scoped SW (firebase-messaging-sw.js)
    // steals `clients.claim` from VitePWA autoUpdate and reloads the tab every few seconds.
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => {
        const scriptUrl = String(
            registration.active?.scriptURL
            || registration.waiting?.scriptURL
            || registration.installing?.scriptURL
            || '',
        );
        if (scriptUrl.includes('firebase-messaging-sw.js')) {
            return registration.unregister();
        }
        return Promise.resolve();
    }));

    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (!registration) return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
    const fcmToken = await getToken(fcm, {
        vapidKey,
        serviceWorkerRegistration: registration,
    });

    return fcmToken || null;
};

/**
 * Get FCM token when permission is already granted (no browser prompt).
 * Returns the token string or null.
 */
export const getFcmTokenIfGranted = async () => {
    try {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
            return null;
        }

        if (Notification.permission !== 'granted') {
            return null;
        }

        const fcm = await ensureMessaging();
        if (!fcm) return null;

        return await getFcmTokenWithRegistration();
    } catch (error) {
        if (import.meta.env.DEV) {
            safeConsoleWarn('Push notifications unavailable:', error);
        }
        return null;
    }
};

/**
 * Request notification permission and get FCM token.
 * Returns the token string or null.
 */
export const requestNotificationPermission = async () => {
    try {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
            return null;
        }

        const fcm = await ensureMessaging();
        if (!fcm) return null;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return null;
        }

        return await getFcmTokenWithRegistration();
    } catch (error) {
        // Common in dev / before SW is active — push is optional
        if (import.meta.env.DEV) {
            safeConsoleWarn('Push notifications unavailable:', error);
        }
        return null;
    }
};

/**
 * Listen for foreground messages.
 * @param {function} callback - Called with the message payload.
 * @returns {function} Unsubscribe function (sync; no-op until messaging is ready).
 */
export const onForegroundMessage = (callback) => {
    let unsub = () => {};
    let cancelled = false;

    void ensureMessaging().then((fcm) => {
        if (cancelled || !fcm) return;
        unsub = onMessage(fcm, callback);
    });

    return () => {
        cancelled = true;
        unsub();
    };
};
