const router = require('express').Router();
const { publicStats } = require('../controllers/statsController');
const { protect } = require('../middleware/auth');
const { listNotifications, markRead, markAllRead } = require('../controllers/notificationController');
const { FOOD_CATEGORIES, UNITS, CLASSIFICATIONS } = require('../models/Donation');
const { DONOR_CATEGORIES } = require('../models/User');
const { DONATION_STATUS, PICKUP_STATUS } = require('../utils/statusFlow');

router.use('/auth', require('./auth'));
router.use('/donations', require('./donations'));
router.use('/ngo', require('./ngo'));
router.use('/volunteer', require('./volunteer'));
router.use('/admin', require('./admin'));

/** GET /api/stats/public - landing page statistics (all counted from the DB). */
router.get('/stats/public', publicStats);

/** GET /api/meta - reference data shared by the frontend forms and filters. */
router.get('/meta', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    data: {
      foodCategories: FOOD_CATEGORIES,
      units: UNITS,
      classifications: CLASSIFICATIONS,
      donorCategories: DONOR_CATEGORIES,
      donationStatuses: Object.values(DONATION_STATUS),
      pickupStatuses: Object.values(PICKUP_STATUS),
      registerRoles: ['DONOR', 'NGO', 'VOLUNTEER'],
    },
  });
});

/** GET /api/health - simple uptime probe used by the README smoke test. */
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running', data: { uptime: process.uptime() } });
});

router.get('/notifications', protect, listNotifications);
router.patch('/notifications/read-all', protect, markAllRead);
router.patch('/notifications/:id/read', protect, markRead);

module.exports = router;
