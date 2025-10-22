import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

// JWT secret - should match other services
const JWT_SECRET = process.env.JWT_SECRET || 'your-strong-secret';

/**
 * Authenticate JWT token
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  logger.info(`Auth request to ${req.method} ${req.path}`, { 
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    url: req.url 
  });

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    logger.info('Token decoded successfully:', { 
      userId: decoded.sub,
      role: decoded.role 
    });
    next();
  } catch (error) {
    logger.error('Token verification failed:', error.message);
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Check if user can access resource (device ownership)
 */
export const checkDeviceOwnership = async (req, res, next) => {
  const userId = req.user.sub;
  const deviceId = req.params.deviceId;

  logger.info(`Checking device ownership:`, { userId, deviceId });

  // If no deviceId, skip ownership checks
  if (!deviceId) {
    logger.info(`No deviceId provided, skipping ownership check`);
    return next();
  }

  // Admin can access all devices
  if (req.user.role === 'admin' || req.user.role === 'service') {
    logger.info(`Admin access granted for device ${deviceId}`);
    return next();
  }

  next();
};

/**
 * Check if user can access resource by ownerId
 */
export const checkResourceAccess = (resourceParam = 'ownerId') => {
  return (req, res, next) => {
    const userId = req.user.sub;
    const resourceOwnerId = req.params[resourceParam] || req.query[resourceParam];

    logger.info(`Checking resource access:`, { userId, resourceOwnerId, resourceParam });

    // Admin can access all resources
    if (req.user.role === 'admin') {
      logger.info(`Admin access granted for ${resourceParam}: ${resourceOwnerId}`);
      return next();
    }

    // Service-to-service authentication (for internal service calls)
    if (req.user.service && req.user.role === 'service') {
      logger.info(`Service-to-service access: ${req.user.service} accessing ${resourceParam} ${resourceOwnerId}`);
      return next();
    }

    // User can only access their own resources
    if (userId !== resourceOwnerId) {
      logger.warn(`Access denied: User ${userId} trying to access ${resourceOwnerId}'s resource`);
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only access your own resources'
      });
    }

    logger.info(`Access granted for user ${userId} to ${resourceParam} ${resourceOwnerId}`);
    next();
  };
};

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};
