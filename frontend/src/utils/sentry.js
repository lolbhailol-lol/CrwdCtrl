import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request?.headers?.Authorization) {
        delete event.request.headers.Authorization;
      }
      return event;
    },
  });

  initialized = true;
}

export function captureException(error, context) {
  if (!import.meta.env.VITE_SENTRY_DSN?.trim()) return;
  Sentry.captureException(error, context);
}

export { Sentry };
