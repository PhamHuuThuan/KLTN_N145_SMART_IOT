import logger from '../utils/logger.js';

export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    logger.warn('Admin access denied: No user in request');
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  logger.debug('Admin check - req.user:', {
    sub: req.user.sub,
    userId: req.user.userId,
    role: req.user.role,
    allFields: Object.keys(req.user)
  });

  const userRole = req.user.role || 'user';
  
  if (userRole !== 'admin') {
    logger.warn(`Admin access denied for user ${req.user.userId || req.user.sub} with role ${userRole}. Full user object:`, req.user);
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      debug: {
        userRole,
        hasRole: !!req.user.role,
        allRoles: req.user.role
      }
    });
  }

  next();
};
