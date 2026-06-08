const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

const isDev = process.env.NODE_ENV !== 'production';

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      if (isDev) {
        console.warn('[admin] Login failed for:', email);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    const secret = getJwtSecret();

    const accessToken = jwt.sign(
      { role: 'admin', email },
      secret,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { role: 'admin', email, type: 'refresh' },
      secret,
      { expiresIn: '7d' }
    );

    if (isDev) {
      console.log('[admin] Login successful:', email);
    }

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { email, role: 'admin' },
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
