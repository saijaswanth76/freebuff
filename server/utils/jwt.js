const jwt = require('jsonwebtoken');

const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'cfds_token';
const DEFAULT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is missing. Copy .env.example to .env and set a strong secret.');
  }
  return secret;
};

/** Sign a short-lived access token containing only id + role. */
const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, getJwtSecret(), {
    expiresIn: DEFAULT_EXPIRES_IN,
  });

const verifyToken = (token) => jwt.verify(token, getJwtSecret());

/**
 * Cookie options.
 * - httpOnly: JavaScript cannot read the token (XSS protection)
 * - sameSite: 'lax' by default (the frontend proxies /api, so the cookie is
 *   first-party). Set JWT_COOKIE_SAME_SITE=none when a frontend on another
 *   origin calls the API directly with credentials.
 * - secure: only over HTTPS (enabled automatically in production)
 */
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.JWT_COOKIE_SAME_SITE || 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 1 day, mirrors JWT_EXPIRES_IN default
  path: '/',
});

module.exports = { signToken, verifyToken, cookieOptions, COOKIE_NAME };
