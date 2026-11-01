/**
 * Static fallback values for the reference data served by GET /api/meta.
 *
 * The forms and filters populate their <select> dropdowns from that endpoint.
 * Until it resolves (or if it fails — e.g. a cold start on the backend) the
 * lists are empty and the dropdowns render with no options. These mirrors of
 * the backend's constants are used as the initial state so the UI is never
 * blank, and the live /api/meta values override them once they arrive.
 */

export const FALLBACK_FOOD_CATEGORIES = [
  'Cooked Meals',
  'Fruits',
  'Vegetables',
  'Bakery Products',
  'Packaged Food',
  'Rice and Grains',
  'Other',
];

export const FALLBACK_UNITS = [
  'Servings',
  'Kg',
  'Plates',
  'Packs',
  'Boxes',
  'Litres',
  'Dozen',
];

export const FALLBACK_DONOR_CATEGORIES = [
  'Household',
  'Restaurant',
  'Hotel',
  'Hostel',
  'College Canteen',
  'Event Organizer',
  'Catering Service',
  'Other',
];

/**
 * Merges a /api/meta response over the fallbacks so a partial or failed
 * response can never blank out a dropdown that was already populated.
 */
export const mergeMeta = (prev, incoming = {}) => ({
  foodCategories: incoming.foodCategories?.length ? incoming.foodCategories : prev.foodCategories,
  units: incoming.units?.length ? incoming.units : prev.units,
  classifications: incoming.classifications?.length ? incoming.classifications : prev.classifications,
  donorCategories: incoming.donorCategories?.length ? incoming.donorCategories : prev.donorCategories,
  donationStatuses: incoming.donationStatuses?.length ? incoming.donationStatuses : prev.donationStatuses,
  pickupStatuses: incoming.pickupStatuses?.length ? incoming.pickupStatuses : prev.pickupStatuses,
});
