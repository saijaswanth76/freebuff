const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const {
  listDonations,
  getDonation,
  getDonationHistory,
  createDonation,
  listMyDonations,
  updateDonation,
  cancelDonation,
} = require('../controllers/donationController');
const { FOOD_CATEGORIES, UNITS, CLASSIFICATIONS } = require('../models/Donation');

const donationRules = [
  body('foodName').trim().notEmpty().withMessage('Food name is required').isLength({ max: 120 }),
  body('category').isIn(FOOD_CATEGORIES).withMessage('Please choose a valid food category'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('quantity').isFloat({ gt: 0, max: 100000 }).withMessage('Quantity must be a number greater than 0'),
  body('unit').isIn(UNITS).withMessage('Please choose a valid unit'),
  body('foodClassification').optional({ nullable: true }).isIn(CLASSIFICATIONS),
  body('safeConsumptionDeadline').isISO8601().withMessage('A valid safe-consumption deadline is required'),
  body('pickupAddress').trim().notEmpty().withMessage('Pickup address is required').isLength({ max: 300 }),
  body('city').trim().notEmpty().withMessage('City is required').isLength({ max: 80 }),
  body('contactName').trim().notEmpty().withMessage('Contact name is required'),
  body('contactPhone')
    .matches(/^[0-9+\-\s()]{7,15}$/)
    .withMessage('Please provide a valid contact phone number'),
  body('locationDescription').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('storageInformation').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('additionalNotes').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

// Order matters: /my and /history must be registered before /:id.
router.get('/', optionalAuth, listDonations);
router.get('/my', protect, authorize('DONOR'), listMyDonations);
router.get('/:id/history', protect, getDonationHistory);
router.get('/:id', optionalAuth, getDonation);

router.post('/', protect, authorize('DONOR'), upload.single('image'), donationRules, validate, createDonation);
router.put('/:id', protect, authorize('DONOR'), upload.single('image'), updateDonation);
router.patch('/:id/cancel', protect, authorize('DONOR'), cancelDonation);

module.exports = router;
