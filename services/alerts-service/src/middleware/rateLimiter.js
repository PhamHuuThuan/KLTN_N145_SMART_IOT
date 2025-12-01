import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later'
    });
  }
});
