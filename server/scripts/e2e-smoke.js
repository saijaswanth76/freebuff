#!/usr/bin/env node
/**
 * Live end-to-end smoke test.
 *
 * Runs the COMPLETE acceptance workflow against a running server:
 *   donor login -> create donation -> NGO1 accepts -> NGO2 blocked (409)
 *   -> NGO requests volunteer -> volunteer accepts/collects/delivers
 *   -> NGO confirms distribution -> donor sees COMPLETED + full history
 *   -> admin dashboard counts match -> unauthorized routes rejected.
 *
 * Usage:
 *   node scripts/e2e-smoke.js                       # http://localhost:5000
 *   node scripts/e2e-smoke.js http://localhost:5173 # through the Vite proxy
 *
 * Requires seed demo accounts (auto-seeded in-memory DB, or `npm run seed`).
 * Exits with code 0 when every assertion passes, 1 otherwise.
 */
const BASE = (process.argv[2] || process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const ACCOUNTS = {
  donor: { email: 'donor@cfds.local', password: 'Demo@123' },
  ngo1: { email: 'ngo@cfds.local', password: 'Demo@123' },
  ngo2: { email: 'ngo2@cfds.local', password: 'Demo@123' },
  volunteer: { email: 'volunteer@cfds.local', password: 'Demo@123' },
  admin: { email: 'admin@cfds.local', password: 'Demo@123' },
};

let passed = 0;
let failed = 0;

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  ✖ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const call = async (path, { method = 'GET', token, body, raw = false } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (err) {
    json = null;
  }
  return raw ? { status: res.status, json } : { status: res.status, json };
};

const login = async (account) => {
  const { status, json } = await call('/api/auth/login', { method: 'POST', body: account });
  if (status !== 200) throw new Error(`Login failed for ${account.email}: ${status} ${json?.message}`);
  return json.data.token;
};

async function main() {
  console.log(`\nE2E smoke test against ${BASE}\n`);

  // 0. Health + seed data present
  console.log('0. Server health');
  const health = await call('/api/health');
  check('API reachable', health.status === 200 && health.json?.success === true);
  const publicStats = await call('/api/stats/public');
  check(
    'public stats counted from DB',
    publicStats.json?.data?.stats && typeof publicStats.json.data.stats.totalDonations === 'number',
    `totalDonations=${publicStats.json?.data?.stats.totalDonations}`
  );

  // 1. Donor logs in and creates a fresh donation
  console.log('1. Donor flow');
  const donorToken = await login(ACCOUNTS.donor);
  check('donor login', Boolean(donorToken));

  const deadline = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const created = await call('/api/donations', {
    method: 'POST',
    token: donorToken,
    body: {
      foodName: `E2E Test Meal ${Date.now() % 100000}`,
      category: 'Cooked Meals',
      description: 'Created by the e2e smoke test.',
      quantity: 30,
      unit: 'Servings',
      foodClassification: 'VEG',
      availableFrom: new Date().toISOString(),
      safeConsumptionDeadline: deadline,
      pickupAddress: '12 Green Park Society, Pune',
      city: 'Pune',
      locationDescription: 'Near the main gate',
      storageInformation: 'Keep warm, serve within 4 hours',
      contactName: 'E2E Donor',
      contactPhone: '9876543210',
    },
  });
  check('donor creates donation (201)', created.status === 201, `status=${created.json?.data?.donation?.status}`);
  const donationId = created.json?.data?.donation?._id;
  if (!donationId) throw new Error('No donation id — cannot continue');

  // 2. The donation appears on the public availability page (no private fields)
  const publicList = await call(`/api/donations?search=${encodeURIComponent('E2E Test Meal')}`);
  const listItem = publicList.json?.data?.donations?.find((d) => d._id === donationId);
  check('donation appears in public list', Boolean(listItem));
  check(
    'public list hides donor contact details',
    listItem && listItem.contactPhone === undefined && listItem.pickupAddress === undefined && listItem.donorId === undefined
  );

  // 3. NGO1 accepts, NGO2 must get 409
  console.log('2. NGO acceptance');
  const ngo1Token = await login(ACCOUNTS.ngo1);
  const ngo2Token = await login(ACCOUNTS.ngo2);
  const accept = await call(`/api/ngo/donations/${donationId}/accept`, { method: 'POST', token: ngo1Token });
  check('NGO1 accepts (200)', accept.status === 200 && accept.json?.data?.donation?.status === 'ACCEPTED');
  const accept2 = await call(`/api/ngo/donations/${donationId}/accept`, { method: 'POST', token: ngo2Token });
  check('NGO2 blocked with 409', accept2.status === 409, accept2.json?.message);

  // 4. NGO1 requests a volunteer
  const request = await call(`/api/ngo/donations/${donationId}/request-volunteer`, {
    method: 'POST',
    token: ngo1Token,
    body: { notes: 'E2E: collect from the rear gate' },
  });
  check('pickup task created (OPEN)', request.status === 201 && request.json?.data?.pickup?.status === 'OPEN');
  const pickupId = request.json?.data?.pickup?._id;

  // 5. Volunteer accepts, collects, delivers
  console.log('3. Volunteer flow');
  const volToken = await login(ACCOUNTS.volunteer);
  const openTasks = await call('/api/volunteer/tasks', { token: volToken });
  check(
    'volunteer sees the open task',
    openTasks.json?.data?.tasks?.some((t) => t._id === pickupId)
  );
  const acceptTask = await call(`/api/volunteer/tasks/${pickupId}/accept`, { method: 'POST', token: volToken });
  check(
    'volunteer accepts task -> ASSIGNED / PICKUP_ASSIGNED',
    acceptTask.status === 200 &&
      acceptTask.json?.data?.task?.status === 'ASSIGNED' &&
      acceptTask.json?.data?.donation?.status === 'PICKUP_ASSIGNED'
  );
  const collect = await call(`/api/volunteer/tasks/${pickupId}/collect`, {
    method: 'PATCH',
    token: volToken,
    body: { notes: 'E2E collection' },
  });
  check(
    'collection -> COLLECTED',
    collect.status === 200 &&
      collect.json?.data?.task?.status === 'COLLECTED' &&
      collect.json?.data?.donation?.status === 'COLLECTED'
  );
  const deliver = await call(`/api/volunteer/tasks/${pickupId}/deliver`, {
    method: 'PATCH',
    token: volToken,
    body: { deliveryNotes: 'E2E delivery' },
  });
  check(
    'delivery -> DELIVERED / DISTRIBUTED',
    deliver.status === 200 &&
      deliver.json?.data?.task?.status === 'DELIVERED' &&
      deliver.json?.data?.donation?.status === 'DISTRIBUTED'
  );

  // 6. Out-of-order transitions are rejected
  const tooEarly = await call(`/api/ngo/donations/${donationId}/confirm-distribution`, {
    method: 'PATCH',
    token: ngo1Token,
    body: {},
  }); // already DISTRIBUTED? no - we just delivered, so this one should actually SUCCEED
  // Re-confirming after success must fail; do that check after the real confirmation below.

  // 7. NGO confirms distribution -> COMPLETED
  console.log('4. Distribution + audit');
  check('NGO confirm-distribution succeeded', tooEarly.status === 200, `status=${tooEarly.status}`);
  const completed = tooEarly.json?.data?.donation?.status;
  check('donation reaches COMPLETED', completed === 'COMPLETED', completed);

  const reconfirm = await call(`/api/ngo/donations/${donationId}/confirm-distribution`, {
    method: 'PATCH',
    token: ngo1Token,
    body: {},
  });
  check('re-confirmation rejected', reconfirm.status >= 400, `status=${reconfirm.status}`);

  // 8. Donor sees final status + complete history
  const donorView = await call(`/api/donations/${donationId}`, { token: donorToken });
  check('donor sees COMPLETED status', donorView.json?.data?.donation?.status === 'COMPLETED');
  const history = await call(`/api/donations/${donationId}/history`, { token: donorToken });
  const trail = (history.json?.data?.history || []).map((h) => h.newStatus).reverse();
  check(
    'audit trail complete',
    JSON.stringify(trail) ===
      JSON.stringify(['AVAILABLE', 'ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED', 'DISTRIBUTED', 'COMPLETED']),
    trail.join(' -> ')
  );

  // 9. Admin dashboard + donation history
  console.log('5. Administrator view');
  const adminToken = await login(ACCOUNTS.admin);
  const dash = await call('/api/admin/dashboard', { token: adminToken });
  const stats = dash.json?.data?.stats;
  const userList = await call('/api/admin/users?limit=200', { token: adminToken });
  const donationList = await call('/api/admin/donations?limit=200', { token: adminToken });
  check(
    'admin user counters match the DB',
    stats && userList.json?.data?.users?.length === stats.totalUsers,
    `users=${stats?.totalUsers}`
  );
  check(
    'admin donation counters match the DB',
    stats && donationList.json?.data?.donations?.length === stats.totalDonations,
    `donations=${stats?.totalDonations}`
  );
  const adminDonation = donationList.json?.data?.donations?.find((d) => d._id === donationId);
  check('admin can open the donation + its history', Boolean(adminDonation));
  const adminHistory = await call(`/api/donations/${donationId}/history`, { token: adminToken });
  check('admin sees the same audit trail', (adminHistory.json?.data?.history || []).length === 6);

  // 10. Unauthorized operations
  console.log('6. Authorization enforcement');
  const anonAdmin = await call('/api/admin/dashboard');
  check('anonymous -> admin route rejected (401)', anonAdmin.status === 401);
  const donorAdmin = await call('/api/admin/dashboard', { token: donorToken });
  check('donor -> admin route rejected (403)', donorAdmin.status === 403);
  const volNgo = await call('/api/ngo/accepted-donations', { token: volToken });
  check('volunteer -> NGO route rejected (403)', volNgo.status === 403);
  const anonDonor = await call('/api/donations/my');
  check('anonymous -> donor route rejected (401)', anonDonor.status === 401);
  const badLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { email: ACCOUNTS.donor.email, password: 'wrong-password' },
  });
  check('wrong password rejected (401)', badLogin.status === 401);
  const adminRegister = await call('/api/auth/register', {
    method: 'POST',
    body: { ...ACCOUNTS.donor, email: `admin-attempt-${Date.now()}@x.com`, role: 'ADMIN', terms: true, city: 'X', phone: '9876543210' },
  });
  check('ADMIN self-registration rejected (400)', adminRegister.status === 400);
  const expired = await call('/api/ngo/donations/not-a-valid-id/accept', { method: 'POST', token: ngo1Token });
  check('invalid donation id rejected (404/400)', expired.status === 404 || expired.status === 400, `status=${expired.status}`);

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err.message);
  process.exit(1);
});