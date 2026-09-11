const jwt = require('jsonwebtoken');
const User = require('../model/usermodel');
const { getJwtSecret } = require('../config/jwtSecret');

const isDev = process.env.NODE_ENV === 'development';

function isHuntEnrollmentDecoded(decoded) {
  if (!decoded?.userId) return false;
  if (decoded.tokenType === 'hunt' || decoded.aud === 'campus-hunt') return true;
  return !!(decoded.huntEventId && decoded.huntTeamId);
}

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required',
            });
        }

        const token = authHeader.substring(7);
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Empty access token',
            });
        }

        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret);

        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            return res.status(401).json({
                success: false,
                message: 'Token has expired',
            });
        }

        const requestPath = String(req.originalUrl || req.url || '');
        const isCampusHuntRoute = requestPath.includes('/campus-hunt');
        if (isHuntEnrollmentDecoded(decoded) && !isCampusHuntRoute) {
            return res.status(403).json({
                success: false,
                message: 'Hunt session cannot access this part of CrwdCtrl. Sign in with Google for the main app.',
                code: 'HUNT_SESSION_ONLY',
            });
        }

        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists',
            });
        }

        req.user = {
            userId: decoded.userId,
            role: user.role,
            // Campus Hunt session binding (optional; set on team enter)
            huntTeamId: decoded.huntTeamId || null,
            huntEventId: decoded.huntEventId || null,
            huntRole: decoded.huntRole || null,
        };
        next();
    } catch (error) {
        if (isDev) console.error('User auth error:', error.message);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token',
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired',
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

const authorizeRoles = (...roles) => (req, res, next) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.',
            });
        }

        next();
    } catch (error) {
        if (isDev) console.error('Authorization error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

/** Attach req.user when a valid Bearer token is present; otherwise continue as guest. */
const optionalAuthenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.substring(7);
        if (!token) return next();

        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret);
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            return next();
        }
        if (!decoded.userId) return next();

        const user = await User.findById(decoded.userId).select('_id role');
        if (!user) return next();

        req.user = {
            userId: decoded.userId,
            role: user.role,
            huntTeamId: decoded.huntTeamId || null,
            huntEventId: decoded.huntEventId || null,
            huntRole: decoded.huntRole || null,
        };
        next();
    } catch {
        next();
    }
};

module.exports = {
    authenticateToken,
    authorizeRoles,
    optionalAuthenticateToken,
};
