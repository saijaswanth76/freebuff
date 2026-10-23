/**
 * End-to-end API tests for the Community Food Donation and Distribution System.
 *
 * Run with:   npm test        (from the server folder)
 *
 * The suite boots an in-memory MongoDB, so no local MongoDB installation is
 * required. It walks the complete donation workflow and asserts that every
 * unauthorized operation is rejected.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-automated-tests';
process.env.NGO_REQUIRE_VERIFICATION = 'false';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Pickup = require('../models/Pickup');
const DonationHistory = require('../models/DonationHistory');

let mongod;
const HOUR = 60 * 60 * 1000;

// Session agents keep the httpOnly cookie between requests.
const donorAgent = request.agent(app);
const ngo1Agent = request.agent(app);
const ngo2Agent = request.agent(app);
const volunteerAgent = request.agent(app);
const volunteer2Agent = request.agent(app);
const adminAgent = request.agent(app);

const state = { donationId: null, expiredDonationId: null, pickupId: null, secondDonationId: null, bearerToken: null };

const futureDate = () => new Date(Date.now() + 6 * HOUR).toISOString();
const pastDate = () => new Date(Date.now() - 6 * HOUR).toISOString();

const validDonation = (overrides = {}) => ({
  foodName: 'Vegetable Pulao',
  category: 'Cooked Meals',
  description: 'Surplus lunch from the canteen, packed in clean containers.',
  quantity: '25',
  unit: 'Servings',
  foodClassification: 'VEG',
  preparationDate: new Date(Date.now() - HOUR).toISOString(),
  availableFrom: new Date(Date.now() - HOUR).toISOString(),
  safeConsumptionDeadline: futureDate(),
  pickupAddress: '12 Green Park Society, Pune',
  city: 'Pune',
  locationDescription: 'Near the main gate',
  storageInformation: 'Keep covered, serve within 4 hours',
  contactName: 'Donor Contact',
  contactPhone: '9876543210',
  ...overrides,
});

const register = (agent, payload) => agent.post('/api/auth/register').send(payload);

const donorPayload = {
  name: 'Test Donor',
  email: 'donor@test.local',
  password: 'Secret123',
  phone: '9876500001',
  role: 'DONOR',
  donorCategory: 'Household',
  address: '12 Green Park Society',
  city: 'Pune',
  terms: true,
};

const ngoPayload = (n) => ({
  name: `Test NGO ${n}`,
  email: `ngo${n}@test.local`,
  password: 'Secret123',
  phone: '9876500002',
  role: 'NGO',
  organizationName: `Test NGO Org ${n}`,
  organizationDescription: 'Food redistribution NGO',
  address: 'Hope Bhavan',
  city: 'Pune',
  terms: true,
});

const volunteerPayload = (n) => ({
  name: `Test Volunteer ${n}`,
  email: `volunteer${n}@test.local`,
  password: 'Secret123',
  phone: '9876500003',
  role: 'VOLUNTEER',
  address: 'Hostel Block C',
  city: 'Pune',
  terms: true,
});

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'cfds-test' });
});

after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('1. Health & meta', () => {
  it('GET /api/health responds', async () => {
    const res = await request(app).get('/api/health').expect(200);
    assert.equal(res.body.success, true);
  });

  it('GET /api/meta returns reference data used by the forms', async () => {
    const res = await request(app).get('/api/meta').expect(200);
    assert.ok(res.body.data.foodCategories.includes('Cooked Meals'));
    assert.ok(res.body.data.units.includes('Servings'));
    assert.deepEqual(res.body.data.registerRoles, ['DONOR', 'NGO', 'VOLUNTEER']);
  });

  it('unknown API route returns 404 with the standard error shape', async () => {
    const res = await request(app).get('/api/does-not-exist').expect(404);
    assert.equal(res.body.success, false);
    assert.ok(res.body.message);
  });
});

describe('2. Authentication', () => {
  it('registers a donor and sets an httpOnly session cookie', async () => {
    const res = await register(donorAgent, donorPayload).expect(201);
    assert.equal(res.body.data.user.role, 'DONOR');
    assert.equal(res.body.data.user.passwordHash, undefined);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('cfds_token='));
    assert.ok(cookie, 'session cookie must be set');
    assert.match(cookie, /HttpOnly/i);
    state.bearerToken = res.body.data.token;
  });

  it('registers NGOs and volunteers', async () => {
    await register(ngo1Agent, ngoPayload(1)).expect(201);
    await register(ngo2Agent, ngoPayload(2)).expect(201);
    await register(volunteerAgent, volunteerPayload(1)).expect(201);
    await register(volunteer2Agent, volunteerPayload(2)).expect(201);
  });

  it('rejects duplicate registration with 409', async () => {
    const res = await register(request.agent(app), donorPayload).expect(409);
    assert.match(res.body.message, /already exists/i);
  });

  it('rejects registration without terms acceptance', async () => {
    const res = await register(request.agent(app), { ...donorPayload, email: 'x@test.local', terms: false }).expect(400);
    assert.match(res.body.message, /terms/i);
  });

  it('rejects ADMIN registration (admin accounts come from the script only)', async () => {
    const res = await register(request.agent(app), { ...donorPayload, email: 'admin1@test.local', role: 'ADMIN' }).expect(400);
    assert.match(res.body.message, /account type/i);
  });

  it('rejects weak passwords and invalid emails', async () => {
    await register(request.agent(app), { ...donorPayload, email: 'weak@test.local', password: '123' }).expect(400);
    await register(request.agent(app), { ...donorPayload, email: 'not-an-email' }).expect(400);
  });

  it('logs in with valid credentials and works with a Bearer token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: donorPayload.email, password: donorPayload.password }).expect(200);
    assert.ok(res.body.data.token, 'token returned for API clients such as Postman');
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.data.token}`).expect(200);
    assert.equal(me.body.data.user.email, donorPayload.email);
  });

  it('returns one generic error for a wrong password or unknown email', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: donorPayload.email, password: 'WrongPass1' }).expect(401);
    const b = await request(app).post('/api/auth/login').send({ email: 'nobody@test.local', password: 'WrongPass1' }).expect(401);
    assert.equal(a.body.message, b.body.message);
    assert.match(a.body.message, /invalid email or password/i);
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/auth/me').expect(401);
    assert.match(res.body.message, /log in/i);
  });

  it('logs out (clears the cookie)', async () => {
    const agent = request.agent(app);
    await register(agent, { ...donorPayload, email: 'logout@test.local' }).expect(201);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('3. Donor: donation CRUD', () => {
  it('creates a donation', async () => {
    const res = await donorAgent.post('/api/donations').send(validDonation()).expect(201);
    assert.equal(res.body.data.donation.status, 'AVAILABLE');
    assert.equal(res.body.data.donation.donorId, res.body.data.donation.donorId);
    state.donationId = res.body.data.donation._id;

    const history = await DonationHistory.find({ donationId: state.donationId }).lean();
    assert.equal(history.length, 1);
    assert.equal(history[0].newStatus, 'AVAILABLE');
  });

  it('rejects a donation with a past safe-consumption deadline', async () => {
    const res = await donorAgent.post('/api/donations').send(validDonation({ safeConsumptionDeadline: pastDate() })).expect(400);
    assert.match(res.body.message, /deadline/i);
  });

  it('rejects invalid food categories and missing fields', async () => {
    await donorAgent.post('/api/donations').send(validDonation({ category: 'Sushi' })).expect(400);
    await donorAgent.post('/api/donations').send(validDonation({ foodName: '' })).expect(400);
    await donorAgent.post('/api/donations').send(validDonation({ quantity: '-5' })).expect(400);
  });

  it('only lets the owner edit a donation', async () => {
    const res = await donorAgent
      .put(`/api/donations/${state.donationId}`)
      .send({ description: 'Updated description by the owner' })
      .expect(200);
    assert.equal(res.body.data.donation.description, 'Updated description by the owner');

    await ngo1Agent.put(`/api/donations/${state.donationId}`).send({ description: 'hacked' }).expect(403);
  });

  it('lists the donor own donations with a summary', async () => {
    const res = await donorAgent.get('/api/donations/my').expect(200);
    assert.equal(res.body.data.summary.total, res.body.data.donations.length);
    assert.ok(res.body.data.summary.AVAILABLE >= 1);
  });

  it('creates a second donation (used by the NGO flow) and an expired one', async () => {
    const second = await donorAgent.post('/api/donations').send(validDonation({ foodName: 'Bread Buns' })).expect(201);
    state.secondDonationId = second.body.data.donation._id;

    const expired = await donorAgent
      .post('/api/donations')
      .send(validDonation({ foodName: 'Expired Food', safeConsumptionDeadline: pastDate() }))
      .expect(400);
    assert.match(expired.body.message, /deadline/i);

    // Insert an expired record directly to prove the API hides/rejects it.
    const doc = await Donation.create({
      foodName: 'Expired Leftovers',
      category: 'Cooked Meals',
      quantity: 10,
      unit: 'Servings',
      safeConsumptionDeadline: new Date(Date.now() - HOUR),
      pickupAddress: 'Old Street 1',
      city: 'Pune',
      contactName: 'Donor',
      contactPhone: '9876543210',
      donorId: (await User.findOne({ email: donorPayload.email }))._id,
      status: 'AVAILABLE',
    });
    state.expiredDonationId = String(doc._id);
  });
});

describe('4. Public donation listing & privacy', () => {
  it('returns available donations without donor contact details', async () => {
    const res = await request(app).get('/api/donations').expect(200);
    assert.ok(res.body.data.donations.length >= 2);
    const item = res.body.data.donations.find((d) => String(d._id) === state.donationId);
    assert.ok(item, 'the new donation must appear in the public list');
    assert.equal(item.contactPhone, undefined);
    assert.equal(item.contactName, undefined);
    assert.equal(item.pickupAddress, undefined);
    assert.equal(item.donorId, undefined);
    assert.ok(item.city);
  });

  it('hides expired donations from the available list', async () => {
    const res = await request(app).get('/api/donations').expect(200);
    const expired = res.body.data.donations.find((d) => String(d._id) === state.expiredDonationId);
    assert.equal(expired, undefined);
  });

  it('supports search, category and city filters plus sorting', async () => {
    const bySearch = await request(app).get('/api/donations?search=Bread').expect(200);
    assert.ok(bySearch.body.data.donations.some((d) => d.foodName.includes('Bread')));

    const byCategory = await request(app).get('/api/donations?category=Bakery Products').expect(200);
    assert.ok(byCategory.body.data.donations.every((d) => d.category === 'Bakery Products'));

    const byCity = await request(app).get('/api/donations?city=pune').expect(200);
    assert.ok(byCity.body.data.donations.every((d) => d.city === 'Pune'));

    const sorted = await request(app).get('/api/donations?sort=deadline').expect(200);
    const deadlines = sorted.body.data.donations.map((d) => new Date(d.safeConsumptionDeadline).getTime());
    assert.deepEqual(deadlines, [...deadlines].sort((a, b) => a - b));
  });

  it('paginates results', async () => {
    const res = await request(app).get('/api/donations?page=1&limit=1').expect(200);
    assert.equal(res.body.data.donations.length, 1);
    assert.equal(res.body.data.pagination.limit, 1);
    assert.ok(res.body.data.pagination.total >= 2);
  });

  it('does not leak a private donation detail to anonymous users', async () => {
    const res = await request(app).get(`/api/donations/${state.donationId}`).expect(200);
    assert.equal(res.body.data.hasFullAccess, false);
    assert.equal(res.body.data.donation.pickupAddress, undefined);
  });

  it('blocks anonymous access to the donation history', async () => {
    await request(app).get(`/api/donations/${state.donationId}/history`).expect(401);
  });

  it('is not broken by NoSQL-style query operators', async () => {
    const res = await request(app).get('/api/donations?status[$ne]=CANCELLED').expect(200);
    assert.ok(Array.isArray(res.body.data.donations));
  });
});

describe('5. NGO: acceptance workflow', () => {
  it('lets an NGO browse available donations', async () => {
    const res = await ngo1Agent.get('/api/ngo/donations').expect(200);
    assert.ok(res.body.data.donations.some((d) => String(d._id) === state.donationId));
    assert.ok(res.body.data.donations.every((d) => d.status === 'AVAILABLE'));
  });

  it('accepts an available donation', async () => {
    const res = await ngo1Agent.post(`/api/ngo/donations/${state.donationId}/accept`).expect(200);
    assert.equal(res.body.data.donation.status, 'ACCEPTED');
    assert.ok(res.body.data.donation.acceptedByNgoId);
  });

  it('prevents a second NGO from accepting the same donation (409)', async () => {
    const res = await ngo2Agent.post(`/api/ngo/donations/${state.donationId}/accept`).expect(409);
    assert.match(res.body.message, /already been accepted/i);
  });

  it('rejects acceptance of an expired donation', async () => {
    const res = await ngo1Agent.post(`/api/ngo/donations/${state.expiredDonationId}/accept`).expect(400);
    assert.match(res.body.message, /deadline/i);
  });

  it('rejects acceptance by non-NGO accounts', async () => {
    await donorAgent.post(`/api/ngo/donations/${state.secondDonationId}/accept`).expect(403);
    await volunteerAgent.post(`/api/ngo/donations/${state.secondDonationId}/accept`).expect(403);
    await request(app).post(`/api/ngo/donations/${state.secondDonationId}/accept`).expect(401);
  });

  it('NGO number 2 can accept a different donation', async () => {
    const res = await ngo2Agent.post(`/api/ngo/donations/${state.secondDonationId}/accept`).expect(200);
    assert.equal(res.body.data.donation.status, 'ACCEPTED');
  });

  it('lists accepted donations for each NGO', async () => {
    const res = await ngo1Agent.get('/api/ngo/accepted-donations').expect(200);
    assert.equal(res.body.data.donations.length, 1);
    assert.equal(String(res.body.data.donations[0]._id), state.donationId);
  });

  it('blocks a non-owner NGO from requesting volunteers for the donation', async () => {
    await ngo2Agent.post(`/api/ngo/donations/${state.donationId}/request-volunteer`).send({}).expect(403);
  });
});

describe('6. Volunteer: pickup workflow', () => {
  it('NGO requests a volunteer (creates an OPEN task)', async () => {
    const res = await ngo1Agent
      .post(`/api/ngo/donations/${state.donationId}/request-volunteer`)
      .send({ scheduledPickupTime: futureDate(), notes: 'Please collect from the rear gate' })
      .expect(201);
    assert.equal(res.body.data.pickup.status, 'OPEN');
    assert.equal(res.body.data.donation.status, 'ACCEPTED'); // still waiting for a volunteer
    state.pickupId = res.body.data.pickup._id;
  });

  it('volunteers see the open task, other users do not', async () => {
    const res = await volunteerAgent.get('/api/volunteer/tasks').expect(200);
    assert.ok(res.body.data.tasks.some((t) => String(t._id) === state.pickupId));
    await ngo1Agent.get('/api/volunteer/tasks').expect(403);
    await request(app).get('/api/volunteer/tasks').expect(401);
  });

  it('second request-volunteer for the same donation is a 409', async () => {
    await ngo1Agent.post(`/api/ngo/donations/${state.donationId}/request-volunteer`).send({}).expect(409);
  });

  it('volunteer accepts the task -> PICKUP_ASSIGNED', async () => {
    const res = await volunteerAgent.post(`/api/volunteer/tasks/${state.pickupId}/accept`).expect(200);
    assert.equal(res.body.data.task.status, 'ASSIGNED');
    assert.equal(res.body.data.donation.status, 'PICKUP_ASSIGNED');
  });

  it('another volunteer cannot steal or view the assigned task', async () => {
    await volunteer2Agent.post(`/api/volunteer/tasks/${state.pickupId}/accept`).expect(409);
    const res = await volunteer2Agent.get(`/api/volunteer/tasks/${state.pickupId}`).expect(403);
    assert.match(res.body.message, /another volunteer/i);
    await volunteer2Agent.patch(`/api/volunteer/tasks/${state.pickupId}/collect`).send({ notes: 'nope' }).expect(403);
  });

  it('rejects an out-of-order collection attempt', async () => {
    // The donation is PICKUP_ASSIGNED but the pickup itself is only ASSIGNED once;
    // delivering before collecting must fail.
    await volunteerAgent.patch(`/api/volunteer/tasks/${state.pickupId}/deliver`).send({ deliveryNotes: 'x' }).expect(400);
  });

  it('volunteer confirms collection -> COLLECTED', async () => {
    const res = await volunteerAgent
      .patch(`/api/volunteer/tasks/${state.pickupId}/collect`)
      .send({ notes: 'Packed in 3 crates' })
      .expect(200);
    assert.equal(res.body.data.task.status, 'COLLECTED');
    assert.ok(res.body.data.task.collectedAt);
    assert.equal(res.body.data.donation.status, 'COLLECTED');
  });

  it('volunteer confirms delivery -> DISTRIBUTED', async () => {
    const res = await volunteerAgent
      .patch(`/api/volunteer/tasks/${state.pickupId}/deliver`)
      .send({ deliveryNotes: 'Handed to NGO kitchen in-charge' })
      .expect(200);
    assert.equal(res.body.data.task.status, 'DELIVERED');
    assert.ok(res.body.data.task.deliveredAt);
    assert.equal(res.body.data.donation.status, 'DISTRIBUTED');
  });

  it('NGO confirms distribution -> COMPLETED', async () => {
    const res = await ngo1Agent
      .patch(`/api/ngo/donations/${state.donationId}/confirm-distribution`)
      .send({ distributionNote: 'Distributed at the community centre' })
      .expect(200);
    assert.equal(res.body.data.donation.status, 'COMPLETED');
    assert.ok(res.body.data.donation.statusUpdatedAt);
  });

  it('a different NGO cannot confirm distribution', async () => {
    await ngo2Agent.patch(`/api/ngo/donations/${state.donationId}/confirm-distribution`).send({}).expect(403);
  });

  it('cannot re-complete a finished donation', async () => {
    const res = await ngo1Agent.patch(`/api/ngo/donations/${state.donationId}/confirm-distribution`).send({}).expect(400);
    assert.match(res.body.message, /status/i);
  });

  it('donor can see the full history of their donation', async () => {
    const res = await donorAgent.get(`/api/donations/${state.donationId}/history`).expect(200);
    // The API returns the newest status change first.
    const statuses = res.body.data.history.map((h) => h.newStatus).reverse();
    assert.deepEqual(statuses, ['AVAILABLE', 'ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED', 'DISTRIBUTED', 'COMPLETED']);
    res.body.data.history.forEach((h) => assert.ok(h.updatedBy || h.previousStatus === null));
  });

  it('volunteers only see their own task history', async () => {
    const mine = await volunteerAgent.get('/api/volunteer/tasks/my').expect(200);
    assert.ok(mine.body.data.tasks.length >= 1);
    const others = await volunteer2Agent.get('/api/volunteer/tasks/my').expect(200);
    assert.equal(others.body.data.tasks.length, 0);
  });
});

describe('7. Donor cancellation rules', () => {
  it('lets the donor cancel a donation that has not been collected', async () => {
    const created = await donorAgent.post('/api/donations').send(validDonation({ foodName: 'Cancellable Meal' })).expect(201);
    const id = created.body.data.donation._id;

    await ngo1Agent.post(`/api/ngo/donations/${id}/accept`).expect(200);
    const res = await donorAgent.patch(`/api/donations/${id}/cancel`).send({ reason: 'Plans changed' }).expect(200);
    assert.equal(res.body.data.donation.status, 'CANCELLED');

    // A cancelled donation can no longer be accepted.
    await ngo2Agent.post(`/api/ngo/donations/${id}/accept`).expect(409);
    // And cannot be cancelled twice.
    await donorAgent.patch(`/api/donations/${id}/cancel`).send({}).expect(400);
  });

  it('prevents another user from cancelling someone else donation', async () => {
    const created = await donorAgent.post('/api/donations').send(validDonation({ foodName: 'Protected Meal' })).expect(201);
    await ngo1Agent.patch(`/api/donations/${created.body.data.donation._id}/cancel`).send({}).expect(403);
    await ngo1Agent.delete(`/api/donations/${created.body.data.donation._id}`).expect(404);
  });
});

describe('8. Administrator area', () => {
  let adminToken;

  it('creates an administrator with the documented script-style flow', async () => {
    // The API never allows ADMIN registration; the test mirrors scripts/createAdmin.js.
    const bcrypt = require('bcryptjs');
    await User.create({
      name: 'Test Admin',
      email: 'admin@test.local',
      passwordHash: await bcrypt.hash('Secret123', 10),
      phone: '9876500009',
      role: 'ADMIN',
      city: 'Pune',
      verificationStatus: 'NOT_REQUIRED',
    });
    const res = await adminAgent.post('/api/auth/login').send({ email: 'admin@test.local', password: 'Secret123' }).expect(200);
    adminToken = res.body.data.token;
  });

  it('blocks non-admins from admin routes', async () => {
    await donorAgent.get('/api/admin/dashboard').expect(403);
    await ngo1Agent.get('/api/admin/users').expect(403);
    await volunteerAgent.get('/api/admin/reports').expect(403);
    await request(app).get('/api/admin/dashboard').expect(401);
  });

  it('returns dashboard statistics that match the database', async () => {
    const res = await adminAgent.get('/api/admin/dashboard').expect(200);
    const s = res.body.data.stats;

    const dbUsers = await User.countDocuments();
    const dbDonations = await Donation.countDocuments();
    const dbNgos = await User.countDocuments({ role: 'NGO' });
    const dbVolunteers = await User.countDocuments({ role: 'VOLUNTEER' });

    assert.equal(s.totalUsers, dbUsers);
    assert.equal(s.totalDonations, dbDonations);
    assert.equal(s.ngos, dbNgos);
    assert.equal(s.volunteers, dbVolunteers);
    assert.equal(
      s.totalDonations,
      Object.values(s.byStatus).reduce((a, b) => a + b, 0)
    );
    assert.equal(res.body.data.charts.donationsByMonth.length, 6);
  });

  it('lists users with filters and pagination', async () => {
    const all = await adminAgent.get('/api/admin/users?limit=100').expect(200);
    assert.equal(all.body.data.users.length, await User.countDocuments());

    const ngos = await adminAgent.get('/api/admin/users?role=NGO').expect(200);
    assert.ok(ngos.body.data.users.every((u) => u.role === 'NGO'));
    assert.ok(ngos.body.data.users.every((u) => u.passwordHash === undefined));

    const page = await adminAgent.get('/api/admin/users?limit=2&page=1').expect(200);
    assert.equal(page.body.data.users.length, 2);
    assert.ok(page.body.data.pagination.pages >= 2);
  });

  it('verifies and rejects NGO registrations', async () => {
    const pendingNgo = await User.findOne({ role: 'NGO', verificationStatus: 'PENDING' });
    assert.ok(pendingNgo, 'a pending NGO should exist');

    const res = await adminAgent
      .patch(`/api/admin/ngos/${pendingNgo._id}/verify`)
      .send({ verificationStatus: 'VERIFIED', note: 'Documents checked' })
      .expect(200);
    assert.equal(res.body.data.user.verificationStatus, 'VERIFIED');

    await adminAgent.patch(`/api/admin/ngos/${pendingNgo._id}/verify`).send({ verificationStatus: 'MAYBE' }).expect(400);
  });

  it('deactivates a user and blocks their login', async () => {
    const target = await User.findOne({ email: 'volunteer2@test.local' });
    const res = await adminAgent.patch(`/api/admin/users/${target._id}/status`).send({ isActive: false }).expect(200);
    assert.equal(res.body.data.user.isActive, false);

    const login = await request(app).post('/api/auth/login').send({ email: 'volunteer2@test.local', password: 'Secret123' }).expect(403);
    assert.match(login.body.message, /deactivated/i);

    // Reactivate so later suites keep a usable account.
    await adminAgent.patch(`/api/admin/users/${target._id}/status`).send({ isActive: true }).expect(200);
  });

  it('cannot deactivate its own account', async () => {
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`).expect(200);
    await adminAgent.patch(`/api/admin/users/${me.body.data.user._id}/status`).send({ isActive: false }).expect(400);
  });

  it('lists all donations with status filters', async () => {
    const res = await adminAgent.get('/api/admin/donations?status=COMPLETED').expect(200);
    assert.ok(res.body.data.donations.every((d) => d.status === 'COMPLETED'));
    assert.ok(res.body.data.donations[0].donorId.name, 'admin sees the donor reference');

    const all = await adminAgent.get('/api/admin/donations?limit=100').expect(200);
    assert.equal(all.body.data.donations.length, await Donation.countDocuments());
  });

  it('rejects an unsuitable donation (REJECTED status)', async () => {
    const created = await donorAgent.post('/api/donations').send(validDonation({ foodName: 'Unsuitable Food' })).expect(201);
    const id = created.body.data.donation._id;

    // Admin status changes go through the same state machine (AVAILABLE -> REJECTED).
    const { transitionDonation } = require('../services/donationStatusService');
    const admin = await User.findOne({ role: 'ADMIN' });
    const updated = await transitionDonation({
      donationId: id,
      fromStatus: 'AVAILABLE',
      toStatus: 'REJECTED',
      user: admin,
      note: 'Rejected by administrator: unsuitable for distribution',
    });
    assert.equal(updated.status, 'REJECTED');

    // Invalid transitions are rejected by the state machine.
    await assert.rejects(
      () =>
        transitionDonation({
          donationId: id,
          fromStatus: 'REJECTED',
          toStatus: 'AVAILABLE',
          user: admin,
          note: 'attempt revert',
        }),
      /Invalid status change/
    );
  });

  it('produces reports calculated from real records', async () => {
    const res = await adminAgent.get('/api/admin/reports').expect(200);
    const summary = res.body.data.summary;
    assert.equal(summary.totalDonations, await Donation.countDocuments());
    assert.equal(summary.completedDonations, await Donation.countDocuments({ status: 'COMPLETED' }));
    assert.equal(summary.cancelledDonations, await Donation.countDocuments({ status: { $in: ['CANCELLED', 'REJECTED'] } }));
    assert.ok(Array.isArray(res.body.data.donationsByCategory));
    assert.equal(res.body.data.usersByMonth.length, 6);
  });
});

describe('9. Dashboards & notifications', () => {
  it('returns donor dashboard data', async () => {
    const res = await donorAgent.get('/api/donations/my?limit=1').expect(200);
    assert.ok(res.body.data.summary.total >= 3);
  });

  it('returns NGO dashboard data', async () => {
    const res = await ngo1Agent.get('/api/ngo/dashboard').expect(200);
    assert.ok(res.body.data.stats.completedDistributions >= 1);
    assert.equal(
      res.body.data.stats.completedDistributions,
      await Donation.countDocuments({ acceptedByNgoId: (await User.findOne({ email: 'ngo1@test.local' }))._id, status: 'COMPLETED' })
    );
    assert.ok(Array.isArray(res.body.data.recentActivities));
  });

  it('returns volunteer dashboard data', async () => {
    const res = await volunteerAgent.get('/api/volunteer/dashboard').expect(200);
    assert.ok(res.body.data.stats.completedDeliveries >= 1);
  });

  it('returns public statistics from the database', async () => {
    const res = await request(app).get('/api/stats/public').expect(200);
    const s = res.body.data.stats;
    assert.equal(s.totalDonations, await Donation.countDocuments());
    assert.equal(s.registeredNgos, await User.countDocuments({ role: 'NGO', isActive: true }));
    assert.equal(typeof s.activeVolunteers, 'number');
  });

  it('delivers notifications to the right users only', async () => {
    const res = await volunteerAgent.get('/api/notifications').expect(200);
    assert.ok(res.body.data.notifications.length >= 1);
    res.body.data.notifications.forEach((n) => assert.ok(n.recipientId));

    // Users only ever receive their own notifications: volunteer 2 was never
    // part of the pickup workflow, so it has no DONATION/PICKUP notifications.
    const foreign = await volunteer2Agent.get('/api/notifications').expect(200);
    assert.ok(
      foreign.body.data.notifications.every((n) => n.type === 'ACCOUNT'),
      'volunteer 2 must only see account-related notifications'
    );
    assert.ok(!foreign.body.data.notifications.some((n) => n.type === 'DONATION' || n.type === 'PICKUP'));
  });

  it('supports logout for every role', async () => {
    await ngo1Agent.post('/api/auth/logout').expect(200);
    await ngo1Agent.get('/api/ngo/dashboard').expect(401);
  });
});
