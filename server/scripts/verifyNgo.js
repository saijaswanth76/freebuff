#!/usr/bin/env node
/**
 * Utility script to verify an NGO account directly in the configured MongoDB.
 *
 * Usage:
 *   npm run verify-ngo -- --email=ngo@example.com
 *   node scripts/verifyNgo.js --email=ngo@example.com
 */
require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

const argValue = (name, fallback = null) => {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
};

async function main() {
  const email = argValue('email') || process.argv[2];

  if (!email) {
    console.error('Error: Please specify the NGO email.');
    console.error('Usage: npm run verify-ngo -- --email=ngo@example.com');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    console.error(`User with email "${email}" not found.`);
    await disconnectDB();
    process.exit(1);
  }

  if (user.role !== 'NGO') {
    console.warn(`Warning: User ${user.email} has role "${user.role}" (expected "NGO").`);
  }

  user.verificationStatus = 'VERIFIED';
  await user.save();

  console.log(`\nSUCCESS: NGO "${user.name}" (${user.email}) has been marked as VERIFIED.\n`);

  await disconnectDB();
}

main().catch((err) => {
  console.error('Failed to verify NGO:', err);
  process.exit(1);
});
