const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    type: {
      type: String,
      enum: ['INFO', 'SUCCESS', 'WARNING', 'DONATION', 'PICKUP', 'ACCOUNT'],
      default: 'INFO',
    },
    relatedDonationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', default: null },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
