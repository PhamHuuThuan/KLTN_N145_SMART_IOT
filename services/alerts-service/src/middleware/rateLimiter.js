import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

// General rate limiter
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
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

// Strict rate limiter for notification sending
export const notificationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 notification requests per minute
  message: {
    success: false,
    message: 'Too many notification requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Notification rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(429).json({
      success: false,
      message: 'Too many notification requests, please try again later'
    });
  }
});

// Bulk notification rate limiter
export const bulkNotificationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 bulk notification requests per 5 minutes
  message: {
    success: false,
    message: 'Too many bulk notification requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Bulk notification rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(429).json({
      success: false,
      message: 'Too many bulk notification requests, please try again later'
    });
  }
});

// FCM token management rate limiter
export const fcmTokenRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 FCM token operations per minute
  message: {
    success: false,
    message: 'Too many FCM token operations, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Test notification rate limiter
export const testNotificationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 test notifications per minute
  message: {
    success: false,
    message: 'Too many test notification requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});
