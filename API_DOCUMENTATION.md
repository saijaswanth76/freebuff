# API Documentation — Community Food Donation and Distribution System

Base URL (development): `http://localhost:5000/api`
The React dev server proxies `/api` and `/uploads` to this address, so browser calls
use the same origin (httpOnly cookies work without CORS configuration).

---

## 1. Conventions

### Response envelope

Every endpoint returns the same JSON shape:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": { ... }
}
```

Errors:

```json
{
  "success": false,
  "message": "What went wrong",
  "errors": { "field": ["Validation message"] }
}
```

HTTP status codes: `200` OK · `201` Created · `400` validation/invalid transition ·
`401` not authenticated · `403` not authorized · `404` not found ·
`409` conflict (e.g. donation already accepted) · `429` rate limited.

### Authentication

- Login sets an **httpOnly cookie** (`cfds_token` by default) — the browser sends it automatically.
- For API tools (Postman, curl) you can instead send `Authorization: Bearer <token>`.
- Public list/detail endpoints use *optional* auth: admins see more (e.g. expired donations).

### Roles

`DONOR`, `NGO`, `VOLUNTEER`, `ADMIN`. Every protected route enforces its role on the
**backend** (`protect` + `authorize` middleware). The admin role cannot be self-registered.

### Reference data

`GET /api/meta` returns all enums used by the forms/filters:
food categories, units, classifications, donor categories, donation/pickup statuses,
and the allowed registration roles.

`GET /api/stats/public` returns landing-page statistics **counted from the database**
(total donations, completed, NGOs, active volunteers) — never fabricated.

---

## 2. Status Lifecycle

Donation status state machine (server-validated; illegal transitions are rejected):

```
AVAILABLE → ACCEPTED → PICKUP_ASSIGNED → COLLECTED → DISTRIBUTED → COMPLETED
     ↘ CANCELLED / REJECTED (donor cancel or admin reject)
```

Pickup status: `OPEN → ASSIGNED → COLLECTED → DELIVERED → CONFIRMED` (or `CANCELLED`).

Rules enforced server-side:
- Only `AVAILABLE` donations **whose safe-consumption deadline has not passed** are eligible for acceptance.
- A donation can be accepted by **one NGO only** — a second attempt returns `409 Conflict`.
- `COMPLETED`, `CANCELLED`, `REJECTED` are terminal states.

---

## 3. Authentication — `/api/auth`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/register` | Public | Register a DONOR / NGO / VOLUNTEER account |
| POST | `/login` | Public | Sign in (rate limited) |
| POST | `/logout` | Any | Clear the session cookie |
| GET | `/me` | Logged in | Current user profile |

**POST /register** body:
`name` (2–100), `email`, `password` (strong password required), `phone`,
`role` (`DONOR` | `NGO` | `VOLUNTEER` — **not** `ADMIN`), `city`, optional `address`,
`organizationName`, `organizationDescription`, `donorCategory`
(Household, Restaurant, Hotel, Hostel, College Canteen, Event Organizer, Catering Service, Other),
`terms: true`.

NGO accounts are created with `verificationStatus: PENDING` (set to `VERIFIED` by an admin).
Set `NGO_REQUIRE_VERIFICATION=true` to block PENDING NGOs from accepting donations.

**POST /login** body: `email`, `password`. Returns the user profile; sets the session cookie.
Wrong email and wrong password return the same generic `401` message.

---

## 4. Donations — `/api/donations`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/` | Public (optional auth) | List donations (anonymous = only AVAILABLE & not expired) |
| GET | `/my` | DONOR | The logged-in donor's donations |
| GET | `/:id` | Public (optional auth) | Donation details |
| GET | `/:id/history` | Logged in (owner/NGO/volunteer/admin) | Full audit trail |
| POST | `/` | DONOR | Create a donation (multipart: optional `image` + fields) |
| PUT | `/:id` | DONOR (owner, only before acceptance) | Edit a donation |
| PATCH | `/:id/cancel` | DONOR (owner, eligible states) | Cancel a donation |

**GET / query parameters** (shared by the public page, NGO browse and admin table):

| Param | Meaning |
|-------|---------|
| `status` | Filter by donation status (admins only see arbitrary statuses) |
| `category` | Exact food category (Cooked Meals, Fruits, Vegetables, Bakery Products, Packaged Food, Rice and Grains, Other) |
| `city` / `cityPartial` | Exact / partial city match (case-insensitive) |
| `classification` | `VEG`, `NON_VEG`, `BOTH` |
| `minQuantity`, `maxQuantity` | Quantity range |
| `deadlineBefore` | ISO date — deadline must be before this |
| `search` | Free text over food name, description, city, category |
| `sort` | `newest`, `oldest`, `deadline`, `deadline-desc`, `quantity`, `name` |
| `page`, `limit` | Pagination (returns `pagination: { page, limit, total, pages }`) |

**POST / body** (validation in parentheses):
`foodName` (≤120, required), `category` (enum, required), `description` (≤2000),
`quantity` (>0, required), `unit` (Servings, Kg, Plates, Packs, Boxes, Litres, Dozen),
`foodClassification` (VEG/NON_VEG/BOTH), `preparationDate`, `availableFrom`,
`safeConsumptionDeadline` (ISO date, **required**),
`pickupAddress`, `city`, `contactName`, `contactPhone`, optional `locationDescription`,
`storageInformation`, `additionalNotes`, optional `image` (file ≤ 2 MB).

Public list responses **never expose** donor identity/contact details.

---

## 5. NGO — `/api/ngo` (role: NGO)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | NGO counters + recent activity |
| GET | `/donations` | Browse **available** donations (same filter params as `/api/donations`) |
| GET | `/accepted-donations` | Donations accepted by this NGO |
| POST | `/donations/:id/accept` | Accept an available, non-expired donation (`409` if taken) |
| POST | `/donations/:id/request-volunteer` | Create/find the pickup task and optionally assign a specific volunteer |
| PATCH | `/donations/:id/release-volunteer` | Release the assigned volunteer (task back to OPEN) |
| PATCH | `/donations/:id/confirm-distribution` | Confirm distribution — donation becomes `COMPLETED` |

`request-volunteer` body (all optional): `volunteerId` (Mongo id),
`scheduledPickupTime` (ISO), `notes` (≤1000).
`confirm-distribution` body (optional): `distributionNote` (≤500).

---

## 6. Volunteer — `/api/volunteer` (role: VOLUNTEER)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Volunteer counters + recent activity |
| GET | `/tasks` | Open pickup tasks (status OPEN) |
| GET | `/tasks/my` | Tasks assigned to this volunteer |
| GET | `/tasks/:id` | Task details (owner only) |
| POST | `/tasks/:id/accept` | Accept an open task → pickup `ASSIGNED`, donation `PICKUP_ASSIGNED` |
| PATCH | `/tasks/:id/collect` | Confirm collection (`notes` ≤1000) → donation `COLLECTED` |
| PATCH | `/tasks/:id/deliver` | Confirm delivery (`deliveryNotes` ≤1000) → donation `DISTRIBUTED` |

Volunteers cannot read or modify tasks assigned to another volunteer (`403`).

---

## 7. Admin — `/api/admin` (role: ADMIN)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | User/donation counters and recent activity (all DB-derived) |
| GET | `/users` | Registered users (filters: `role`, `search`, `status`, pagination) |
| GET | `/donations` | All donations (filters incl. `includeExpired=true`) |
| GET | `/reports` | Report aggregates for the charts (by status/category, per-month series) |
| PATCH | `/users/:id/status` | Body `{ isActive: true|false }` — activate/deactivate an account |
| PATCH | `/ngos/:id/verify` | Body `{ verificationStatus: "VERIFIED"\|"REJECTED", note? }` |

---

## 8. Notifications — `/api`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/notifications` | Logged in | List the user's notifications |
| PATCH | `/notifications/:id/read` | Logged in | Mark one as read |
| PATCH | `/notifications/read-all` | Logged in | Mark all as read |

Notifications are created automatically when a donation is accepted, a volunteer is
assigned/collected/delivered, distribution is confirmed, an NGO is verified, etc.

---

## 9. System — `/api`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/health` | Public | `{ success, data: { uptime } }` |
| GET | `/meta` | Public | Enum/reference data for forms |
| GET | `/stats/public` | Public | Landing-page statistics (real DB counts) |

---

## 10. Example requests (curl)

```bash
# Login (cookie jar)
curl -s -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"donor@cfds.local","password":"Demo@123"}' \
  http://localhost:5000/api/auth/login

# Create a donation with the cookie
curl -s -b cookies.txt -H "Content-Type: application/json" \
  -d '{"foodName":"Veg Pulao","category":"Cooked Meals","quantity":40,"unit":"Servings",
       "safeConsumptionDeadline":"2027-01-01T18:00:00.000Z",
       "pickupAddress":"12 MG Road","city":"Pune",
       "contactName":"Ravi","contactPhone":"9876543210"}' \
  http://localhost:5000/api/donations

# Bearer-token style (Postman friendly)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/donations/my

# NGO accepts (409 if another NGO already accepted)
curl -s -b ngo-cookies.txt -X POST http://localhost:5000/api/ngo/donations/<ID>/accept
```

Rate limits: auth routes are limited (per 15 min); a global API limit defaults to
600 requests/15 min (`API_RATE_LIMIT`).
