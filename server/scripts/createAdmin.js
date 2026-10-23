#!/usr/bin/env node
/**
 * Securely creates the first administrator account.
 *
 * There is NO public admin registration route on purpose. Run this script once
 * after configuring server/.env:
 *
 *   npm run create-admin -- --email=admin@college.edu --password="StrongPass123" --name="Project Admin"
 *
 * or run it without arguments to be prompted (password input is hidden).
 */
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

const argValue = (name, fallback = null) => {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
};

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const onData = (char) => {
      const c = char.toString();
      if (c === '\n' || c === '\r' || c === '\u0004') {
        process.stdin.removeListener('data', onData);
      } else if (c !== '\u0003') {
        process.stdout.write('*');
      }
    };
    process.stdout.write(question);
    process.stdin.on('data', onData);
    rl.question('', (answer) => {
      process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Copy .env.example to .env first.');
    process.exit(1);
  }

  await connectDB();

  try {
    const email = (argValue('email') || (await prompt('Admin email: '))).trim().toLowerCase();
    const name = (argValue('name') || (await prompt('Admin name: '))).trim();
    const city = (argValue('city') || 'Local City').trim();

    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please provide a valid email address.');
    if (name.length < 2) throw new Error('Please provide a name with at least 2 characters.');

    let password = argValue('password');
    if (!password) password = await promptHidden('Admin password (min 8 chars): ');
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters long.');

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role === 'ADMIN') {
        console.log(`\nAn administrator already exists for ${email}. Nothing to do.`);
        return;
      }
      throw new Error(`The email ${email} already belongs to a ${existing.role} account.`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email,
      passwordHash,
      phone: argValue('phone') || '0000000000',
      role: 'ADMIN',
      city,
      address: argValue('address') || '',
      verificationStatus: 'NOT_REQUIRED',
      isActive: true,
    });

    console.log(`\n✅ Administrator account created: ${email}`);
    console.log('   Log in at /login with role Administrator (the role is fixed server-side).');
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

/** Simple non-hidden prompt helper. */
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

main();
