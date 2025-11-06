import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  logger.debug('Auth header:', authHeader);
  logger.debug('Extracted token:', token ? token.substring(0, 20) + '...' : 'null');

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-strong-secret');
    req.user = {
      ...decoded,
      userId: decoded.userId || decoded.sub,
      id: decoded.sub || decoded.userId
    };
    next();
  } catch (error) {
    logger.error('JWT verification failed:', error.message);
    return res.status(401).json({ 
      success: false, 
      error: 'invalid_token',
      message: 'Invalid or expired token' 
    });
  }
};
