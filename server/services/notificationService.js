const Notification = require('../models/Notification');

/**
 * Fire-and-forget notification helper.
 * Failures are logged but never break the main workflow.
 */
const notify = async ({ recipientId, title, message, type = 'INFO', relatedDonationId = null }) => {
  try {
    if (!recipientId) return null;
    return await Notification.create({ recipientId, title, message, type, relatedDonationId });
  } catch (err) {
    console.warn('[notification] could not create notification:', err.message);
    return null;
  }
};

const notifyMany = (recipientIds, payload) =>
  Promise.all(
    (recipientIds || [])
      .filter(Boolean)
      .map((id) => notify({ ...payload, recipientId: id }))
  );

module.exports = { notify, notifyMany };
