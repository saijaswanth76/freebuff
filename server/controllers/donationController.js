const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Pickup = require('../models/Pickup');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { buildDonationQuery } = require('../utils/query');
const { DONATION_STATUS, isExpired, isDonationTransitionAllowed } = require('../utils/statusFlow');
const DonationHistory = require('../models/DonationHistory');
const { transitionDonation, getHistory } = require('../services/donationStatusService');
const { notify } = require('../services/notificationService');

/* ------------------------------------------------------------------ */
/* Field visibility helpers                                            */
/* ------------------------------------------------------------------ */

/** Fields that anonymous / unauthorized visitors may see. */
const PUBLIC_FIELDS = [
  '_id',
  'foodName',
  'category',
  'description',
  'quantity',
  'unit',
  'foodClassification',
  'availableFrom',
  'safeConsumptionDeadline',
  'city',
  'locationDescription',
  'storageInformation',
  'imageUrl',
  'status',
  'createdAt',
  'isExpired',
];

const toPublicDonation = (donation) => {
  const plain = typeof donation.toObject === 'function' ? donation.toObject() : { ...donation };
  const out = {};
  PUBLIC_FIELDS.forEach((f) => {
    if (plain[f] !== undefined) out[f] = plain[f];
  });
  out.isExpired = isExpired(plain);
  return out;
};

/** True when the requester may see the full record (address, contacts, ids). */
const canSeeFullDonation = (donation, user) => {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (String(donation.donorId?._id || donation.donorId) === String(user._id)) return true;
  if (String(donation.acceptedByNgoId?._id || donation.acceptedByNgoId || '') === String(user._id)) return true;
  if (String(donation.assignedVolunteerId?._id || donation.assignedVolunteerId || '') === String(user._id)) return true;
  return false;
};

const isOwner = (donation, user) => user && String(donation.donorId?._id || donation.donorId) === String(user._id);

const parseDate = (value, fieldLabel) => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest(`Invalid date for ${fieldLabel}`);
  return d;
};

/** Loads a donation and returns it, or throws 404. */
const loadDonation = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Donation not found');
  const donation = await Donation.findById(id).populate('donorId', 'name role city organizationName');
  if (!donation) throw ApiError.notFound('Donation not found');
  return donation;
};

/* ------------------------------------------------------------------ */
/* Public routes                                                       */
/* ------------------------------------------------------------------ */

/**
 * GET /api/donations
 * Public browse list. Defaults to AVAILABLE, non-expired donations and never
 * exposes donor identity, phone numbers or the exact pickup address.
 */
const listDonations = asyncHandler(async (req, res) => {
  const anonymous = !req.user;
  const requestedStatus = typeof req.query.status === 'string' ? req.query.status : '';
  const { filter, sort, page, limit, skip } = buildDonationQuery(req.query, {
    restrictToAvailable: anonymous && !requestedStatus,
    includeExpired: req.user?.role === 'ADMIN' && req.query.includeExpired === 'true',
  });

  // Anonymous visitors may only request the AVAILABLE status explicitly.
  if (anonymous && requestedStatus && requestedStatus !== DONATION_STATUS.AVAILABLE) {
    throw ApiError.forbidden('Log in to filter donations by this status');
  }

  const [items, total] = await Promise.all([
    Donation.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Donation.countDocuments(filter),
  ]);

  const data = items.map((d) =>
    canSeeFullDonation(d, req.user) ? { ...d, isExpired: isExpired(d) } : toPublicDonation(d)
  );

  return ok(res, {
    donations: data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/**
 * GET /api/donations/:id
 * Full details for the donor, the accepted NGO, the assigned volunteer and
 * admins. Everyone else receives the public projection only.
 */
const getDonation = asyncHandler(async (req, res) => {
  const donation = await loadDonation(req.params.id);
  const full = canSeeFullDonation(donation, req.user);
  const payload = full
    ? { ...donation.toObject(), isExpired: isExpired(donation) }
    : toPublicDonation(donation);
  return ok(res, { donation: payload, hasFullAccess: full });
});

/**
 * GET /api/donations/:id/history
 * Audit trail - restricted to the donor, the NGO that accepted it, the
 * assigned volunteer and administrators.
 */
const getDonationHistory = asyncHandler(async (req, res) => {
  const donation = await loadDonation(req.params.id);
  if (!canSeeFullDonation(donation, req.user)) {
    throw ApiError.forbidden('You are not authorized to view this donation history');
  }
  const history = await getHistory(donation._id);
  return ok(res, { history });
});

/* ------------------------------------------------------------------ */
/* Donor routes                                                        */
/* ------------------------------------------------------------------ */

/**
 * POST /api/donations  (DONOR)
 * Creates a donation in AVAILABLE status. Donations whose safe-consumption
 * deadline is already in the past are rejected.
 */
const createDonation = asyncHandler(async (req, res) => {
  const body = req.body;

  const preparationDate = parseDate(body.preparationDate, 'preparation date');
  const availableFrom = parseDate(body.availableFrom, 'available-from time');
  const safeConsumptionDeadline = parseDate(body.safeConsumptionDeadline, 'safe-consumption deadline');

  if (!safeConsumptionDeadline) throw ApiError.badRequest('Safe-consumption deadline is required');
  if (safeConsumptionDeadline.getTime() <= Date.now()) {
    throw ApiError.badRequest('The safe-consumption deadline must be in the future');
  }
  if (preparationDate && preparationDate.getTime() > safeConsumptionDeadline.getTime()) {
    throw ApiError.badRequest('Preparation time cannot be after the safe-consumption deadline');
  }

  const donation = await Donation.create({
    foodName: body.foodName,
    category: body.category,
    description: body.description || '',
    quantity: Number(body.quantity),
    unit: body.unit,
    foodClassification: body.foodClassification || 'VEG',
    preparationDate,
    availableFrom,
    safeConsumptionDeadline,
    pickupAddress: body.pickupAddress,
    city: body.city,
    locationDescription: body.locationDescription || '',
    storageInformation: body.storageInformation || '',
    additionalNotes: body.additionalNotes || '',
    contactName: body.contactName,
    contactPhone: body.contactPhone,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
    donorId: req.user._id,
    status: DONATION_STATUS.AVAILABLE,
    statusUpdatedBy: req.user._id,
    statusUpdatedAt: new Date(),
  });

  // First entry of the audit trail for this donation.
  await DonationHistory.create({
    donationId: donation._id,
    previousStatus: null,
    newStatus: DONATION_STATUS.AVAILABLE,
    updatedBy: req.user._id,
    updatedByRole: req.user.role,
    note: 'Donation registered by the donor',
    timestamp: new Date(),
  });

  return ok(res, { donation }, 'Donation created successfully', 201);
});

/** GET /api/donations/my  (DONOR) - own records + dashboard summary. */
const listMyDonations = asyncHandler(async (req, res) => {
  const { filter, sort, page, limit, skip } = buildDonationQuery(
    { ...req.query, donorId: String(req.user._id) },
    { includeExpired: true }
  );

  const [items, total, summaryDocs] = await Promise.all([
    Donation.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Donation.countDocuments(filter),
    Donation.aggregate([{ $match: { donorId: req.user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const summary = {
    total: 0,
    AVAILABLE: 0,
    ACCEPTED: 0,
    PICKUP_ASSIGNED: 0,
    COLLECTED: 0,
    DISTRIBUTED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    REJECTED: 0,
  };
  summaryDocs.forEach((row) => {
    summary[row._id] = row.count;
    summary.total += row.count;
  });

  return ok(res, {
    donations: items.map((d) => ({ ...d, isExpired: isExpired(d) })),
    summary,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/**
 * PUT /api/donations/:id  (DONOR, owner only)
 * Only donations that have not been accepted can be edited.
 */
const updateDonation = asyncHandler(async (req, res) => {
  const donation = await loadDonation(req.params.id);

  if (!isOwner(donation, req.user)) throw ApiError.forbidden('You can only edit your own donations');
  if (donation.status !== DONATION_STATUS.AVAILABLE) {
    throw ApiError.badRequest('Only donations that have not been accepted can be edited');
  }

  const body = req.body;
  const preparationDate = parseDate(body.preparationDate, 'preparation date');
  const availableFrom = parseDate(body.availableFrom, 'available-from time');
  const safeConsumptionDeadline = parseDate(body.safeConsumptionDeadline, 'safe-consumption deadline');

  if (safeConsumptionDeadline) {
    if (safeConsumptionDeadline.getTime() <= Date.now()) {
      throw ApiError.badRequest('The safe-consumption deadline must be in the future');
    }
    if (preparationDate && preparationDate.getTime() > safeConsumptionDeadline.getTime()) {
      throw ApiError.badRequest('Preparation time cannot be after the safe-consumption deadline');
    }
  }

  const editable = [
    'foodName',
    'category',
    'description',
    'quantity',
    'unit',
    'foodClassification',
    'locationDescription',
    'storageInformation',
    'additionalNotes',
    'contactName',
    'contactPhone',
    'pickupAddress',
    'city',
  ];
  editable.forEach((field) => {
    if (body[field] !== undefined && body[field] !== '') {
      donation[field] = field === 'quantity' ? Number(body[field]) : body[field];
    }
  });
  if (preparationDate) donation.preparationDate = preparationDate;
  if (availableFrom) donation.availableFrom = availableFrom;
  if (safeConsumptionDeadline) donation.safeConsumptionDeadline = safeConsumptionDeadline;
  if (req.file) donation.imageUrl = `/uploads/${req.file.filename}`;

  await donation.save();
  return ok(res, { donation }, 'Donation updated successfully');
});

/**
 * PATCH /api/donations/:id/cancel  (DONOR, owner only)
 * Eligible while the food has not been physically collected yet.
 * Cancelling also closes any open pickup task.
 */
const cancelDonation = asyncHandler(async (req, res) => {
  const donation = await loadDonation(req.params.id);
  if (!isOwner(donation, req.user)) throw ApiError.forbidden('You can only cancel your own donations');

  const eligible = [DONATION_STATUS.AVAILABLE, DONATION_STATUS.ACCEPTED, DONATION_STATUS.PICKUP_ASSIGNED];
  if (!eligible.includes(donation.status)) {
    throw ApiError.badRequest(
      `A donation with status ${donation.status} can no longer be cancelled. Contact the administrator.`
    );
  }
  if (!isDonationTransitionAllowed(donation.status, DONATION_STATUS.CANCELLED)) {
    throw ApiError.badRequest('This donation cannot be cancelled');
  }

  const previousStatus = donation.status;
  const updated = await transitionDonation({
    donationId: donation._id,
    fromStatus: previousStatus,
    toStatus: DONATION_STATUS.CANCELLED,
    user: req.user,
    note: req.body?.reason ? `Cancelled by donor: ${req.body.reason}` : 'Cancelled by donor',
    extraUpdate: { assignedVolunteerId: null },
  });

  const openPickup = await Pickup.findOne({ donationId: donation._id, isActive: true });
  if (openPickup) {
    openPickup.isActive = false;
    openPickup.status = 'CANCELLED';
    await openPickup.save();
    if (openPickup.volunteerId) {
      await notify({
        recipientId: openPickup.volunteerId,
        title: 'Pickup cancelled',
        message: `The pickup task for "${donation.foodName}" was cancelled by the donor.`,
        type: 'WARNING',
        relatedDonationId: donation._id,
      });
    }
  }
  if (donation.acceptedByNgoId) {
    await notify({
      recipientId: donation.acceptedByNgoId,
      title: 'Donation cancelled',
      message: `The donor cancelled "${donation.foodName}".`,
      type: 'WARNING',
      relatedDonationId: donation._id,
    });
  }

  return ok(res, { donation: updated }, 'Donation cancelled');
});

module.exports = {
  listDonations,
  getDonation,
  getDonationHistory,
  createDonation,
  listMyDonations,
  updateDonation,
  cancelDonation,
  toPublicDonation,
  canSeeFullDonation,
  loadDonation,
};
