const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize, requireActiveNgo } = require('../middleware/auth');
const {
  browseDonations,
  acceptDonation,
  acceptedDonations,
  requestVolunteer,
  releaseVolunteer,
  confirmDistribution,
  dashboard,
} = require('../controllers/ngoController');

router.use(protect, authorize('NGO'));

router.get('/dashboard', dashboard);
router.get('/donations', browseDonations);
router.get('/accepted-donations', acceptedDonations);

router.post(
  '/donations/:id/accept',
  requireActiveNgo,
  acceptDonation
);

router.post(
  '/donations/:id/request-volunteer',
  requireActiveNgo,
  [
    body('volunteerId').optional({ nullable: true }).isMongoId().withMessage('Invalid volunteer id'),
    body('scheduledPickupTime').optional({ nullable: true }).isISO8601().withMessage('Invalid pickup time'),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  ],
  validate,
  requestVolunteer
);

router.patch('/donations/:id/release-volunteer', requireActiveNgo, releaseVolunteer);

router.patch(
  '/donations/:id/confirm-distribution',
  requireActiveNgo,
  [body('distributionNote').optional({ nullable: true }).trim().isLength({ max: 500 })],
  validate,
  confirmDistribution
);

module.exports = router;
