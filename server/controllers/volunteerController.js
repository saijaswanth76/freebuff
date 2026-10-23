const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Pickup = require('../models/Pickup');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { DONATION_STATUS, PICKUP_STATUS, isExpired } = require('../utils/statusFlow');
const { transitionDonation } = require('../services/donationStatusService');
const { notify } = require('../services/notificationService');

const loadPickup = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Pickup task not found');
  const pickup = await Pickup.findById(id);
  if (!pickup) throw ApiError.notFound('Pickup task not found');
  return pickup;
};

/** Volunteers only ever see open tasks or their own assignments. */
const canViewPickup = (pickup, user) =>
  user.role === 'ADMIN' || !pickup.volunteerId || String(pickup.volunteerId) === String(user._id);

const isAssignedToMe = (pickup, user) => String(pickup.volunteerId || '') === String(user._id);

const pickupWithDonation = async (pickup) => {
  const donation = await Donation.findById(pickup.donationId)
    .select('foodName category quantity unit city status safeConsumptionDeadline storageInformation foodClassification imageUrl description')
    .lean();
  return { ...pickup.toObject ? pickup.toObject() : pickup, donation };
};

/* ------------------------------------------------------------------ */
/* Task lists                                                          */
/* ------------------------------------------------------------------ */

/** GET /api/volunteer/tasks - OPEN tasks plus the ones assigned to me. */
const listTasks = asyncHandler(async (req, res) => {
  const filter = {
    $or: [{ status: PICKUP_STATUS.OPEN, volunteerId: null }, { volunteerId: req.user._id }],
  };
  if (req.query.status && Object.values(PICKUP_STATUS).includes(req.query.status)) {
    filter.$or = [{ status: req.query.status, volunteerId: req.user._id }];
    if (req.query.status === PICKUP_STATUS.OPEN) filter.$or.push({ status: PICKUP_STATUS.OPEN, volunteerId: null });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const [items, total, openCount] = await Promise.all([
    Pickup.find(filter).sort({ assignmentDate: -1 }).skip((page - 1) * limit).limit(limit),
    Pickup.countDocuments(filter),
    Pickup.countDocuments({ status: PICKUP_STATUS.OPEN, volunteerId: null }),
  ]);

  const withDonations = await Promise.all(items.map(pickupWithDonation));
  const donations = withDonations.map((p) => p.donation);
  const data = withDonations.map((p, i) => ({
    ...p,
    donation: donations[i],
    donationExpired: isExpired(donations[i]),
  }));

  return ok(res, {
    tasks: data,
    openCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/** GET /api/volunteer/tasks/my - only my assignments. */
const listMyTasks = asyncHandler(async (req, res) => {
  const filter = { volunteerId: req.user._id };
  if (req.query.status && Object.values(PICKUP_STATUS).includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const [items, total] = await Promise.all([
    Pickup.find(filter).sort({ assignmentDate: -1 }).skip((page - 1) * limit).limit(limit),
    Pickup.countDocuments(filter),
  ]);

  const data = await Promise.all(items.map(pickupWithDonation));
  return ok(res, {
    tasks: data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/** GET /api/volunteer/tasks/:id */
const getTask = asyncHandler(async (req, res) => {
  const pickup = await loadPickup(req.params.id);
  if (!canViewPickup(pickup, req.user)) throw ApiError.forbidden('This task is assigned to another volunteer');
  return ok(res, { task: await pickupWithDonation(pickup) });
});

/* ------------------------------------------------------------------ */
/* Status updates                                                      */
/* ------------------------------------------------------------------ */

/** POST /api/volunteer/tasks/:id/accept - claim an OPEN task. */
const acceptTask = asyncHandler(async (req, res) => {
  const pickup = await loadPickup(req.params.id);

  if (pickup.volunteerId && !isAssignedToMe(pickup, req.user)) {
    throw ApiError.conflict('This task has already been assigned to another volunteer');
  }

  // Concurrency-safe: only one volunteer can move OPEN -> ASSIGNED.
  const claimed = await Pickup.findOneAndUpdate(
    { _id: pickup._id, status: PICKUP_STATUS.OPEN, volunteerId: null },
    { $set: { status: PICKUP_STATUS.ASSIGNED, volunteerId: req.user._id, assignmentDate: new Date() } },
    { new: true }
  );
  if (!claimed) throw ApiError.conflict('This task is no longer available');

  let donation;
  try {
    donation = await transitionDonation({
      donationId: claimed.donationId,
      fromStatus: DONATION_STATUS.ACCEPTED,
      toStatus: DONATION_STATUS.PICKUP_ASSIGNED,
      user: req.user,
      note: `Pickup task accepted by volunteer ${req.user.name}`,
      extraUpdate: { assignedVolunteerId: req.user._id },
    });
  } catch (err) {
    // Roll back the claim if the donation moved on (cancelled / reassigned).
    await Pickup.updateOne({ _id: claimed._id, status: PICKUP_STATUS.ASSIGNED }, { $set: { status: PICKUP_STATUS.OPEN, volunteerId: null } });
    if (err.statusCode === 409) throw ApiError.conflict('This donation is no longer awaiting pickup');
    throw err;
  }

  await notify({
    recipientId: claimed.ngoId,
    title: 'Volunteer accepted the pickup',
    message: `${req.user.name} accepted the pickup task for "${donation.foodName}".`,
    type: 'PICKUP',
    relatedDonationId: donation._id,
  });

  return ok(res, { task: await pickupWithDonation(claimed), donation }, 'Task accepted');
});

/** PATCH /api/volunteer/tasks/:id/confirm-collection -> COLLECTED */
const collectTask = asyncHandler(async (req, res) => {
  const pickup = await loadPickup(req.params.id);
  if (!isAssignedToMe(pickup, req.user)) throw ApiError.forbidden('This task is not assigned to you');
  if (pickup.status !== PICKUP_STATUS.ASSIGNED) {
    throw ApiError.badRequest(`Collection cannot be confirmed while the task is ${pickup.status}`);
  }

  const updatedPickup = await Pickup.findOneAndUpdate(
    { _id: pickup._id, status: PICKUP_STATUS.ASSIGNED },
    {
      $set: {
        status: PICKUP_STATUS.COLLECTED,
        collectedAt: new Date(),
        ...(req.body?.notes ? { notes: String(req.body.notes).slice(0, 1000) } : {}),
      },
    },
    { new: true }
  );
  if (!updatedPickup) throw ApiError.conflict('The task status changed. Please refresh.');

  const donation = await transitionDonation({
    donationId: pickup.donationId,
    fromStatus: DONATION_STATUS.PICKUP_ASSIGNED,
    toStatus: DONATION_STATUS.COLLECTED,
    user: req.user,
    note: 'Food collected by the volunteer',
  });

  await notify({
    recipientId: donation.acceptedByNgoId,
    title: 'Food collected',
    message: `${req.user.name} collected "${donation.foodName}" and is on the way.`,
    type: 'PICKUP',
    relatedDonationId: donation._id,
  });
  await notify({
    recipientId: donation.donorId,
    title: 'Food collected',
    message: `Your donation "${donation.foodName}" has been collected by a volunteer.`,
    type: 'SUCCESS',
    relatedDonationId: donation._id,
  });

  return ok(res, { task: await pickupWithDonation(updatedPickup), donation }, 'Collection confirmed');
});

/** PATCH /api/volunteer/tasks/:id/confirm-delivery -> DELIVERED / DISTRIBUTED */
const deliverTask = asyncHandler(async (req, res) => {
  const pickup = await loadPickup(req.params.id);
  if (!isAssignedToMe(pickup, req.user)) throw ApiError.forbidden('This task is not assigned to you');
  if (pickup.status !== PICKUP_STATUS.COLLECTED) {
    throw ApiError.badRequest(`Delivery cannot be confirmed while the task is ${pickup.status}`);
  }

  const updatedPickup = await Pickup.findOneAndUpdate(
    { _id: pickup._id, status: PICKUP_STATUS.COLLECTED },
    {
      $set: {
        status: PICKUP_STATUS.DELIVERED,
        deliveredAt: new Date(),
        ...(req.body?.deliveryNotes ? { deliveryNotes: String(req.body.deliveryNotes).slice(0, 1000) } : {}),
      },
    },
    { new: true }
  );
  if (!updatedPickup) throw ApiError.conflict('The task status changed. Please refresh.');

  const donation = await transitionDonation({
    donationId: pickup.donationId,
    fromStatus: DONATION_STATUS.COLLECTED,
    toStatus: DONATION_STATUS.DISTRIBUTED,
    user: req.user,
    note: 'Food delivered to the NGO / distribution point',
  });

  await notify({
    recipientId: donation.acceptedByNgoId,
    title: 'Food delivered',
    message: `"${donation.foodName}" was delivered. Please confirm the distribution.`,
    type: 'PICKUP',
    relatedDonationId: donation._id,
  });

  return ok(res, { task: await pickupWithDonation(updatedPickup), donation }, 'Delivery confirmed');
});

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

/** GET /api/volunteer/dashboard */
const dashboard = asyncHandler(async (req, res) => {
  const volunteerId = req.user._id;

  const [openTasks, assigned, pendingPickups, delivered, confirmed, recent] = await Promise.all([
    Pickup.countDocuments({ status: PICKUP_STATUS.OPEN, volunteerId: null }),
    Pickup.countDocuments({ volunteerId, status: { $in: [PICKUP_STATUS.ASSIGNED, PICKUP_STATUS.COLLECTED] } }),
    Pickup.countDocuments({ volunteerId, status: PICKUP_STATUS.ASSIGNED }),
    Pickup.countDocuments({ volunteerId, status: PICKUP_STATUS.DELIVERED }),
    Pickup.countDocuments({ volunteerId, status: PICKUP_STATUS.CONFIRMED }),
    Pickup.find({ volunteerId }).sort({ updatedAt: -1 }).limit(5).populate('donationId', 'foodName category quantity unit status').lean(),
  ]);

  return ok(res, {
    stats: {
      availablePickupTasks: openTasks,
      assignedTasks: assigned,
      pendingPickups,
      completedDeliveries: delivered + confirmed,
      delivered,
      confirmed,
    },
    recentTasks: recent.map((t) => ({ ...t, donation: t.donationId, donationId: t.donationId?._id })),
  });
});

module.exports = { listTasks, listMyTasks, getTask, acceptTask, collectTask, deliverTask, dashboard };
