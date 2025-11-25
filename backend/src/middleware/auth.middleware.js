const jwtSimple = require('jwt-simple');
const logger = require('../utils/logger');

const SECRET = process.env.JWT_SECRET || 'your_secret_key';

/**
 * Token validation middleware
 */
const validateToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'No authorization token provided'
      });
    }

    const decoded = jwtSimple.decode(token, SECRET);
    req.user = decoded;
    req.token = token;
    
    next();
  } catch (err) {
    logger.error(`Token validation failed: ${err.message}`);
    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
};

/**
 * Refresh token validation
 */
const validateRefresh = (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required'
      });
    }

    const decoded = jwtSimple.decode(refreshToken, SECRET);
    req.user = decoded;
    
    next();
  } catch (err) {
    logger.error(`Refresh token validation failed: ${err.message}`);
    return res.status(401).json({
      error: 'Invalid refresh token'
    });
  }
};

/**
 * Admin role check
 */
const isAdmin = (req, res, next) => {
  if (!req.user || !['super_admin', 'admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Admin access required'
    });
  }
  next();
};

/**
 * Super admin role check
 */
const isSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Super admin access required'
    });
  }
  next();
};

/**
 * Student role check
 */
const isStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({
      error: 'Student access required'
    });
  }
  next();
};

module.exports = {
  validateToken,
  validateRefresh,
  isAdmin,
  isSuperAdmin,
  isStudent
};
