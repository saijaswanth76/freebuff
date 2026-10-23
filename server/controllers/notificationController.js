const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');

/** GET /api/notifications - the logged-in user's own notifications. */
const listNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));

  const filter = { recipientId: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;

  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientId: req.user._id, isRead: false }),
  ]);

  return ok(res, {
    notifications: items,
    unreadCount: unread,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/** PATCH /api/notifications/:id/read */
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: req.user._id },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!notification) throw ApiError.notFound('Notification not found');
  return ok(res, { notification }, 'Notification marked as read');
});

/** PATCH /api/notifications/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipientId: req.user._id, isRead: false }, { $set: { isRead: true } });
  return ok(res, null, 'All notifications marked as read');
});

module.exports = { listNotifications, markRead, markAllRead };
