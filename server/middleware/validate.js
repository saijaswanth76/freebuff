const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Collects express-validator results and returns a single 400 response
 * with a readable `details` array instead of failing silently.
 */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((e) => ({
    field: e.path || e.param || '',
    message: e.msg,
  }));
  next(ApiError.badRequest(details[0].message, details));
};

module.exports = validate;
