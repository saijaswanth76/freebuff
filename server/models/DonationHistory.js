const mongoose = require('mongoose');

/** Immutable audit trail of every donation status change. */
const donationHistorySchema = new mongoose.Schema(
  {
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      index: true,
    },
    previousStatus: { type: String, default: null },
    newStatus: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByRole: { type: String, default: '' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

donationHistorySchema.index({ donationId: 1, timestamp: -1 });

module.exports = mongoose.model('DonationHistory', donationHistorySchema);
