const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    clinicId: user.clinic_id || user.clinicId || null,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Authentication middleware
 * Verifies JWT token or handles dev override if configured
 */
function authenticateToken(req, res, next) {
  // If authentication is disabled globally for testing
  if (config.disableAuth) {
    req.user = {
      id: req.headers['x-user-id'] || 'HW-DEMO-01',
      username: 'dev_user',
      name: 'Development User',
      role: req.headers['x-user-role'] || 'health_worker',
      clinicId: req.headers['x-clinic-id'] || 'CLINIC-RURAL-01',
    };
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Also support dev headers if in development and no token is present
  if (!token) {
    if (config.nodeEnv === 'development' && req.headers['x-user-role']) {
      req.user = {
        id: req.headers['x-user-id'] || 'DEV-USER-01',
        username: req.headers['x-username'] || 'dev_user',
        name: req.headers['x-user-name'] || 'Dev User',
        role: req.headers['x-user-role'],
        clinicId: req.headers['x-clinic-id'] || 'CLINIC-RURAL-01',
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'Access denied. No authentication token provided.',
      code: 'UNAUTHORIZED',
    });
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired authentication token.',
        code: 'FORBIDDEN',
      });
    }

    req.user = decoded;
    next();
  });
}

/**
 * Optional authentication middleware: Populates req.user if token is valid, doesn't block if missing
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    if (req.headers['x-user-role']) {
      req.user = {
        id: req.headers['x-user-id'] || 'DEV-USER-01',
        role: req.headers['x-user-role'],
        clinicId: req.headers['x-clinic-id'] || null,
      };
    }
    return next();
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (!err && decoded) {
      req.user = decoded;
    }
    next();
  });
}

/**
 * Role-based authorization middleware
 * @param {string|string[]} roles Allowed roles (e.g. ['doctor', 'health_worker'])
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required for this resource.',
        code: 'UNAUTHORIZED',
      });
    }

    if (!allowed.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: `Permission denied. Required role: ${allowed.join(' or ')}. Your role: ${req.user.role}`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  requireRole,
};
