const DonationHistory = require('../models/DonationHistory');
const Donation = require('../models/Donation');
const { isDonationTransitionAllowed } = require('../utils/statusFlow');
const ApiError = require('../utils/ApiError');

/**
 * Records an immutable audit entry and moves a donation to a new status.
 * The transition is validated against the state machine in utils/statusFlow.js
 * and applied with a conditional update so concurrent requests cannot
 * apply two conflicting transitions at once.
 */
const transitionDonation = async ({
  donationId,
  toStatus,
  fromStatus,
  user,
  note = '',
  extraUpdate = {},
}) => {
  if (fromStatus && !isDonationTransitionAllowed(fromStatus, toStatus)) {
    throw ApiError.badRequest(
      `Invalid status change: ${fromStatus} -> ${toStatus} is not allowed`
    );
  }

  const update = {
    status: toStatus,
    statusUpdatedAt: new Date(),
    statusUpdatedBy: user ? user._id : null,
    ...extraUpdate,
  };

  // Conditional update -> only succeeds if the donation is still in `fromStatus`.
  const donation = await Donation.findOneAndUpdate(
    { _id: donationId, ...(fromStatus ? { status: fromStatus } : {}) },
    { $set: update },
    { new: true }
  );

  if (!donation) {
    throw ApiError.conflict('The donation status changed. Please refresh and try again.');
  }

  await DonationHistory.create({
    donationId,
    previousStatus: fromStatus || null,
    newStatus: toStatus,
    updatedBy: user ? user._id : null,
    updatedByRole: user ? user.role : '',
    note,
    timestamp: new Date(),
  });

  return donation;
};

/** Reads the audit trail (authorization is enforced by the calling route). */
const getHistory = async (donationId) =>
  DonationHistory.find({ donationId }).sort({ timestamp: -1 }).lean();

module.exports = { transitionDonation, getHistory };
