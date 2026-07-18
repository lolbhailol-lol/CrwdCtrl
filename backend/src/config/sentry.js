const Sentry = require('@sentry/node');

function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || `crwdctrl-api@${process.env.npm_package_version || '1.0.0'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event, hint) {
      if (event.request?.headers?.authorization) {
        delete event.request.headers.authorization;
      }
      // Expected client upload validation — return 4xx to the client, don't alert
      const err = hint?.originalException;
      const message = String(err?.message || event?.exception?.values?.[0]?.value || '');
      const isMulter = err?.name === 'MulterError' || err?.code === 'LIMIT_UNEXPECTED_FILE';
      const isUploadValidation =
        /Only image files are allowed/i.test(message) ||
        /File type not allowed/i.test(message) ||
        /Unexpected upload field/i.test(message) ||
        /Unexpected field/i.test(message);
      if (isMulter || isUploadValidation) {
        return null;
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
