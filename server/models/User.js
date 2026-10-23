const mongoose = require('mongoose');

const ROLES = ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'];
const DONOR_CATEGORIES = [
  'Household',
  'Restaurant',
  'Hotel',
  'Hostel',
  'College Canteen',
  'Event Organizer',
  'Catering Service',
  'Other',
];
const VERIFICATION_STATUSES = ['NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    // Never returned by the API and never stored in plain text.
    passwordHash: { type: String, required: true, select: false },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[0-9+\-\s()]{7,15}$/, 'Please provide a valid phone number'],
    },
    role: { type: String, enum: ROLES, required: true },
    address: { type: String, trim: true, maxlength: 200, default: '' },
    city: { type: String, required: [true, 'City is required'], trim: true, maxlength: 80 },
    organizationName: { type: String, trim: true, maxlength: 120, default: '' },
    organizationDescription: { type: String, trim: true, maxlength: 1000, default: '' },
    // Only meaningful for NGO accounts (NGO -> PENDING, others -> NOT_REQUIRED).
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'NOT_REQUIRED' },
    verificationNote: { type: String, trim: true, maxlength: 500, default: '' },
    // Donors choose what kind of food provider they are.
    donorCategory: { type: String, enum: [...DONOR_CATEGORIES, ''], default: '' },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ city: 1, role: 1 });
userSchema.index({ role: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.DONOR_CATEGORIES = DONOR_CATEGORIES;
module.exports.VERIFICATION_STATUSES = VERIFICATION_STATUSES;
