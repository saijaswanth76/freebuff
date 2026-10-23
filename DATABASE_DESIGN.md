# Database Design — Community Food Donation and Distribution System

Database: **MongoDB** (document store) accessed through **Mongoose ODM**.
If `MONGODB_URI` is empty the server boots a temporary in-memory MongoDB for
development/demos — the same schemas and queries are used unchanged.

---

## 1. Entity Relationship Overview

```
User (DONOR) 1 ──── * Donation * ──── 1 User (NGO)
                      │  │
                      │  └─────── * ──── 1 User (VOLUNTEER)   (assignedVolunteerId)
                      │
                      ├──── 1 Pickup (1 active per donation)
                      │        └── volunteerId → User (VOLUNTEER)
                      │
                      └──── * DonationHistory  (immutable audit trail)

User 1 ──── * Notification   (per-recipient in-app notifications)
```

Five collections (Mongoose models):

| Model | File | Purpose |
|-------|------|---------|
| `User` | `server/models/User.js` | All four roles in one collection, discriminated by `role` |
| `Donation` | `server/models/Donation.js` | A surplus-food listing and its lifecycle state |
| `Pickup` | `server/models/Pickup.js` | Pickup/delivery task linking a donation, NGO and volunteer |
| `DonationHistory` | `server/models/DonationHistory.js` | Append-only audit trail of every status change |
| `Notification` | `server/models/Notification.js` | In-app notifications per user |

---

## 2. Collections

### 2.1 `users`

One collection for every role; `role` selects which optional profile fields matter.

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | 2–100 chars |
| `email` | String | unique, lowercase, indexed |
| `passwordHash` | String | bcrypt, **`select: false`**, stripped in `toJSON` |
| `phone` | String | validated pattern |
| `role` | String enum | `DONOR`, `NGO`, `VOLUNTEER`, `ADMIN` |
| `address` | String | optional |
| `city` | String | required, indexed with role |
| `organizationName` | String | NGO profile |
| `organizationDescription` | String | NGO profile |
| `verificationStatus` | String enum | `NOT_REQUIRED`, `PENDING`, `VERIFIED`, `REJECTED` — NGOs start `PENDING` |
| `verificationNote` | String | admin's note when verifying/rejecting |
| `donorCategory` | String enum | Household, Restaurant, Hotel, Hostel, College Canteen, Event Organizer, Catering Service, Other |
| `isActive` | Boolean | admin can deactivate an account (login and access blocked) |
| `createdAt` / `updatedAt` | Date | Mongoose timestamps |

Indexes: `{ email: 1 }` (unique), `{ city: 1, role: 1 }`, `{ role: 1, isActive: 1 }`.

### 2.2 `donations`

| Field | Type | Notes |
|-------|------|-------|
| `foodName` | String | ≤120 |
| `category` | String enum | Cooked Meals, Fruits, Vegetables, Bakery Products, Packaged Food, Rice and Grains, Other |
| `description` | String | ≤2000 |
| `quantity` | Number | >0 |
| `unit` | String enum | Servings, Kg, Plates, Packs, Boxes, Litres, Dozen |
| `foodClassification` | String enum | `VEG`, `NON_VEG`, `BOTH` |
| `preparationDate` | Date | when the food was prepared |
| `availableFrom` | Date | when pickup can start |
| `safeConsumptionDeadline` | Date | **required** — expired donations are never eligible for acceptance |
| `pickupAddress`, `city` | String | required pickup location |
| `locationDescription` | String | landmarks etc. |
| `storageInformation` | String | how the food is stored |
| `additionalNotes` | String | free text |
| `contactName`, `contactPhone` | String | required contact details |
| `imageUrl` | String | Multer upload path (optional) |
| `donorId` | ObjectId → User | required, indexed |
| `acceptedByNgoId` | ObjectId → User | set on acceptance; guarantees single-NGO acceptance |
| `assignedVolunteerId` | ObjectId → User | set when a volunteer takes the task |
| `status` | String enum | see lifecycle below; default `AVAILABLE` |
| `statusUpdatedAt` | Date | last transition time |
| `statusUpdatedBy` | ObjectId → User | who made the last transition |

Notes recorded during the flow (NGO distribution note, cancellation reason) are stored
on the `Pickup` task and in the `DonationHistory` entry, keeping the donation document lean.

Status lifecycle (`server/utils/statusFlow.js` — single source of truth, validated on
every transition):

```
AVAILABLE → ACCEPTED → PICKUP_ASSIGNED → COLLECTED → DISTRIBUTED → COMPLETED
     ↘ CANCELLED / REJECTED
```

`COMPLETED`, `CANCELLED`, `REJECTED` are terminal. Acceptance eligibility =
`status === AVAILABLE` **and** `safeConsumptionDeadline >= now`.

Indexes: `{ status: 1, safeConsumptionDeadline: 1 }`, `{ city: 1, category: 1 }`,
`{ donorId: 1, createdAt: -1 }` and a text index on `foodName / description / city`
for free-text search.

Concurrency safety: every status change goes through `services/donationStatusService.js`,
which performs an atomic conditional update (`findOneAndUpdate` with the *expected current
status* in the filter). If another NGO got there first, the update matches nothing and the
request receives `409 Conflict` — two NGOs can never accept the same donation.

### 2.3 `pickups`

One **active** pickup task per donation (`isActive: true`); released volunteers
return the task to `OPEN`.

| Field | Type | Notes |
|-------|------|-------|
| `donationId` | ObjectId → Donation | required, indexed |
| `ngoId` | ObjectId → User | the accepting NGO |
| `volunteerId` | ObjectId → User | nullable until a volunteer accepts |
| `pickupAddress`, `deliveryAddress` | String | copied from the donation / NGO profile |
| `scheduledPickupTime` | Date | optional |
| `assignmentDate` | Date | default now |
| `status` | String enum | `OPEN`, `ASSIGNED`, `COLLECTED`, `DELIVERED`, `CONFIRMED`, `CANCELLED` |
| `collectedAt`, `deliveredAt`, `confirmedAt` | Date | event timestamps |
| `notes` | String | volunteer's collection notes |
| `deliveryNotes` | String | volunteer's delivery notes |
| `isActive` | Boolean | one active task per donation |

Index: **unique partial** on `{ donationId: 1 }` with `isActive: true` — the database
itself guarantees at most one active pickup task per donation.

The pickup status mirrors the donation status (collect → `COLLECTED` on both,
deliver → donation `DISTRIBUTED`, NGO confirm → pickup `CONFIRMED` + donation `COMPLETED`).

### 2.4 `donationhistories`

Append-only audit trail — rows are **never updated or deleted**.

| Field | Type | Notes |
|-------|------|-------|
| `donationId` | ObjectId → Donation | required, indexed |
| `previousStatus` | String | null for the first entry |
| `newStatus` | String | required |
| `updatedBy` | ObjectId → User | who performed the transition |
| `updatedByRole` | String | snapshot for easy filtering |
| `note` | String | optional context (delivery notes, admin reason…) |
| `timestamp` | Date | default now |

Index: `{ donationId: 1, timestamp: -1 }`.
The donor, NGO and admin detail pages all render this trail, so every status change
is fully traceable — key for the platform's accountability goal.

### 2.5 `notifications`

| Field | Type | Notes |
|-------|------|-------|
| `recipientId` | ObjectId → User | recipient, indexed |
| `title` | String | ≤120 |
| `message` | String | ≤500 |
| `type` | String enum | `INFO`, `SUCCESS`, `WARNING`, `DONATION`, `PICKUP`, `ACCOUNT` |
| `relatedDonationId` | ObjectId → Donation | nullable deep link |
| `isRead` | Boolean | default false, indexed |

Indexes: `{ recipientId: 1 }`, `{ isRead: 1 }`, `{ recipientId: 1, createdAt: -1 }`.

---

## 3. Design Decisions

1. **Single `users` collection** — the four roles share authentication/profile fields;
   role-specific data lives in optional fields. Simple for a student project, and
   querying "all NGOs in Pune" is one indexed query.
2. **Status as data, transitions as code** — the state machine lives in
   `utils/statusFlow.js`; controllers validate every transition against it, so an
   illegal jump (e.g. `COMPLETED → AVAILABLE`) is impossible regardless of the caller.
3. **Immutable audit trail** — `donationhistories` is insert-only; the current state
   lives on the donation, the story lives in the trail.
4. **Atomic transitions** — the shared `transitionDonation` service uses conditional
   `findOneAndUpdate` on the expected current status, preventing the classic
   double-accept race without distributed locks.
5. **Denormalized pickup copy** — pickup/delivery addresses are copied onto the task
   so the volunteer sees exactly what the donor registered even if the listing changes.
6. **DB-level task uniqueness** — the partial unique index on `pickups { donationId, isActive: true }`
   means even a bug in application code cannot create two active tasks for one donation.
7. **Security by default** — `passwordHash` is `select: false`, stripped from JSON
   output, and never returned by any endpoint.
