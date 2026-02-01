const express = require('express');
const jwt = require('jsonwebtoken');
const { setCookieOptions, setRefreshCookieOptions } = require('../config/cookieConfig');
const { admin, firebaseInitialized } = require('../config/firebaseConfig');

const router = express.Router();

const isInstagramBrowser = (req) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  return ua.includes('instagram') || ua.includes('fban') || ua.includes('fbav') || ua.includes('fb4a');
};

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientType = req.headers['x-client-type'] || 'unknown';

    console.log(`[Auth/Login] ${clientType}:`, { email });

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required', status: 400 });
    }

    // Find user in database
    const User = require('../models/User');
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials', status: 401 });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.ADMIN_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    res.cookie('authToken', token, setCookieOptions);
    res.cookie('refreshToken', refreshToken, setRefreshCookieOptions);

    console.log(`[Auth/Login] Success: ${user.email}`);

    res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: { id: user._id, email: user.email, name: user.name || '' },
    });
  } catch (error) {
    console.error('[Auth/Login] Error:', error.message);
    res.status(500).json({ message: 'Login failed', status: 500 });
  }
});

// Google Sign-In Route
router.post('/google-signin', async (req, res) => {
  try {
    const { idToken, email, name } = req.body;
    const clientType = req.headers['x-client-type'] || 'unknown';
    const isInstagram = isInstagramBrowser(req);

    console.log(`[Auth/GoogleSignIn] ${isInstagram ? 'INSTAGRAM' : clientType}:`, { email });

    if (!idToken) {
      return res.status(400).json({ message: 'ID token required', status: 400 });
    }

    let decodedToken;
    if (firebaseInitialized) {
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        console.error('[Auth/GoogleSignIn] Token verification failed');
        return res.status(401).json({ message: 'Invalid ID token', status: 401 });
      }
    } else {
      decodedToken = { email, uid: 'unknown' };
    }

    const User = require('../models/User');
    let user = await User.findOne({ email: decodedToken.email });

    if (!user) {
      user = await User.create({
        email: decodedToken.email,
        name: name || decodedToken.name || '',
        googleId: decodedToken.uid,
        password: null,
      });
      console.log(`[Auth/GoogleSignIn] New user created: ${user.email}`);
    } else if (!user.googleId) {
      user.googleId = decodedToken.uid;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, provider: 'google' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.ADMIN_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    // For Instagram: use more permissive cookie settings
    const cookieOpts = isInstagram
      ? {
          httpOnly: false, // Instagram WebView may need access
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          domain: process.env.COOKIE_DOMAIN || 'localhost',
          path: '/',
        }
      : setCookieOptions;

    res.cookie('authToken', token, cookieOpts);
    res.cookie('refreshToken', refreshToken, cookieOpts);

    console.log(`[Auth/GoogleSignIn] Success: ${user.email}`);

    // Always return token in body (critical for Instagram)
    res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: { id: user._id, email: user.email, name: user.name, provider: 'google' },
    });
  } catch (error) {
    console.error('[Auth/GoogleSignIn] Error:', error.message);
    res.status(500).json({ message: 'Google sign-in failed', status: 500 });
  }
});

// Refresh Token Route
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required', status: 401 });
    }

    const decoded = jwt.verify(refreshToken, process.env.ADMIN_REFRESH_SECRET);
    const User = require('../models/User');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'User not found', status: 401 });
    }

    const newToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('authToken', newToken, setCookieOptions);

    res.status(200).json({ success: true, token: newToken });
  } catch (error) {
    console.error('[Auth/Refresh] Error:', error.message);
    res.status(401).json({ message: 'Token refresh failed', status: 401 });
  }
});

// Logout Route
router.post('/logout', (req, res) => {
  res.clearCookie('authToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.status(200).json({ success: true, message: 'Logout successful' });
});

module.exports = router;
