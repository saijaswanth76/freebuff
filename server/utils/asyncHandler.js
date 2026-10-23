/**
 * Wraps an async route handler so rejected promises are forwarded to the
 * central error-handling middleware instead of hanging the request.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
