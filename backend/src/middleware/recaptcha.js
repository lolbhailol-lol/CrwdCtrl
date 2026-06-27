const axios = require('axios');

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE) || 0.5;

/**
 * Express middleware factory that verifies a reCAPTCHA v3 token sent by the
 * client as `req.body.recaptchaToken`.
 *
 * - No-op (calls next) when RECAPTCHA_SECRET_KEY is not configured, so existing
 *   flows keep working until keys are added.
 * - Fails open on a Google/network outage so legitimate users are never locked
 *   out by an upstream problem.
 *
 * @param {string} [expectedAction] action name to assert against the token (e.g. 'login').
 */
const verifyRecaptcha = (expectedAction) => async (req, res, next) => {
  if (!SECRET_KEY) return next();

  const token = req.body && req.body.recaptchaToken;
  if (!token) {
    // No token from the client. This usually means the frontend site key
    // (VITE_RECAPTCHA_SITE_KEY) is not configured even though the backend secret
    // is — a one-sided/partial setup. Fail open so legitimate users are never
    // locked out by a config mismatch; tokens that ARE sent still get verified.
    console.warn(
      '⚠️ reCAPTCHA: request has no token, skipping verification. ' +
      'Set VITE_RECAPTCHA_SITE_KEY on the frontend to enforce captcha.'
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
        message: 'Captcha verification failed. Please try again.',
      });
    }

    if (expectedAction && data.action && data.action !== expectedAction) {
      return res.status(400).json({
        success: false,
        message: 'Captcha action mismatch. Please try again.',
      });
    }

    if (typeof data.score === 'number' && data.score < MIN_SCORE) {
      return res.status(429).json({
        success: false,
        message: 'Suspicious activity detected. Please try again later.',
      });
    }

    req.recaptcha = { score: data.score, action: data.action };
  } catch (err) {
    console.error('❌ reCAPTCHA verification error:', err.message);
    // Fail open — never block real users because Google is unreachable.
  }

  // Keep the token out of downstream controllers/payloads.
  if (req.body) delete req.body.recaptchaToken;
  return next();
};

module.exports = { verifyRecaptcha };
