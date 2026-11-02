const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Pickup = require('../models/Pickup');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { buildDonationQuery } = require('../utils/query');
const { DONATION_STATUS, PICKUP_STATUS, isExpired, isDonationTransitionAllowed } = require('../utils/statusFlow');
const { transitionDonation } = require('../services/donationStatusService');
const { notify } = require('../services/notificationService');

const isMyDonation = (donation, ngo) =>
  String(donation.acceptedByNgoId || '') === String(ngo._id);

const loadDonationForNgo = async (id, ngo) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Donation not found');
  const donation = await Donation.findById(id);
  if (!donation) throw ApiError.notFound('Donation not found');
  return donation;
};

const deliveryAddressFor = (ngo) =>
  [ngo.organizationName, ngo.address, ngo.city].filter(Boolean).join(', ') || ngo.city;

/* ------------------------------------------------------------------ */
/* Browse                                                              */
/* ------------------------------------------------------------------ */

/** GET /api/ngo/donations  (NGO) - available donations with filters. */
const browseDonations = asyncHandler(async (req, res) => {
  const restrictToAvailable = !req.query.status || req.query.status === DONATION_STATUS.AVAILABLE;
  const { filter, sort, page, limit, skip } = buildDonationQuery(req.query, {
    restrictToAvailable,
    includeExpired: req.query.includeExpired === 'true',
  });

  const [items, total] = await Promise.all([
    Donation.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Donation.countDocuments(filter),
  ]);

  return ok(res, {
    donations: items.map((d) => ({ ...d, isExpired: isExpired(d) })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/* ------------------------------------------------------------------ */
/* Accept                                                              */
/* ------------------------------------------------------------------ */

/**
 * POST /api/ngo/donations/:id/accept  (NGO)
 * Concurrency-safe: the conditional update only succeeds while the donation
 * is still AVAILABLE, so two NGOs can never accept the same donation.
 */
const acceptDonation = asyncHandler(async (req, res) => {
  const donation = await loadDonationForNgo(req.params.id, req.user);

  if (isExpired(donation)) {
    throw ApiError.badRequest('This donation is past its safe-consumption deadline and can no longer be accepted');
  }

  let accepted;
  try {
    // Conditional update: only succeeds while the donation is still AVAILABLE,
    // which is what prevents two NGOs from accepting the same donation.
    accepted = await transitionDonation({
      donationId: donation._id,
      fromStatus: DONATION_STATUS.AVAILABLE,
      toStatus: DONATION_STATUS.ACCEPTED,
      user: req.user,
      note: `Accepted by ${req.user.organizationName || req.user.name}`,
      extraUpdate: { acceptedByNgoId: req.user._id },
    });
  } catch (err) {
    if (err.statusCode === 409) throw ApiError.conflict('This donation has already been accepted by another NGO');
    throw err;
  }

  await notify({
    recipientId: accepted.donorId,
    title: 'Donation accepted',
    message: `${req.user.organizationName || req.user.name} accepted your donation "${accepted.foodName}".`,
    type: 'SUCCESS',
    relatedDonationId: accepted._id,
  });

  return ok(res, { donation: accepted }, 'Donation accepted successfully');
});

/* ------------------------------------------------------------------ */
/* Accepted donations                                                  */
/* ------------------------------------------------------------------ */

/** GET /api/ngo/accepted-donations  (NGO) - donations this NGO accepted. */
const acceptedDonations = asyncHandler(async (req, res) => {
  const filter = { acceptedByNgoId: req.user._id };
  if (req.query.status && Object.values(DONATION_STATUS).includes(req.query.status)) {
    filter.status = req.query.status;
  } else if (!req.query.status) {
    // default: everything that is still in progress or finished (skip re-opened ones)
    filter.status = { $nin: [] };
  }
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ foodName: rx }, { city: rx }, { category: rx }];
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const [items, total] = await Promise.all([
    Donation.find(filter)
      .sort({ statusUpdatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('donorId', 'name city')
      .lean(),
    Donation.countDocuments(filter),
  ]);

  const pickupIds = items.map((d) => d._id);
  const pickups = await Pickup.find({ donationId: { $in: pickupIds }, isActive: true }).lean();
  const pickupByDonation = new Map(pickups.map((p) => [String(p.donationId), p]));

  const donations = items.map((d) => ({
    ...d,
    isExpired: isExpired(d),
    pickup: pickupByDonation.get(String(d._id)) || null,
  }));

  return ok(res, {
    donations,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/* ------------------------------------------------------------------ */
/* Volunteer coordination                                              */
/* ------------------------------------------------------------------ */

/**
 * POST /api/ngo/donations/:id/request-volunteer  (NGO)
 * Creates an OPEN pickup task (any volunteer may accept it) or assigns a
 * specific volunteer immediately.
 */
const requestVolunteer = asyncHandler(async (req, res) => {
  const donation = await loadDonationForNgo(req.params.id, req.user);

  if (!isMyDonation(donation, req.user)) {
    throw ApiError.forbidden('You can only request volunteers for donations your NGO accepted');
  }
  if (donation.status !== DONATION_STATUS.ACCEPTED) {
    throw ApiError.badRequest(
      `Volunteers can only be requested while the donation is ACCEPTED (current status: ${donation.status})`
    );
  }

  const existing = await Pickup.findOne({ donationId: donation._id, isActive: true });
  if (existing) throw ApiError.conflict('A pickup task already exists for this donation');

  const { volunteerId, scheduledPickupTime, notes } = req.body;
  let assignedVolunteer = null;

  if (volunteerId) {
    if (!mongoose.isValidObjectId(volunteerId)) throw ApiError.badRequest('Invalid volunteer id');
    assignedVolunteer = await User.findOne({ _id: volunteerId, role: 'VOLUNTEER', isActive: true });
    if (!assignedVolunteer) throw ApiError.badRequest('Volunteer not found or inactive');
  }

  const pickup = await Pickup.create({
    donationId: donation._id,
    ngoId: req.user._id,
    volunteerId: assignedVolunteer ? assignedVolunteer._id : null,
    pickupAddress: donation.pickupAddress,
    deliveryAddress: deliveryAddressFor(req.user),
    scheduledPickupTime: scheduledPickupTime ? new Date(scheduledPickupTime) : null,
    assignmentDate: new Date(),
    status: assignedVolunteer ? PICKUP_STATUS.ASSIGNED : PICKUP_STATUS.OPEN,
    notes: notes || '',
    isActive: true,
  });

  if (assignedVolunteer) {
    const updated = await transitionDonation({
      donationId: donation._id,
      fromStatus: DONATION_STATUS.ACCEPTED,
      toStatus: DONATION_STATUS.PICKUP_ASSIGNED,
      user: req.user,
      note: `Pickup assigned to ${assignedVolunteer.name}`,
      extraUpdate: { assignedVolunteerId: assignedVolunteer._id },
    });
    await notify({
      recipientId: assignedVolunteer._id,
      title: 'Pickup task assigned',
      message: `You have been assigned the pickup for "${donation.foodName}".`,
      type: 'PICKUP',
      relatedDonationId: donation._id,
    });
    return ok(res, { pickup, donation: updated }, 'Volunteer assigned successfully', 201);
  }

  return ok(res, { pickup, donation }, 'Volunteer requested - waiting for a volunteer to accept', 201);
});

/**
 * PATCH /api/ngo/donations/:id/release-volunteer  (NGO)
 * Withdraws the pickup task before collection (PICKUP_ASSIGNED -> ACCEPTED).
 */
const releaseVolunteer = asyncHandler(async (req, res) => {
  const donation = await loadDonationForNgo(req.params.id, req.user);
  if (!isMyDonation(donation, req.user)) throw ApiError.forbidden('Not your donation');
  if (donation.status !== DONATION_STATUS.PICKUP_ASSIGNED) {
    throw ApiError.badRequest('This donation has no assigned volunteer');
  }

  const pickup = await Pickup.findOne({ donationId: donation._id, isActive: true });
  const previousVolunteerId = pickup?.volunteerId;

  const updated = await transitionDonation({
    donationId: donation._id,
    fromStatus: DONATION_STATUS.PICKUP_ASSIGNED,
    toStatus: DONATION_STATUS.ACCEPTED,
    user: req.user,
    note: 'Volunteer assignment withdrawn by the NGO',
    extraUpdate: { assignedVolunteerId: null },
  });

  if (pickup) {
    pickup.isActive = false;
    pickup.status = PICKUP_STATUS.CANCELLED;
    await pickup.save();
  }
  if (previousVolunteerId) {
    await notify({
      recipientId: previousVolunteerId,
      title: 'Pickup assignment removed',
      message: `The pickup for "${donation.foodName}" was withdrawn by the NGO.`,
      type: 'WARNING',
      relatedDonationId: donation._id,
    });
  }

  return ok(res, { donation: updated }, 'Volunteer assignment withdrawn');
});

/* ------------------------------------------------------------------ */
/* Distribution confirmation                                           */
/* ------------------------------------------------------------------ */

/** PATCH /api/ngo/donations/:id/confirm-distribution  (NGO) -> COMPLETED */
const confirmDistribution = asyncHandler(async (req, res) => {
  const donation = await loadDonationForNgo(req.params.id, req.user);
  if (!isMyDonation(donation, req.user)) {
    throw ApiError.forbidden('You can only confirm distribution for your own accepted donations');
  }
  if (!isDonationTransitionAllowed(donation.status, DONATION_STATUS.COMPLETED)) {
    throw ApiError.badRequest(
      `Distribution can only be confirmed after delivery (current status: ${donation.status})`
    );
  }

  const pickup = await Pickup.findOne({ donationId: donation._id, isActive: true });
  if (pickup && pickup.status !== PICKUP_STATUS.DELIVERED) {
    throw ApiError.badRequest('The volunteer has not confirmed delivery yet');
  }

  const updated = await transitionDonation({
    donationId: donation._id,
    fromStatus: DONATION_STATUS.DISTRIBUTED,
    toStatus: DONATION_STATUS.COMPLETED,
    user: req.user,
    note: 'Distribution confirmed by the NGO',
  });

  if (pickup) {
    pickup.status = PICKUP_STATUS.CONFIRMED;
    pickup.confirmedAt = new Date();
    if (req.body?.distributionNote) {
      pickup.notes = `${pickup.notes}\nDistribution: ${req.body.distributionNote}`.trim().slice(0, 1000);
    }
    await pickup.save();
  }

  await notify({
    recipientId: updated.donorId,
    title: 'Donation completed',
    message: `Your donation "${updated.foodName}" was distributed. Thank you for reducing food waste!`,
    type: 'SUCCESS',
    relatedDonationId: updated._id,
  });
  if (pickup?.volunteerId) {
    await notify({
      recipientId: pickup.volunteerId,
      title: 'Delivery confirmed',
      message: `The delivery of "${updated.foodName}" was confirmed by the NGO.`,
      type: 'SUCCESS',
      relatedDonationId: updated._id,
    });
  }

  return ok(res, { donation: updated }, 'Distribution confirmed');
});

/* ------------------------------------------------------------------ */
/* NGO dashboard                                                       */
/* ------------------------------------------------------------------ */

/** GET /api/ngo/dashboard  (NGO) */
const dashboard = asyncHandler(async (req, res) => {
  const ngoId = req.user._id;
  const now = new Date();

  const [statusCounts, availableCount, recent] = await Promise.all([
    Donation.aggregate([
      { $match: { acceptedByNgoId: ngoId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Donation.countDocuments({ status: DONATION_STATUS.AVAILABLE, safeConsumptionDeadline: { $gte: now } }),
    Donation.find({ acceptedByNgoId: ngoId })
      .sort({ statusUpdatedAt: -1 })
      .limit(6)
      .select('foodName category quantity unit city status statusUpdatedAt safeConsumptionDeadline')
      .lean(),
  ]);

  const counts = { accepted: 0, inProgress: 0, completed: 0 };
  const byStatus = {};
  statusCounts.forEach((row) => {
    byStatus[row._id] = row.count;
    if ([DONATION_STATUS.ACCEPTED, DONATION_STATUS.PICKUP_ASSIGNED].includes(row._id)) counts.accepted += row.count;
    if (row._id === DONATION_STATUS.COLLECTED || row._id === DONATION_STATUS.DISTRIBUTED) counts.inProgress += row.count;
    if (row._id === DONATION_STATUS.COMPLETED) counts.completed += row.count;
  });

  const pendingPickups = await Pickup.countDocuments({
    ngoId,
    status: { $in: [PICKUP_STATUS.OPEN, PICKUP_STATUS.ASSIGNED, PICKUP_STATUS.COLLECTED] },
  });

  return ok(res, {
    stats: {
      availableDonations: availableCount,
      acceptedDonations: counts.accepted,
      pendingPickups,
      completedDistributions: counts.completed,
      inProgress: counts.inProgress,
      byStatus,
    },
    recentActivities: recent,
    ngo: {
      _id: req.user._id,
      name: req.user.name,
      organizationName: req.user.organizationName,
      verificationStatus: req.user.verificationStatus,
    },
  });
});

module.exports = {
  browseDonations,
  acceptDonation,
  acceptedDonations,
  requestVolunteer,
  releaseVolunteer,
  confirmDistribution,
  dashboard,
};
