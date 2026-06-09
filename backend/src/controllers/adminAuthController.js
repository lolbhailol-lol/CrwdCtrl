const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getJwtSecret } = require('../config/jwtSecret');

const isDev = process.env.NODE_ENV !== 'production';
const isProd = process.env.NODE_ENV === 'production';

/**
 * Verify admin password against bcrypt hash (production) or legacy plaintext (dev fallback).
 */
async function verifyAdminPassword(password) {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const legacyPlain = process.env.ADMIN_PASSWORD;

  if (hash) {
    return bcrypt.compare(password, hash);
  }

  if (isProd) {
    console.error('[admin] ADMIN_PASSWORD_HASH is required in production');
    return false;
  }

  if (legacyPlain) {
    console.warn(
      '[admin] ⚠️ Using plaintext ADMIN_PASSWORD — set ADMIN_PASSWORD_HASH (run scripts/hash-admin-password.js)'
    );
    return password === legacyPlain;
  }

  return false;
}

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL?.trim();

    if (!adminEmail || !email || email.trim() !== adminEmail) {
      if (isDev) {
        console.warn('[admin] Login failed for:', email);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    const passwordValid = await verifyAdminPassword(password);
    if (!passwordValid) {
      if (isDev) {
        console.warn('[admin] Login failed for:', email);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    const secret = getJwtSecret();

    const accessToken = jwt.sign({ role: 'admin', email: adminEmail }, secret, { expiresIn: '1h' });

    const refreshToken = jwt.sign(
      { role: 'admin', email: adminEmail, type: 'refresh' },
      secret,
      { expiresIn: '7d' }
    );

    if (isDev) {
      console.log('[admin] Login successful:', adminEmail);
    }

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { email: adminEmail, role: 'admin' },
    });
  } catch (error) {
    console.error('[admin] Login error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
};

exports.refreshAdminToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    const secret = getJwtSecret();

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch (error) {
      if (isDev) {
        console.warn('[admin] Refresh token verification failed:', error.message);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    const newAccessToken = jwt.sign(
      { role: 'admin', email: decoded.email },
      secret,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[admin] Token refresh error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
    });
  }
};
