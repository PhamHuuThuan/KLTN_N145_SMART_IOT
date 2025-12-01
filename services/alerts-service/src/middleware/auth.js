import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('No token provided for authenticated route');
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
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
    const currentUserObjectId = req.user.id;

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.service && req.user.role === 'service') {
      return next();
    }

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
