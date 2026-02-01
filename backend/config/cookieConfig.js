// Instagram in-app browser has stricter cookie policies
// Use None/Secure only when absolutely necessary

const setCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // Use 'None' for Instagram (requires Secure flag)
  // Use 'Lax' for regular mobile browsers
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  domain: process.env.COOKIE_DOMAIN || 'localhost',
  path: '/',
};

const setRefreshCookieOptions = {
  ...setCookieOptions,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

module.exports = { setCookieOptions, setRefreshCookieOptions };
