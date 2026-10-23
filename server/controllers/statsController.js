const User = require('../models/User');
const Donation = require('../models/Donation');
const Pickup = require('../models/Pickup');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { DONATION_STATUS } = require('../utils/statusFlow');

/**
 * GET /api/stats/public
 * Every number is counted from the database - no fabricated impact figures.
 * Used by the landing page statistics cards.
 */
const publicStats = asyncHandler(async (req, res) => {
  const now = new Date();

  // "Active" volunteers = volunteers that already accepted at least one task.
  const volunteerIdsWithTasks = await Pickup.distinct('volunteerId', { volunteerId: { $ne: null } });

  const [
    totalDonations,
    completedDonations,
    ngoCount,
    volunteerCount,
    donorCount,
    availableNow,
    activeVolunteers,
    totalPickups,
    distributedQuantity,
  ] = await Promise.all([
    Donation.countDocuments(),
    Donation.countDocuments({ status: DONATION_STATUS.COMPLETED }),
    User.countDocuments({ role: 'NGO', isActive: true }),
    User.countDocuments({ role: 'VOLUNTEER', isActive: true }),
    User.countDocuments({ role: 'DONOR', isActive: true }),
    Donation.countDocuments({ status: DONATION_STATUS.AVAILABLE, safeConsumptionDeadline: { $gte: now } }),
    User.countDocuments({ role: 'VOLUNTEER', isActive: true, _id: { $in: volunteerIdsWithTasks } }),
    Pickup.countDocuments(),
    Donation.aggregate([
      { $match: { status: DONATION_STATUS.COMPLETED } },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]),
  ]);

  return ok(res, {
    stats: {
      totalDonations,
      completedDonations,
      registeredNgos: ngoCount,
      activeVolunteers,
      totalVolunteers: volunteerCount,
      totalDonors: donorCount,
      availableDonations: availableNow,
      totalPickups,
      quantityDistributed: distributedQuantity[0] ? distributedQuantity[0].total : 0,
    },
  });
});

module.exports = { publicStats };
