#!/usr/bin/env node
/**
 * Optional DEVELOPMENT seed script.
 * Inserts clearly identified sample records so the demo has content:
 *   - 1 administrator, 2 donors, 2 NGOs (one verified), 2 volunteers
 *   - donations in different lifecycle states + pickups + history + notifications
 *
 *   npm run seed            (refuses to run in production unless --force)
 *
 * Every seeded document uses the "(seed)" marker in its names.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Pickup = require('../models/Pickup');
const DonationHistory = require('../models/DonationHistory');
const Notification = require('../models/Notification');
const { DONATION_STATUS, PICKUP_STATUS } = require('../utils/statusFlow');

const HOUR = 60 * 60 * 1000;

const now = Date.now();
const inHours = (h) => new Date(now + h * HOUR);
const ago = (h) => new Date(now - h * HOUR);

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('Refusing to seed a production database. Re-run with --force if this is intended.');
    process.exit(1);
  }

  const alreadyConnected = require('mongoose').connection.readyState === 1;
  if (!alreadyConnected) await connectDB();
  console.log('[seed] clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Donation.deleteMany({}),
    Pickup.deleteMany({}),
    DonationHistory.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash('Demo@123', 10);

  /* ------------------------------ users ------------------------------- */
  const [admin, donorHome, donorRest, ngoA, ngoB, volA, volB] = await User.create([
    {
      name: 'Project Administrator (seed)',
      email: 'admin@cfds.local',
      passwordHash,
      phone: '9000000001',
      role: 'ADMIN',
      city: 'Pune',
      address: 'Admin Office, College Campus',
      verificationStatus: 'NOT_REQUIRED',
    },
    {
      name: 'Sample Household Donor (seed)',
      email: 'donor@cfds.local',
      passwordHash,
      phone: '9000000002',
      role: 'DONOR',
      donorCategory: 'Household',
      city: 'Pune',
      address: '12, Green Park Society',
      verificationStatus: 'NOT_REQUIRED',
    },
    {
      name: 'Sample Restaurant Donor (seed)',
      email: 'restaurant@cfds.local',
      passwordHash,
      phone: '9000000003',
      role: 'DONOR',
      donorCategory: 'Restaurant',
      city: 'Pune',
      address: '45 FC Road',
      verificationStatus: 'NOT_REQUIRED',
    },
    {
      name: 'Hope NGO Coordinator (seed)',
      email: 'ngo@cfds.local',
      passwordHash,
      phone: '9000000004',
      role: 'NGO',
      organizationName: 'Hope Foundation (seed)',
      organizationDescription: 'Community kitchen distributing meals to underserved neighbourhoods.',
      city: 'Pune',
      address: 'Hope Bhavan, Shivajinagar',
      verificationStatus: 'VERIFIED',
    },
    {
      name: 'Care NGO Coordinator (seed)',
      email: 'ngo2@cfds.local',
      passwordHash,
      phone: '9000000005',
      role: 'NGO',
      organizationName: 'Care Trust (seed)',
      organizationDescription: 'Weekend food distribution drives across the city.',
      city: 'Pune',
      address: 'Care Centre, Kothrud',
      verificationStatus: 'VERIFIED',
    },
    {
      name: 'Sample Volunteer One (seed)',
      email: 'volunteer@cfds.local',
      passwordHash,
      phone: '9000000006',
      role: 'VOLUNTEER',
      city: 'Pune',
      address: 'Hostel Block C, College Campus',
      verificationStatus: 'NOT_REQUIRED',
    },
    {
      name: 'Sample Volunteer Two (seed)',
      email: 'volunteer2@cfds.local',
      passwordHash,
      phone: '9000000007',
      role: 'VOLUNTEER',
      city: 'Pune',
      address: '9 Lake View Road',
      verificationStatus: 'NOT_REQUIRED',
    },
  ]);

  /* ---------------------------- donations ----------------------------- */
  const mkDonation = (over) => ({
    description: 'Freshly prepared surplus food, packed and ready for pickup.',
    foodClassification: 'VEG',
    storageInformation: 'Keep covered in a cool place; do not leave in direct sunlight.',
    locationDescription: 'Near the main gate, ask at reception.',
    additionalNotes: '',
    status: DONATION_STATUS.AVAILABLE,
    statusUpdatedAt: new Date(),
    ...over,
  });

  const [d1, d2, d3, d4, d5, d6] = await Donation.create([
    mkDonation({
      foodName: 'Vegetable Pulao (40 servings)',
      category: 'Cooked Meals',
      quantity: 40,
      unit: 'Servings',
      preparationDate: ago(1),
      availableFrom: ago(1),
      safeConsumptionDeadline: inHours(5),
      pickupAddress: '12, Green Park Society, Pune',
      city: 'Pune',
      contactName: 'Sample Household Donor (seed)',
      contactPhone: '9000000002',
      donorId: donorHome._id,
    }),
    mkDonation({
      foodName: 'Mixed Fruit Baskets',
      category: 'Fruits',
      quantity: 15,
      unit: 'Kg',
      availableFrom: ago(2),
      safeConsumptionDeadline: inHours(30),
      pickupAddress: '45 FC Road, Pune',
      city: 'Pune',
      foodClassification: 'VEG',
      contactName: 'Sample Restaurant Donor (seed)',
      contactPhone: '9000000003',
      donorId: donorRest._id,
      locationDescription: 'Rear service entrance of the restaurant.',
    }),
    mkDonation({
      foodName: 'Bread and Buns',
      category: 'Bakery Products',
      quantity: 60,
      unit: 'Packs',
      availableFrom: ago(6),
      safeConsumptionDeadline: inHours(12),
      pickupAddress: '45 FC Road, Pune',
      city: 'Pune',
      contactName: 'Sample Restaurant Donor (seed)',
      contactPhone: '9000000003',
      donorId: donorRest._id,
    }),
    // Expired listing - kept to demonstrate that expired donations are hidden
    // from the available list and cannot be accepted.
    mkDonation({
      foodName: 'Expired Rice Bags (demo)',
      category: 'Rice and Grains',
      quantity: 10,
      unit: 'Kg',
      availableFrom: ago(40),
      safeConsumptionDeadline: ago(2),
      pickupAddress: '12, Green Park Society, Pune',
      city: 'Pune',
      contactName: 'Sample Household Donor (seed)',
      contactPhone: '9000000002',
      donorId: donorHome._id,
    }),
    mkDonation({
      foodName: 'Cooked Dal and Roti (25 servings)',
      category: 'Cooked Meals',
      quantity: 25,
      unit: 'Servings',
      preparationDate: ago(3),
      availableFrom: ago(3),
      safeConsumptionDeadline: inHours(4),
      pickupAddress: '12, Green Park Society, Pune',
      city: 'Pune',
      contactName: 'Sample Household Donor (seed)',
      contactPhone: '9000000002',
      donorId: donorHome._id,
      status: DONATION_STATUS.COMPLETED,
      acceptedByNgoId: ngoA._id,
      assignedVolunteerId: volA._id,
      statusUpdatedAt: ago(1),
    }),
    mkDonation({
      foodName: 'Packaged Snack Boxes',
      category: 'Packaged Food',
      quantity: 30,
      unit: 'Boxes',
      availableFrom: ago(5),
      safeConsumptionDeadline: inHours(48),
      pickupAddress: '45 FC Road, Pune',
      city: 'Pune',
      contactName: 'Sample Restaurant Donor (seed)',
      contactPhone: '9000000003',
      donorId: donorRest._id,
      status: DONATION_STATUS.ACCEPTED,
      acceptedByNgoId: ngoB._id,
      statusUpdatedAt: ago(2),
    }),
  ]);

  /* --------------------------- pickup + history ------------------------ */
  await Pickup.create({
    donationId: d5._id,
    ngoId: ngoA._id,
    volunteerId: volA._id,
    pickupAddress: d5.pickupAddress,
    deliveryAddress: 'Hope Bhavan, Shivajinagar, Pune',
    scheduledPickupTime: ago(2),
    assignmentDate: ago(3),
    status: PICKUP_STATUS.CONFIRMED,
    collectedAt: ago(2),
    deliveredAt: ago(1.5),
    confirmedAt: ago(1),
    notes: 'Collected packed and labelled containers.',
    deliveryNotes: 'Handed over to the NGO kitchen in-charge.',
    isActive: true,
  });

  const historyFor = (donation, steps) =>
    DonationHistory.create(
      steps.map((s) => ({
        donationId: donation._id,
        previousStatus: s.from,
        newStatus: s.to,
        updatedBy: s.by,
        updatedByRole: s.role,
        note: s.note,
        timestamp: s.at,
      }))
    );

  await historyFor(d5, [
    { from: null, to: 'AVAILABLE', by: donorHome._id, role: 'DONOR', note: 'Donation registered by the donor', at: ago(3.5) },
    { from: 'AVAILABLE', to: 'ACCEPTED', by: ngoA._id, role: 'NGO', note: 'Accepted by Hope Foundation (seed)', at: ago(3) },
    { from: 'ACCEPTED', to: 'PICKUP_ASSIGNED', by: ngoA._id, role: 'NGO', note: 'Pickup assigned to Sample Volunteer One (seed)', at: ago(3) },
    { from: 'PICKUP_ASSIGNED', to: 'COLLECTED', by: volA._id, role: 'VOLUNTEER', note: 'Food collected by the volunteer', at: ago(2) },
    { from: 'COLLECTED', to: 'DISTRIBUTED', by: volA._id, role: 'VOLUNTEER', note: 'Food delivered to the NGO / distribution point', at: ago(1.5) },
    { from: 'DISTRIBUTED', to: 'COMPLETED', by: ngoA._id, role: 'NGO', note: 'Distribution confirmed by the NGO', at: ago(1) },
  ]);
  await historyFor(d6, [
    { from: null, to: 'AVAILABLE', by: donorRest._id, role: 'DONOR', note: 'Donation registered by the donor', at: ago(6) },
    { from: 'AVAILABLE', to: 'ACCEPTED', by: ngoB._id, role: 'NGO', note: 'Accepted by Care Trust (seed)', at: ago(2) },
  ]);
  await historyFor(d1, [
    { from: null, to: 'AVAILABLE', by: donorHome._id, role: 'DONOR', note: 'Donation registered by the donor', at: ago(1) },
  ]);
  await historyFor(d4, [
    { from: null, to: 'AVAILABLE', by: donorHome._id, role: 'DONOR', note: 'Donation registered by the donor', at: ago(40) },
  ]);

  await Notification.create([
    {
      recipientId: donorHome._id,
      title: 'Donation accepted',
      message: 'Hope Foundation (seed) accepted your donation "Cooked Dal and Roti (25 servings)".',
      type: 'SUCCESS',
      relatedDonationId: d5._id,
      isRead: true,
    },
    {
      recipientId: volA._id,
      title: 'Delivery confirmed',
      message: 'The delivery of "Cooked Dal and Roti (25 servings)" was confirmed by the NGO.',
      type: 'SUCCESS',
      relatedDonationId: d5._id,
      isRead: false,
    },
  ]);

  const accounts = {
    password: 'Demo@123',
    admin: 'admin@cfds.local',
    donor: 'donor@cfds.local',
    restaurant: 'restaurant@cfds.local',
    ngo: 'ngo@cfds.local',
    ngo2: 'ngo2@cfds.local',
    volunteer: 'volunteer@cfds.local',
    volunteer2: 'volunteer2@cfds.local',
  };

  console.log(`
✅ Seed data created.

   Login accounts (password for all: ${accounts.password})
   ---------------------------------------------------------
   Administrator : ${accounts.admin}
   Donor         : ${accounts.donor}
   Donor (rest.) : ${accounts.restaurant}
   NGO verified  : ${accounts.ngo}
   NGO verified  : ${accounts.ngo2}
   Volunteer     : ${accounts.volunteer}
   Volunteer     : ${accounts.volunteer2}
   ---------------------------------------------------------
`);

  // When seeded from the running server, the caller owns the connection.
  if (alreadyConnected) return accounts;
  await disconnectDB();
  return accounts;
}

/**
 * Programmatic entry point used by server.js (auto-seed of the in-memory
 * development database). `silent: true` suppresses the printed summary.
 */
async function runSeed({ silent = false, force = false } = {}) {
  const originalLog = console.log;
  if (silent) console.log = () => {};
  try {
    if (process.env.NODE_ENV === 'production' && !force && !process.argv.includes('--force')) {
      throw new Error('Refusing to seed a production database.');
    }
    return await main();
  } finally {
    console.log = originalLog;
  }
}

module.exports = { runSeed };

// CLI usage: `npm run seed`
if (require.main === module) {
  runSeed()
    .catch((err) => {
      console.error('[seed] failed:', err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) await disconnectDB();
    });
}
