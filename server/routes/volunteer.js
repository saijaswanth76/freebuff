const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  listTasks,
  listMyTasks,
  getTask,
  acceptTask,
  collectTask,
  deliverTask,
  dashboard,
} = require('../controllers/volunteerController');

router.use(protect, authorize('VOLUNTEER'));

router.get('/dashboard', dashboard);
router.get('/tasks', listTasks);
router.get('/tasks/my', listMyTasks);
router.get('/tasks/:id', getTask);

router.post('/tasks/:id/accept', acceptTask);

router.patch(
  '/tasks/:id/collect',
  [body('notes').optional({ nullable: true }).trim().isLength({ max: 1000 })],
  validate,
  collectTask
);

router.patch(
  '/tasks/:id/deliver',
  [body('deliveryNotes').optional({ nullable: true }).trim().isLength({ max: 1000 })],
  validate,
  deliverTask
);

module.exports = router;
