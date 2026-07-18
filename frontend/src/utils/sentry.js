import * as Sentry from '@sentry/react';
import { isChunkLoadError } from './chunkError.js';

let initialized = false;

/** Noise / environment errors that should not page on-call. */
function shouldDropSentryEvent(event, hint) {
  const error = hint?.originalException;
  const values = event?.exception?.values || [];
  const message = [
    error?.message,
    error?.code,
    ...values.map((v) => v?.value),
    ...values.map((v) => v?.type),
    event?.message,
  ]
    .filter(Boolean)
    .join(' ');

  if (isChunkLoadError(error) || isChunkLoadError({ message })) return true;

  // Firebase / browser capability
  if (/messaging\/unsupported-browser/i.test(message)) return true;
  if (/firebaseinstallations\.googleapis\.com/i.test(message)) return true;
  if (/Failed to fetch.*firebase|Load failed.*firebase/i.test(message)) return true;

  // Capacitor / WebView bridge teardown (Instagram, Android WebView)
  if (/webkit\.messageHandlers/i.test(message)) return true;
  if (/Java object is gone/i.test(message)) return true;
  if (/postMessage/i.test(message) && /Java object/i.test(message)) return true;

  // IndexedDB / private mode / user cleared site data
  if (/IDBDatabase|Indexed Database|database connection is closing/i.test(message)) return true;
  if (/Database deleted by request of the user/i.test(message)) return true;
  if (/Connection to Indexed Database server lost/i.test(message)) return true;

  // Expected organizer business validation (already toasted in UI)
  if (/Cannot approve — no payment screenshot/i.test(message)) return true;
  if (/Cannot approve — run is at capacity/i.test(message)) return true;

  return false;
}

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      /messaging\/unsupported-browser/i,
      /Importing a module script failed/i,
      /Failed to fetch dynamically imported module/i,
      /Java object is gone/i,
      /webkit\.messageHandlers/i,
      /IDBDatabase/i,
      /Indexed Database/i,
      /Database deleted by request of the user/i,
    ],
    beforeSend(event, hint) {
      if (event.request?.headers?.Authorization) {
        delete event.request.headers.Authorization;
      }
      if (shouldDropSentryEvent(event, hint)) return null;
      return event;
    },
  });

  initialized = true;
}

export function captureException(error, context) {
  if (!import.meta.env.VITE_SENTRY_DSN?.trim()) return;
  if (shouldDropSentryEvent({ exception: { values: [{ value: error?.message, type: error?.name }] } }, { originalException: error })) {
    return;
  }
  Sentry.captureException(error, context);
}

export { Sentry };
