const mongoose = require('mongoose');
const { DONATION_STATUS } = require('../utils/statusFlow');

const FOOD_CATEGORIES = [
  'Cooked Meals',
  'Fruits',
  'Vegetables',
  'Bakery Products',
  'Packaged Food',
  'Rice and Grains',
  'Other',
];

const UNITS = ['Servings', 'Kg', 'Plates', 'Packs', 'Boxes', 'Litres', 'Dozen'];
const CLASSIFICATIONS = ['VEG', 'NON_VEG', 'BOTH'];

const donationSchema = new mongoose.Schema(
  {
    foodName: {
      type: String,
      required: [true, 'Food name is required'],
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      required: [true, 'Food category is required'],
      enum: { values: FOOD_CATEGORIES, message: 'Invalid food category' },
    },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.1, 'Quantity must be greater than 0'],
      max: 100000,
    },
    unit: {
      type: String,
      required: [true, 'Quantity unit is required'],
      enum: { values: UNITS, message: 'Invalid quantity unit' },
    },
    foodClassification: { type: String, enum: CLASSIFICATIONS, default: 'VEG' },

    // Food-safety timing information supplied by the donor.
    preparationDate: { type: Date, default: null },
    availableFrom: { type: Date, default: null },
    safeConsumptionDeadline: {
      type: Date,
      required: [true, 'Safe-consumption deadline is required'],
    },

    pickupAddress: { type: String, required: [true, 'Pickup address is required'], trim: true, maxlength: 300 },
    city: { type: String, required: [true, 'City is required'], trim: true, maxlength: 80 },
    locationDescription: { type: String, trim: true, maxlength: 300, default: '' },
    storageInformation: { type: String, trim: true, maxlength: 500, default: '' },
    additionalNotes: { type: String, trim: true, maxlength: 1000, default: '' },

    // Contact details are only exposed to authorized users (NGO / volunteer / admin / owner).
    contactName: { type: String, required: [true, 'Contact name is required'], trim: true, maxlength: 100 },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true,
      match: [/^[0-9+\-\s()]{7,15}$/, 'Please provide a valid contact phone number'],
    },

    imageUrl: { type: String, default: '' },

    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    acceptedByNgoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedVolunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    status: {
      type: String,
      enum: { values: Object.values(DONATION_STATUS), message: 'Invalid donation status' },
      default: DONATION_STATUS.AVAILABLE,
      index: true,
    },
    statusUpdatedAt: { type: Date, default: Date.now },
    statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Eligibility flag used by public listings and acceptance checks.
donationSchema.virtual('isExpired').get(function isExpiredVirtual() {
  return this.safeConsumptionDeadline ? this.safeConsumptionDeadline.getTime() < Date.now() : false;
});

donationSchema.index({ status: 1, safeConsumptionDeadline: 1 });
donationSchema.index({ city: 1, category: 1 });
donationSchema.index({ donorId: 1, createdAt: -1 });
donationSchema.index({ foodName: 'text', description: 'text', city: 'text' });

module.exports = mongoose.model('Donation', donationSchema);
module.exports.FOOD_CATEGORIES = FOOD_CATEGORIES;
module.exports.UNITS = UNITS;
module.exports.CLASSIFICATIONS = CLASSIFICATIONS;
