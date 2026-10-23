const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  dashboard,
  listUsers,
  updateUserStatus,
  verifyNgo,
  listDonations,
  reports,
} = require('../controllers/adminController');

// The whole router is restricted to ADMIN accounts.
router.use(protect, authorize('ADMIN'));

router.get('/dashboard', dashboard);
router.get('/users', listUsers);
router.get('/donations', listDonations);
router.get('/reports', reports);

router.patch(
  '/users/:id/status',
  [body('isActive').isBoolean().withMessage('isActive must be a boolean')],
  validate,
  updateUserStatus
);

router.patch(
  '/ngos/:id/verify',
  [
    body('verificationStatus').isIn(['VERIFIED', 'REJECTED']).withMessage('verificationStatus must be VERIFIED or REJECTED'),
    body('note').optional({ nullable: true }).trim().isLength({ max: 500 }),
  ],
  validate,
  verifyNgo
);

module.exports = router;
