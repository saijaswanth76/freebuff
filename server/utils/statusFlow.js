/**
 * Single source of truth for donation / pickup lifecycle rules.
 * Invalid transitions are rejected by the controllers using these maps.
 *
 *   AVAILABLE -> ACCEPTED -> PICKUP_ASSIGNED -> COLLECTED -> DISTRIBUTED -> COMPLETED
 *        \-> CANCELLED / REJECTED (donor cancel, admin reject)
 */

const DONATION_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  ACCEPTED: 'ACCEPTED',
  PICKUP_ASSIGNED: 'PICKUP_ASSIGNED',
  COLLECTED: 'COLLECTED',
  DISTRIBUTED: 'DISTRIBUTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
});

const PICKUP_STATUS = Object.freeze({
  OPEN: 'OPEN',           // NGO asked for a volunteer, nobody accepted yet
  ASSIGNED: 'ASSIGNED',   // a volunteer accepted / was assigned
  COLLECTED: 'COLLECTED', // volunteer confirmed food collection
  DELIVERED: 'DELIVERED', // volunteer confirmed delivery to the NGO
  CONFIRMED: 'CONFIRMED', // NGO confirmed the distribution
  CANCELLED: 'CANCELLED',
});

/** Allowed donation status transitions (from -> [to, ...]). */
const DONATION_TRANSITIONS = Object.freeze({
  AVAILABLE: ['ACCEPTED', 'CANCELLED', 'REJECTED'],
  ACCEPTED: ['PICKUP_ASSIGNED', 'CANCELLED', 'REJECTED'],
  PICKUP_ASSIGNED: ['COLLECTED', 'ACCEPTED', 'CANCELLED', 'REJECTED'],
  COLLECTED: ['DISTRIBUTED'],
  DISTRIBUTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
});

const TERMINAL_DONATION_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED'];

const isDonationTransitionAllowed = (from, to) =>
  Array.isArray(DONATION_TRANSITIONS[from]) && DONATION_TRANSITIONS[from].includes(to);

/** True when the safe-consumption deadline has already passed. */
const isExpired = (donation) => {
  const deadline = donation && donation.safeConsumptionDeadline;
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
};

/** Donations that are past their deadline must not be presented as eligible. */
const isEligibleForAcceptance = (donation) =>
  donation.status === DONATION_STATUS.AVAILABLE && !isExpired(donation);

module.exports = {
  DONATION_STATUS,
  PICKUP_STATUS,
  DONATION_TRANSITIONS,
  TERMINAL_DONATION_STATUSES,
  isDonationTransitionAllowed,
  isExpired,
  isEligibleForAcceptance,
};
