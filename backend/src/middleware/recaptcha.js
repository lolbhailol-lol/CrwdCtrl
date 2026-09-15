const axios = require('axios');

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE) || 0.5;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Express middleware factory that verifies a reCAPTCHA v3 token sent by the
 * client as `req.body.recaptchaToken`.
 *
 * Behavior:
 * - No-op when `RECAPTCHA_SECRET_KEY` is not configured (feature disabled).
 * - Fail closed in production when the secret is configured and the client
 *   sent no token — otherwise a client-side site-key omission silently
 *   disables bot protection for everyone.
 * - Non-production keeps the historic "warn and skip" behavior so local dev
 *   without VITE_RECAPTCHA_SITE_KEY still works.
 * - On a Google/network outage we still fail open. Rate limiters guard the
 *   flood case; blocking real users because Google's endpoint blipped is
 *   worse than a small window of unenforced captcha.
 *
 * @param {string} [expectedAction] action name to assert against the token.
 */
const verifyRecaptcha = (expectedAction) => async (req, res, next) => {
  if (!SECRET_KEY) return next();

  const token = req.body && req.body.recaptchaToken;
  if (!token) {
    if (IS_PRODUCTION) {
      return res.status(400).json({
        success: false,
        code: 'CAPTCHA_TOKEN_REQUIRED',
        message: 'Captcha verification is required. Refresh the page and try again.',
      });
    }
    console.warn(
      '⚠️ reCAPTCHA: request has no token, skipping verification (non-production). ' +
      'Set VITE_RECAPTCHA_SITE_KEY on the frontend to enforce captcha in production.'
    );
    return next();
  }

  try {
    const params = new URLSearchParams({ secret: SECRET_KEY, response: token });
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    if (clientIp) params.append('remoteip', clientIp);

    const { data } = await axios.post(VERIFY_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000,
    });

    if (!data.success) {
      return res.status(400).json({
        success: false,
        code: 'CAPTCHA_FAILED',
        message: 'Captcha verification failed. Please try again.',
      });
    }

    if (expectedAction && data.action && data.action !== expectedAction) {
      return res.status(400).json({
        success: false,
        code: 'CAPTCHA_ACTION_MISMATCH',
        message: 'Captcha action mismatch. Please try again.',
      });
    }

    if (typeof data.score === 'number' && data.score < MIN_SCORE) {
      return res.status(429).json({
        success: false,
        code: 'CAPTCHA_LOW_SCORE',
        message: 'Suspicious activity detected. Please try again later.',
      });
    }

    req.recaptcha = { score: data.score, action: data.action };
  } catch (err) {
    console.error('❌ reCAPTCHA verification error:', err.message);
    // Fail open on Google/network outage — rate limiter still caps abuse.
  }

  // Keep the token out of downstream controllers/payloads.
  if (req.body) delete req.body.recaptchaToken;
  return next();
};

module.exports = { verifyRecaptcha };
