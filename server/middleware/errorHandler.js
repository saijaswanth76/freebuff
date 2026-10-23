const ApiError = require('../utils/ApiError');
const { fail } = require('../utils/respond');

/** 404 for unknown API routes (mounted after all routers). */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Central error handler.
 * - Translates Mongoose validation / cast / duplicate-key errors into clean 4xx responses.
 * - Never exposes stack traces or password hashes in production.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller' : err.message;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid session. Please log in again.';
  }

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} ->`, err);
  }

  const payload = { success: false, message };
  if (details) payload.details = details;
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500 && err.stack) {
    payload.stack = err.stack.split('\n').slice(0, 6);
  }

  res.status(statusCode).json(payload);
};

module.exports = { notFound, errorHandler, ApiError };
