const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

const ACCESS_TYPE = 'trek_booking_access';
const ACCESS_TTL = '30d';

/**
 * Longer-lived token so guests can open ticket/QR/invoice without an account.
 */
function signTrekBookingAccess({ bookingId, trekId, userEmail }) {
  return jwt.sign(
    {
      type: ACCESS_TYPE,
      bookingId: String(bookingId),
      trekId: String(trekId),
      userEmail: userEmail ? String(userEmail).toLowerCase() : undefined,
    },
    getJwtSecret(),
    { expiresIn: ACCESS_TTL },
  );
}

function verifyTrekBookingAccess(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(String(token), getJwtSecret());
    if (decoded?.type !== ACCESS_TYPE || !decoded?.bookingId) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Read access token from Authorization Bearer, x-booking-access header, or ?access= */
function getTrekBookingAccessFromRequest(req) {
  const header = req.headers['x-booking-access'];
  if (header) {
    const decoded = verifyTrekBookingAccess(header);
    if (decoded) return decoded;
  }
  const query = req.query?.access;
  if (query) {
    const decoded = verifyTrekBookingAccess(query);
    if (decoded) return decoded;
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const decoded = verifyTrekBookingAccess(auth.substring(7));
    if (decoded) return decoded;
  }
  return null;
}

module.exports = {
  signTrekBookingAccess,
  verifyTrekBookingAccess,
  getTrekBookingAccessFromRequest,
  ACCESS_TYPE,
};
