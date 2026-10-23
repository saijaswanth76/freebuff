/** Consistent JSON response shapes for the whole API. */
const ok = (res, data = null, message = 'OK', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const fail = (res, statusCode, message, details) =>
  res.status(statusCode).json({ success: false, message, ...(details ? { details } : {}) });

module.exports = { ok, fail };
