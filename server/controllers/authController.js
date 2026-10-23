const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { signToken, cookieOptions, COOKIE_NAME } = require('../utils/jwt');

const PUBLIC_ROLES = ['DONOR', 'NGO', 'VOLUNTEER']; // ADMIN registration is intentionally impossible

const issueSession = (res, user) => {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  return token;
};

/**
 * POST /api/auth/register
 * Public registration. The ADMIN role is not part of the allowed roles, so an
 * administrator account can only be created with the documented script.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, address, city, organizationName, organizationDescription, donorCategory } = req.body;

  if (!PUBLIC_ROLES.includes(role)) {
    throw ApiError.badRequest('Choose a valid account type: Food Donor, NGO or Volunteer');
  }
  if (role === 'NGO' && !organizationName) {
    throw ApiError.badRequest('Organization name is required for NGO accounts', [
      { field: 'organizationName', message: 'Organization name is required for NGO accounts' },
    ]);
  }

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    passwordHash,
    phone,
    role,
    address: address || '',
    city,
    organizationName: role === 'NGO' ? organizationName : '',
    organizationDescription: role === 'NGO' ? organizationDescription || '' : '',
    donorCategory: role === 'DONOR' ? donorCategory || 'Household' : '',
    verificationStatus: role === 'NGO' ? 'PENDING' : 'NOT_REQUIRED',
  });

  const token = issueSession(res, user);
  return ok(res, { user, token }, 'Account created successfully', 201);
});

/**
 * POST /api/auth/login
 * One generic error message is returned for unknown email and wrong password
 * so the endpoint cannot be used to enumerate accounts.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
  const invalid = ApiError.unauthorized('Invalid email or password');
  if (!user) throw invalid;

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw invalid;

  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated. Contact the administrator.');
  }

  const token = issueSession(res, user);
  return ok(res, { user, token }, 'Logged in successfully');
});

/** POST /api/auth/logout */
const logout = asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return ok(res, null, 'Logged out successfully');
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => ok(res, { user: req.user }, 'OK'));

module.exports = { register, login, logout, me };
