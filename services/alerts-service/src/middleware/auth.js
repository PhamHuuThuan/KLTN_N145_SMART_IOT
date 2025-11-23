import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

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
    logger.warn('No token provided for authenticated route');
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');-
    logger.info('Token decoded successfully:', { sub: decoded.sub, email: decoded.email });
    req.user = decoded;
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
 * Check if user has required role
 */
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role || 'user';
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Check if user can access resource
 */
export const checkResourceAccess = (resourceParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.params[resourceParam];
    const currentUserId = req.user.sub;
    const currentUserObjectId = req.user._id;

    // Admin can access all resources
    if (req.user.role === 'admin') {
      return next();
    }

    // Service-to-service authentication (for internal service calls)
    if (req.user.service && req.user.role === 'service') {
      logger.info(`Service-to-service access: ${req.user.service} accessing user ${userId}`);
      return next();
    }

    // User can only access their own resources
    const isMatch = currentUserId === userId || 
                    currentUserObjectId === userId ||
                    String(currentUserId) === String(userId) ||
                    String(currentUserObjectId) === String(userId);

    if (!isMatch) {
      logger.warn(`Access denied: User ${currentUserId} (ObjectId: ${currentUserObjectId}) trying to access ${userId}'s resource`);
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only access your own resources'
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
      req.user = decoded;
    } catch (error) {
      logger.warn('Optional auth failed:', error.message);
    }
  }

  next();
};
