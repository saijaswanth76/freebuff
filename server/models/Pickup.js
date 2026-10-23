const mongoose = require('mongoose');
const { PICKUP_STATUS } = require('../utils/statusFlow');

const pickupSchema = new mongoose.Schema(
  {
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      // indexed via the unique partial index on { donationId, isActive } below
    },
    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // null while the task is OPEN (waiting for any volunteer to accept it).
    volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    pickupAddress: { type: String, required: true, trim: true, maxlength: 300 },
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 300 },

    scheduledPickupTime: { type: Date, default: null },
    assignmentDate: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: Object.values(PICKUP_STATUS),
      default: PICKUP_STATUS.OPEN,
      index: true,
    },

    collectedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },

    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    deliveryNotes: { type: String, trim: true, maxlength: 1000, default: '' },
    // Guarantees one active pickup task per donation.
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// At most one active task per donation (enforced at the DB level too).
pickupSchema.index(
  { donationId: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('Pickup', pickupSchema);
