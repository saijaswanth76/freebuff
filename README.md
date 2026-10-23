# Community Food Donation and Distribution System

A full-stack web platform that reduces food wastage by connecting people and organizations
with surplus food to NGOs and volunteers who collect and distribute it to people in need.

Built as a B.Tech Computer Science Engineering **Community Service Project (CSP)**.

**Core workflow:**
Food Donor → Donation Registration → Verification → NGO Acceptance → Volunteer Assignment →
Food Pickup → Distribution → Status Updates → Completion

---

## 1. Technology Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18 + Vite, JavaScript, Tailwind CSS, React Router DOM, Axios, Recharts, Lucide React |
| Backend   | Node.js + Express (REST API), JWT auth (httpOnly cookies + Bearer), bcryptjs, express-validator, express-rate-limit, Multer |
| Database  | MongoDB + Mongoose ODM (falls back to a temporary **in-memory MongoDB** when `MONGODB_URI` is empty — ideal for demos without installing MongoDB) |
| Testing   | Node.js built-in test runner (65 API tests) + an end-to-end smoke script (29 live checks) |

Everything is free and open-source. No paid services are used.

---

## 2. Project Structure

```
.
├── client/                     # React frontend (Vite)
│   ├── index.html
│   ├── vite.config.js          # dev proxy: /api and /uploads -> http://localhost:5000
│   ├── .env.example
│   └── src/
│       ├── main.jsx            # entry point
│       ├── App.jsx             # all routes for the four roles
│       ├── index.css           # design system (Tailwind + theme tokens)
│       ├── components/         # Navbar, Footer, cards, badges, dialogs, tables…
│       ├── contexts/           # AuthContext, ToastContext
│       ├── layouts/            # PublicLayout, DashboardLayout (sidebar shell)
│       ├── pages/
│       │   ├── Home.jsx  About.jsx  HowItWorks.jsx
│       │   ├── AvailableDonations.jsx  DonationDetail.jsx
│       │   ├── Login.jsx  Register.jsx
│       │   ├── donor/          # dashboard, add/edit donation, list, history
│       │   ├── ngo/            # dashboard, browse, accepted, history
│       │   ├── volunteer/      # dashboard, open tasks, my tasks
│       │   └── admin/          # dashboard, users, donations, reports & charts
│       ├── services/api.js     # Axios instance + typed API helpers
│       └── utils/
│
└── server/                     # Express backend
    ├── server.js               # app wiring, static /uploads, DB connect, auto-seed
    ├── .env.example
    ├── config/db.js            # Mongoose connect (or in-memory MongoDB)
    ├── middleware/             # auth (JWT), authorize, validate, upload, errorHandler
    ├── models/                 # User, Donation, Pickup, DonationHistory, Notification
    ├── controllers/            # auth, donations, ngo, volunteer, admin
    ├── routes/                 # /api/auth, /api/donations, /api/ngo, /api/volunteer, /api/admin
    ├── utils/statusFlow.js     # single source of truth for the status state machine
    ├── scripts/
    │   ├── seed.js             # demo data (npm run seed; server auto-seeds in-memory DB)
    │   ├── createAdmin.js      # secure admin creation (npm run create-admin)
    │   └── e2e-smoke.js        # 29-check live end-to-end workflow test
    ├── uploads/                # uploaded food images (served statically)
    └── tests/                  # 65 automated API tests
```

---

## 3. Getting Started

### Prerequisites
- **Node.js 18+**
- MongoDB (optional — see the in-memory note below)

### 1) Backend

```bash
cd server
npm install
copy .env.example .env       # Windows   (cp .env.example .env on macOS/Linux)
npm start                    # http://localhost:5000
```

Useful scripts:

```bash
npm run dev          # auto-restart on changes (node --watch)
npm run seed         # load demo users + donations into MongoDB
npm run create-admin # create/reuse the administrator account (interactive)
npm test             # 65 automated API tests
node scripts/e2e-smoke.js http://localhost:5173   # 29 live end-to-end checks
```

**No MongoDB?** Leave `MONGODB_URI=` empty in `server/.env`. The server starts a
temporary in-memory MongoDB, **auto-seeds** the demo data and runs the whole application.
All data is lost when the server stops — perfect for presentations.

### 2) Frontend

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

The Vite dev server proxies `/api` and `/uploads` to `http://localhost:5000`, so the
browser talks to a single origin and httpOnly auth cookies work out of the box.

### 3) Production build

```bash
cd client && npm run build     # static files in client/dist
cd server && npm start         # serves the API; mount client/dist behind a reverse proxy
```

---

## 4. Environment Configuration

### `server/.env`

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | API port | `5000` |
| `MONGODB_URI` | MongoDB connection string. **Empty = in-memory DB (dev/demo)** | empty |
| `JWT_SECRET` | Secret for signing JWTs — use a long random string | — |
| `JWT_EXPIRES_IN` | Session lifetime | `1d` |
| `JWT_COOKIE_NAME` | Name of the httpOnly cookie | `cfds_token` |
| `CLIENT_ORIGINS` | CORS allow-list (comma separated) | `http://localhost:5173,...` |
| `NGO_REQUIRE_VERIFICATION` | Require admin verification before an NGO can accept | `false` |
| `API_RATE_LIMIT` | Global API limit per 15 min | `600` |
| `MAX_UPLOAD_SIZE_BYTES` | Max food-image upload size | `2097152` (2 MB) |
| `NODE_ENV` | `development` / `production` / `test` | `development` |

### `client/.env`

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Empty = use the Vite proxy (recommended). Set an absolute URL to call the API on another origin (then add the frontend to `CLIENT_ORIGINS`). |

---

## 5. Demo Accounts

The seed data creates these accounts — **password for all: `Demo@123`**
(`npm run seed`, or automatically at first start when using the in-memory DB):

| Role | Email |
|------|-------|
| Administrator | `admin@cfds.local` |
| Donor (household) | `donor@cfds.local` |
| Donor (restaurant) | `restaurant@cfds.local` |
| NGO (verified) | `ngo@cfds.local` |
| NGO (verified) | `ngo2@cfds.local` |
| Volunteer | `volunteer@cfds.local` |
| Volunteer | `volunteer2@cfds.local` |

### Creating the administrator securely

There is **no public admin registration page**. Create the admin account with:

```bash
cd server
npm run create-admin     # prompts for name, email, password (or pass CLI arguments)
```

The script refuses weak passwords, never prints the password, and is safe to re-run
(it reuses the existing admin account). See `server/scripts/createAdmin.js`.

---

## 6. Implemented Features

### Food Donor
- Register/login, choose a donor category (Household, Restaurant, Hotel, Hostel, College Canteen, Event Organizer, Catering Service, Other)
- Personal dashboard with live counters and recent activity
- Create donations: food name/description, category, quantity + unit, preparation/availability times, **safe-consumption deadline**, pickup address/city, contact details, optional image upload (Multer)
- Food-safety notice on the donation form; expired donations are never eligible for acceptance
- Edit donations not yet accepted; cancel eligible donations; full donation history

### NGO
- Register (organization name, address, phone, description) — new NGOs start `PENDING`
- Browse available donations; search by text; filter by category, city, quantity and deadline
- Accept an available donation — **concurrency-safe**: a second NGO gets `409 Conflict`
- View accepted donations, request/release a volunteer, track pickup and distribution status
- Confirm distribution (moves the donation to `COMPLETED`)
- Completed donation history

### Volunteer
- Register with contact details and location
- View open pickup tasks and full pickup/delivery details
- Accept an eligible task, confirm collection, confirm delivery, add delivery notes
- "My tasks" list — volunteers cannot see or touch tasks assigned to other volunteers
- Completed task history

### Administrator
- Protected dashboard: total users, donors, NGOs, volunteers, donations, and status counters (pending / accepted / collected / distributed / completed / cancelled) — **all computed from database records**
- User management: activate/deactivate accounts, verify or reject NGO registrations
- Donation monitoring with status filters and per-donation audit trail
- Reports page with charts (Recharts): donations by status, by category, per-month trend, user registrations per month
- Recent platform activity

### Platform
- JWT auth in **httpOnly cookies** (Bearer tokens also accepted for API tools like Postman)
- Role-based authorization middleware enforced on **every** protected route (backend is the authority)
- Donation status state machine with server-side validation of every transition
- Immutable `DonationHistory` audit trail for every status change
- In-app notifications (list, mark read, mark all read)
- Public stats endpoint (real counts, no fabricated numbers)
- Rate limiting on auth routes, request validation with express-validator, centralized error handler
- Responsive UI, empty states, loading spinners, toasts, confirmation dialogs, status badges

---

## 7. Testing

```bash
cd server
npm test                            # 65 automated API tests (auth, CRUD, workflow, authz)
node scripts/e2e-smoke.js http://localhost:5173   # 29 live end-to-end checks
```

The smoke script drives the **complete acceptance workflow** with real HTTP requests
through the Vite proxy (exactly what the browser does):

1. Donor logs in and creates a donation → appears in the public list (donor contact hidden)
2. NGO 1 accepts; NGO 2 is rejected with `409`
3. Volunteer accepts the pickup, confirms collection, confirms delivery
4. NGO confirms distribution → donation reaches `COMPLETED`; double-confirm rejected
5. Donor sees `COMPLETED`; audit trail is complete
6. Admin counters match the database; admin can open the donation history
7. Authorization matrix: anonymous/donor/volunteer against admin & NGO routes → `401/403`;
   wrong password rejected; ADMIN self-registration rejected

**Latest results: 65/65 unit tests pass, 29/29 live end-to-end checks pass.**

Manual browser checks performed: Home (live stats), Login → Donor dashboard,
Admin dashboard with Recharts, responsive navigation — no console errors.

---

## 8. API & Database Documentation

- REST API reference: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- Schema design & relationships: [DATABASE_DESIGN.md](DATABASE_DESIGN.md)

---

## 9. Optional / Future Enhancements

Not required for the demo, but natural next steps:

- Email/SMS notifications with Nodemailer (the `Notification` model already stores everything needed)
- Maps/geolocation for nearby NGO–volunteer matching
- Image resizing/optimization and cloud storage for uploads
- Refresh tokens and per-device session management
- E2E browser tests (Playwright) automating the smoke workflow
- Docker Compose for one-command setup with real MongoDB

## 10. Known Limitations

- With an empty `MONGODB_URI`, data lives in memory and is lost on server restart (by design — the seed data is re-created automatically).
- Food images are stored on local disk (`server/uploads/`); use a real filesystem/volume in production.
- Notifications are in-app only (no email delivery yet).
