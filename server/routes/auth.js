const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { register, login, logout, me } = require('../controllers/authController');

// Sensible rate limits for credential endpoints (disabled while testing).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 10000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().withMessage('Please provide a valid email address').bail(),
  body('password')
    .isLength({ min: 6, max: 72 })
    .withMessage('Password must be at least 6 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain at least one letter'),
  body('phone')
    .matches(/^[0-9+\-\s()]{7,15}$/)
    .withMessage('Please provide a valid phone number (7-15 digits)'),
  body('role').isIn(['DONOR', 'NGO', 'VOLUNTEER']).withMessage('Choose a valid account type'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('address').optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage('Address is too long'),
  body('organizationName').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('organizationDescription').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body('donorCategory').optional({ nullable: true }).trim(),
  body('terms').custom((value) => value === true || value === 'true').withMessage('You must accept the terms and conditions'),
];

const loginRules = [
  body('email').isEmail().withMessage('Please provide a valid email address').bail(),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.post('/logout', logout);
router.get('/me', protect, me);

module.exports = router;
