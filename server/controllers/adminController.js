const mongoose = require('mongoose');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Pickup = require('../models/Pickup');
const DonationHistory = require('../models/DonationHistory');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { buildDonationQuery, escapeRegex } = require('../utils/query');
const { DONATION_STATUS, PICKUP_STATUS } = require('../utils/statusFlow');
const { notify } = require('../services/notificationService');

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Builds a continuous list of the last `count` YYYY-MM keys ending at now. */
const lastMonthKeys = (count) => {
  const keys = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
};

const fillMonths = (rows, keys, valueField = 'count') => {
  const map = new Map(rows.map((r) => [r._id, r[valueField]]));
  return keys.map((k) => ({ month: k, value: Number(map.get(k) || 0) }));
};

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

/** GET /api/admin/dashboard */
const dashboard = asyncHandler(async (req, res) => {
  const [
    usersByRole,
    totalUsers,
    donationsByStatus,
    totalDonations,
    totalPickups,
    openPickups,
    recentDonations,
    recentUsers,
    byCategory,
    donationsByMonthRaw,
    usersByMonthRaw,
  ] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments(),
    Donation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Donation.countDocuments(),
    Pickup.countDocuments(),
    Pickup.countDocuments({ status: { $in: [PICKUP_STATUS.OPEN, PICKUP_STATUS.ASSIGNED, PICKUP_STATUS.COLLECTED] } }),
    Donation.find().sort({ createdAt: -1 }).limit(8).populate('donorId', 'name role city').lean(),
    User.find().sort({ createdAt: -1 }).limit(6).select('name email role city verificationStatus isActive createdAt').lean(),
    Donation.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Donation.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
  ]);

  const roles = { donors: 0, ngos: 0, volunteers: 0, admins: 0 };
  usersByRole.forEach((row) => {
    if (row._id === 'DONOR') roles.donors = row.count;
    if (row._id === 'NGO') roles.ngos = row.count;
    if (row._id === 'VOLUNTEER') roles.volunteers = row.count;
    if (row._id === 'ADMIN') roles.admins = row.count;
  });

  const status = {
    pending: 0,
    accepted: 0,
    completed: 0,
    cancelled: 0,
    byStatus: {},
  };
  donationsByStatus.forEach((row) => {
    status.byStatus[row._id] = row.count;
    if ([DONATION_STATUS.AVAILABLE, DONATION_STATUS.ACCEPTED, DONATION_STATUS.PICKUP_ASSIGNED].includes(row._id)) {
      status.pending += row.count;
    }
    if (row._id === DONATION_STATUS.COMPLETED) status.completed = row.count;
    if ([DONATION_STATUS.CANCELLED, DONATION_STATUS.REJECTED].includes(row._id)) status.cancelled += row.count;
  });

  const monthKeys = lastMonthKeys(6);
  const pendingNgoCount = await User.countDocuments({ role: 'NGO', verificationStatus: 'PENDING' });

  return ok(res, {
    stats: {
      totalUsers,
      ...roles,
      totalDonations,
      pendingDonations: status.pending,
      completedDonations: status.completed,
      cancelledDonations: status.cancelled,
      inProgressDonations: status.byStatus[DONATION_STATUS.COLLECTED] || 0,
      totalPickups,
      activePickups: openPickups,
      pendingNgoVerifications: pendingNgoCount,
      byStatus: status.byStatus,
    },
    charts: {
      donationsByStatus: donationsByStatus.map((r) => ({ status: r._id, count: r.count })),
      donationsByCategory: byCategory.map((r) => ({ category: r._id, count: r.count })),
      donationsByMonth: fillMonths(donationsByMonthRaw, monthKeys),
      usersByMonth: fillMonths(usersByMonthRaw, monthKeys),
    },
    recentDonations,
    recentUsers,
  });
});

/* ------------------------------------------------------------------ */
/* User management                                                     */
/* ------------------------------------------------------------------ */

/** GET /api/admin/users */
const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role && ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.isActive === 'true' || req.query.isActive === 'false') filter.isActive = req.query.isActive === 'true';
  if (req.query.verificationStatus) filter.verificationStatus = req.query.verificationStatus;
  if (req.query.city) filter.city = new RegExp(escapeRegex(req.query.city), 'i');
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { organizationName: rx }, { city: rx }];
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);

  return ok(res, {
    users: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/** PATCH /api/admin/users/:id/status - activate / deactivate an account. */
const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') throw ApiError.badRequest('isActive must be a boolean');
  if (String(req.params.id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot deactivate your own administrator account');
  }
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('User not found');

  const user = await User.findByIdAndUpdate(req.params.id, { $set: { isActive } }, { new: true });
  if (!user) throw ApiError.notFound('User not found');

  await notify({
    recipientId: user._id,
    title: isActive ? 'Account activated' : 'Account deactivated',
    message: isActive
      ? 'Your account has been activated by the administrator.'
      : 'Your account has been deactivated by the administrator. Contact support for details.',
    type: 'ACCOUNT',
  });

  return ok(res, { user }, isActive ? 'User activated' : 'User deactivated');
});

/** PATCH /api/admin/ngos/:id/verify - verify or reject an NGO registration. */
const verifyNgo = asyncHandler(async (req, res) => {
  const { verificationStatus, note } = req.body;
  if (!['VERIFIED', 'REJECTED'].includes(verificationStatus)) {
    throw ApiError.badRequest('verificationStatus must be VERIFIED or REJECTED');
  }
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('NGO not found');

  const ngo = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'NGO' },
    {
      $set: {
        verificationStatus,
        verificationNote: note ? String(note).slice(0, 500) : '',
      },
    },
    { new: true }
  );
  if (!ngo) throw ApiError.notFound('NGO not found');

  await notify({
    recipientId: ngo._id,
    title: verificationStatus === 'VERIFIED' ? 'NGO verified' : 'NGO registration rejected',
    message:
      verificationStatus === 'VERIFIED'
        ? 'Your organization has been verified by the administrator.'
        : `Your NGO registration was rejected. ${note || 'Contact the administrator for details.'}`,
    type: 'ACCOUNT',
  });

  return ok(res, { user: ngo }, verificationStatus === 'VERIFIED' ? 'NGO verified' : 'NGO rejected');
});

/* ------------------------------------------------------------------ */
/* Donations                                                           */
/* ------------------------------------------------------------------ */

/** GET /api/admin/donations - full list with filters. */
const listDonations = asyncHandler(async (req, res) => {
  const { filter, sort, page, limit, skip } = buildDonationQuery(req.query, { includeExpired: true });

  const [items, total, statusCounts] = await Promise.all([
    Donation.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('donorId', 'name role city organizationName')
      .populate('acceptedByNgoId', 'name organizationName city')
      .populate('assignedVolunteerId', 'name city')
      .lean(),
    Donation.countDocuments(filter),
    Donation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return ok(res, {
    donations: items,
    statusCounts: statusCounts.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {}),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

/** GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD */
const reports = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  if (from && Number.isNaN(from.getTime())) throw ApiError.badRequest('Invalid "from" date');
  if (to && Number.isNaN(to.getTime())) throw ApiError.badRequest('Invalid "to" date');

  const range = {};
  if (from) range.$gte = from;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  const donationMatch = Object.keys(range).length ? { createdAt: range } : {};
  const userMatch = Object.keys(range).length ? { createdAt: range } : {};

  const [totals, byStatus, byCategory, donationsByMonthRaw, usersByMonthRaw, totalUsers, totalDonations] =
    await Promise.all([
      Donation.aggregate([
        { $match: donationMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', DONATION_STATUS.COMPLETED] }, 1, 0] } },
            available: { $sum: { $cond: [{ $eq: ['$status', DONATION_STATUS.AVAILABLE] }, 1, 0] } },
            inProgress: {
              $sum: {
                $cond: [
                  { $in: ['$status', [DONATION_STATUS.ACCEPTED, DONATION_STATUS.PICKUP_ASSIGNED, DONATION_STATUS.COLLECTED, DONATION_STATUS.DISTRIBUTED]] },
                  1,
                  0,
                ],
              },
            },
            cancelled: {
              $sum: { $cond: [{ $in: ['$status', [DONATION_STATUS.CANCELLED, DONATION_STATUS.REJECTED]] }, 1, 0] } },
            totalQuantity: { $sum: '$quantity' },
          },
        },
      ]),
      Donation.aggregate([{ $match: donationMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Donation.aggregate([
        { $match: donationMatch },
        { $group: { _id: '$category', count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', DONATION_STATUS.COMPLETED] }, 1, 0] } } } },
        { $sort: { count: -1 } },
      ]),
      Donation.aggregate([
        { $match: donationMatch },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: userMatch },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      User.countDocuments(userMatch),
      Donation.countDocuments(donationMatch),
    ]);

  const t = totals[0] || { total: 0, completed: 0, available: 0, inProgress: 0, cancelled: 0, totalQuantity: 0 };
  const monthKeys = lastMonthKeys(6);

  return ok(res, {
    filters: { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null },
    summary: {
      totalDonations: t.total,
      completedDonations: t.completed,
      pendingDonations: t.available + t.inProgress,
      cancelledDonations: t.cancelled,
      availableDonations: t.available,
      inProgressDonations: t.inProgress,
      totalQuantityListed: t.totalQuantity,
      totalUsers,
      completionRate: t.total ? Math.round((t.completed / t.total) * 100) : 0,
    },
    donationsByStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
    donationsByCategory: byCategory.map((r) => ({ category: r._id, count: r.count, completed: r.completed })),
    donationsByMonth: fillMonths(donationsByMonthRaw, monthKeys),
    usersByMonth: fillMonths(usersByMonthRaw, monthKeys),
    totalDonationsInRange: totalDonations,
  });
});

module.exports = { dashboard, listUsers, updateUserStatus, verifyNgo, listDonations, reports };
