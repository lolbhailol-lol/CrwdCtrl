const Sentry = require('@sentry/node');

function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || `crwdctrl-api@${process.env.npm_package_version || '1.0.0'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request?.headers?.authorization) {
        delete event.request.headers.authorization;
      }
      return event;
    },
  });
}

function captureException(err, context) {
  if (!process.env.SENTRY_DSN?.trim()) return;
  Sentry.captureException(err, context);
}

module.exports = { initSentry, captureException, Sentry };
