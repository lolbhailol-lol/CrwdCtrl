// Firebase Cloud Messaging Service Worker
// Values injected at build/dev time from VITE_FIREBASE_* (never commit real keys here).

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '__VITE_FIREBASE_API_KEY__',
  authDomain: '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId: '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket: '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__VITE_FIREBASE_APP_ID__',
});

const messaging = firebase.messaging();

function redact(value) {
  return String(value || '')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]')
    .replace(/apiKey=([^&\s"']+)/gi, 'apiKey=[REDACTED]');
}

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'CrwdCtrl';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      link: payload.data?.link || '/',
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);

  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      client.postMessage({ type: 'crwdctrl:refresh-notifications' });
    }
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(link);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});

// Silence unhandled SW errors that may include Firebase URLs with apiKey=
self.addEventListener('error', (event) => {
  event.preventDefault();
  // eslint-disable-next-line no-console
  console.error('[firebase-messaging-sw]', redact(event.message || 'error'));
});
