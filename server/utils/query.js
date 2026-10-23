/**
 * Builds the list query used by the public "Available Donations" page, the NGO
 * browse page and the admin donation table.
 *
 * Anonymous visitors only ever see donations that are still AVAILABLE and have
 * not passed their safe-consumption deadline.
 */
const mongoose = require('mongoose');
const { DONATION_STATUS } = require('./statusFlow');

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  deadline: { safeConsumptionDeadline: 1 }, // earliest deadline first
  'deadline-desc': { safeConsumptionDeadline: -1 },
  quantity: { quantity: -1 },
  name: { foodName: 1 },
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Only accepts non-empty strings; anything else (objects, arrays) is ignored. */
const str = (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

const num = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const buildDonationQuery = (query = {}, { includeExpired = false, restrictToAvailable = false } = {}) => {
  const filter = {};

  const status = str(query.status);
  if (restrictToAvailable) filter.status = DONATION_STATUS.AVAILABLE;
  else if (status && Object.values(DONATION_STATUS).includes(status)) filter.status = status;

  const category = str(query.category);
  if (category) filter.category = category;

  const city = str(query.city);
  if (city) filter.city = new RegExp(`^${escapeRegex(city)}$`, 'i');

  const cityPartial = str(query.cityPartial);
  if (cityPartial) filter.city = new RegExp(escapeRegex(cityPartial), 'i');

  const classification = str(query.classification);
  if (classification) filter.foodClassification = classification;

  const minQuantity = num(query.minQuantity);
  const maxQuantity = num(query.maxQuantity);
  if (minQuantity !== null || maxQuantity !== null) {
    filter.quantity = {};
    if (minQuantity !== null) filter.quantity.$gte = minQuantity;
    if (maxQuantity !== null) filter.quantity.$lte = maxQuantity;
  }

  const deadlineBefore = str(query.deadlineBefore);
  if (deadlineBefore) {
    const d = new Date(deadlineBefore);
    if (!Number.isNaN(d.getTime())) filter.safeConsumptionDeadline = { ...(filter.safeConsumptionDeadline || {}), $lte: d };
  }

  if (!includeExpired) {
    // Expired donations must never be presented as eligible for acceptance.
    filter.safeConsumptionDeadline = { ...(filter.safeConsumptionDeadline || {}), $gte: new Date() };
  }

  const search = str(query.search);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ foodName: rx }, { description: rx }, { city: rx }, { category: rx }];
  }

  const fromDate = str(query.fromDate);
  const toDate = str(query.toDate);
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) {
      const d = new Date(fromDate);
      if (!Number.isNaN(d.getTime())) filter.createdAt.$gte = d;
    }
    if (toDate) {
      const d = new Date(toDate);
      if (!Number.isNaN(d.getTime())) {
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
  }

  const donorId = str(query.donorId);
  if (donorId && mongoose.isValidObjectId(donorId)) filter.donorId = donorId;

  const sortKey = str(query.sort);
  const sort = SORTS[sortKey] || SORTS.newest;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 9));

  return { filter, sort, page, limit, skip: (page - 1) * limit };
};

module.exports = { buildDonationQuery, SORTS, escapeRegex };
