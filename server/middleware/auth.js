const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, COOKIE_NAME } = require('../utils/jwt');

/** Extract the JWT from the httpOnly cookie (preferred) or an Authorization header. */
const extractToken = (req) => {
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
};

/**
 * Authentication guard: verifies the JWT and loads the fresh user record
 * (so deactivated accounts lose access immediately).
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Please log in to continue');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Your session has expired. Please log in again.');
    throw ApiError.unauthorized('Invalid session. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Your account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact the administrator.');

  req.user = user;
  next();
});

/**
 * Optional authentication for public routes: attaches req.user when a valid
 * token is present, but silently continues as anonymous otherwise.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub);
      if (user && user.isActive) req.user = user;
    }
  } catch (err) {
    req.user = undefined; // expired / invalid token -> behave like a visitor
  }
  next();
};

/** Role-based authorization, e.g. authorize('ADMIN') or authorize('NGO', 'VOLUNTEER'). */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };

/**
 * NGOs must not be REJECTED to act. Verification can be made mandatory for
 * PENDING NGOs with NGO_REQUIRE_VERIFICATION=true (see README).
 */
const requireActiveNgo = (req, res, next) => {
  const ngo = req.user;
  if (ngo.role !== 'NGO') return next(ApiError.forbidden('Only NGO accounts can perform this action'));
  if (ngo.verificationStatus === 'REJECTED') {
    return next(ApiError.forbidden('Your NGO registration was rejected. Contact the administrator.'));
  }
  const mustBeVerified = String(process.env.NGO_REQUIRE_VERIFICATION || 'false').toLowerCase() === 'true';
  if (mustBeVerified && ngo.verificationStatus !== 'VERIFIED') {
    return next(ApiError.forbidden('Your NGO account is pending administrator verification.'));
  }
  next();
};

module.exports = { protect, authorize, requireActiveNgo, optionalAuth };
