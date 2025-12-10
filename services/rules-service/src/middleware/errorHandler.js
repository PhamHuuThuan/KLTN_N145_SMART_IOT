import logger from '../utils/logger.js';

// Global error handler middleware
export const errorHandler = (err, req, res, next) => {
  logger.error('❌ Error:', err);

  if (err?.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map(e => e.message);
    return res.status(400).json({ success: false, message: 'Validation Error', errors });
  }

  if (err && err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(400).json({ success: false, message: `${field} already exists` });
  }

  if (err?.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  res.status(err?.status || 500).json({
    success: false,
    message: err?.message || 'Internal Server Error'
  });
};

// 404 handler
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};
