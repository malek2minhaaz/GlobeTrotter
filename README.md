# 🌍 GlobeTrotter

**Plan Your Journey. Experience More.**

GlobeTrotter is a personalised, interactive travel-planning platform. It turns a rough idea into a
real itinerary: multi-city routes with their own dates, a day-by-day schedule of activities, a live
cost breakdown by category, and a public share link anyone can view or copy.

It is a full-stack application — React + TypeScript on the front end, an Express REST API and a
normalised PostgreSQL database via Prisma on the back end — with authentication, validation, seed
data, error handling and responsive design implemented end to end.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database setup & seeding](#database-setup--seeding)
- [Run commands](#run-commands)
- [Demo credentials](#demo-credentials)
- [API documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Feature checklist](#feature-checklist)
- [Future improvements](#future-improvements)

---

## Features

### Trips

- Create a trip through a **five-step wizard**: details → destinations → itinerary → budget → review.
- **Multi-city routes** — each city is a *stay* with its own arrive/leave dates, automatically
  re-clamped when the trip dates move so a route can never become invalid.
- Grid and list views with **search, status/visibility filters, five sort orders and pagination**.
- A trip **workspace** with four sections: overview, itinerary, budget and calendar, all reading the
  same data so they can never disagree.
- **Delete with confirmation**, showing exactly what will be removed.

### Itinerary

- **Three-pane builder**: cities and dates on the left, the selected day in the centre, activity
  search on the right (collapsible into sheets on mobile).
- **Drag-and-drop reordering** of activities, with `dnd-kit` keyboard sensors and explicit
  Move earlier / Move later buttons for pointer-free operation.
- **Activity search with filters** — category, cost band and duration — scoped to the selected city.
- **Smart scheduling**: the builder places a new activity after everything already planned that day,
  so its default times never create the overlap it would then warn about.
- **Conflict detection** for overlapping activities, activities outside the trip window and
  activities outside a city stay. Overlaps are refused with a clear explanation and can be accepted
  deliberately ("Add anyway") — that resolution path is shared by the builder and the calendar.

### Budget

- Total estimated cost, split into **five categories** (transport, accommodation, activities, meals,
  miscellaneous).
- Pie chart of the category split, stacked bar chart of cost per day, and per-category progress.
- Statistics: average per day, average on spending days, highest and cheapest day.
- A **manual expense log** with full add / edit / delete.
- An optional **budget limit** with a progress bar and an explicit over-budget warning.

### Calendar

- **Month, week, day and timeline** views.
- Drag an activity onto another day to reschedule it, or onto another activity to change the order —
  both go to the API as a single reorder call, so a move can never half-apply.
- Clicking any entry opens the full editor: time, date, notes and a custom cost.

### Discovery

- Public **city discovery** with search across names, countries and regions, plus country, region,
  cost-band and popularity filters and five sort orders.
- **City detail page** with a hero, description, cost index, popularity, an estimated daily spend and
  the full activity catalogue with its own filters.
- **Bookmark destinations** and add a city to any trip from a card, the detail page or the saved
  list — the suggested stay starts after your last one.

### Sharing

- One toggle to publish a trip, with a generated URL-safe slug.
- A **public itinerary page** that needs no account: hero, dates, cities, day-by-day plan, cost
  summary. It shows the owner by name and avatar only — never an email address.
- **Copy This Trip** clones the whole itinerary, cities and activities into the signed-in
  traveller's account as a private trip, leaving the original untouched.
- Web Share API where available, with clipboard fallback.

### Platform

- Email/password **auth with JWT in an httpOnly cookie**, bcrypt hashing, "remember me",
  forgot/reset password, password change.
- **Protected and admin routes**, enforced on both the client and the server.
- **Light/dark/system theme** persisted locally and on the profile.
- **In-app notifications** derived from your own data (trip starting soon, budget exceeded,
  itinerary conflicts).
- **Admin analytics**: platform totals, trips created over time, registration trends, most popular
  destinations and most-planned activities.
- Loading skeletons, empty states, friendly error states, a travel-themed 404 and toasts for every
  mutation.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7 |
| UI | shadcn-style primitives built on Radix UI, Lucide icons, Framer Motion, Sonner toasts |
| Data | TanStack Query 5 (server state), React Hook Form + Zod (forms) |
| Charts | Recharts |
| Drag & drop | dnd-kit |
| Dates | date-fns |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Auth | JWT (httpOnly cookie), bcryptjs |
| Validation | Zod, shared shape between client and server |
| Tests | Vitest + Supertest (backend integration), plus a scripted end-to-end smoke test |

Two notable choices: the app ships **no component-library dependency** — the shadcn-style primitives
are written into the repo so there is no CLI step to run — and **image storage is optional**, with a
deterministic gradient fallback so the UI looks deliberate with no provider configured.

---

## Architecture

```
globetrotter/
├── client/                     # React SPA
│   └── src/
│       ├── components/
│       │   ├── activity/       # ActivityCard, ActivityPicker
│       │   ├── auth/           # password field + strength meter, route guards
│       │   ├── city/           # CityCard, CityTile, SaveCityButton, CitySearchPicker
│       │   ├── common/         # SearchInput, FilterChips, Skeletons, ImagePicker, …
│       │   ├── layout/         # sidebar nav, notification bell, user menu
│       │   ├── trip/           # TripCard, ShareTripDialog, ReadOnlyItinerary,
│       │   │                   #   itinerary/ (builder panes), budget/, calendar/
│       │   └── ui/             # design-system primitives (button, card, dialog, …)
│       ├── contexts/           # AuthContext, ThemeContext
│       ├── hooks/              # useUrlFilters, useDebouncedValue, useTripMutations, …
│       ├── layouts/            # AppShell, PublicLayout, AuthLayout, TripWorkspaceLayout
│       ├── lib/                # api client, query client, formatting, schemas, calendar maths
│       ├── pages/              # one module per route (lazy-loaded)
│       ├── services/           # typed API modules: auth, trips, discovery, workspace
│       └── types/              # API contract types
├── server/                     # Express API
│   └── src/
│       ├── config/             # env parsing, constants
│       ├── controllers/        # thin HTTP layer
│       ├── middleware/         # auth, validation, error handling, rate limiting
│       ├── routes/             # one router per resource
│       ├── services/           # business logic (the layer worth testing)
│       ├── test/               # test database lifecycle + fixtures
│       ├── tests/              # integration suites
│       ├── utils/              # serializers, dates, money, slugs, jwt, estimate
│       ├── validators/         # Zod schemas
│       ├── app.ts              # Express wiring
│       └── server.ts           # entry point
├── prisma/
│   ├── schema.prisma           # data model
│   ├── migrations/             # SQL migrations
│   └── seed.ts                 # cities, activities, demo users, trips, expenses
└── scripts/
    ├── dev-database.ts         # zero-setup local PostgreSQL (no Docker needed)
    └── smoke-test.ts           # end-to-end API verification against a running server
```

### Design decisions worth knowing

- **Layered backend.** Controllers only translate HTTP; services hold the rules; validators define
  the contract; serializers define the response shape. Every service function that touches a trip
  starts by proving the caller owns it.
- **One response envelope.** Success is `{ data }` (or `{ data, meta }` for lists) and failure is
  `{ error: { message, code, details } }`. The client's `ApiError` unwraps both once, so no component
  ever inspects an HTTP response.
- **Money and dates are normalised at the boundary.** Prisma `Decimal` never reaches the client —
  costs are numbers — and dates are `YYYY-MM-DD` strings, so no timezone can shift a day.
- **Filters live in the URL.** A filtered search is shareable and the back button undoes a filter
  change. `useUrlFilters` also serialises the defaults, so an inline default object cannot cause an
  accidental refetch loop.
- **The API does the arithmetic.** Totals, category splits, per-day series and day statistics are
  computed server-side, so the overview, budget page and public page cannot disagree.
- **Optimistic reordering.** Drag-and-drop writes to the cache immediately and rolls back on failure.

---

## Database schema

Normalised, with foreign keys, unique constraints, indexes and explicit cascade rules.

| Model | Purpose | Key fields |
| --- | --- | --- |
| `User` | Account | `name`, `email` (unique), `passwordHash`, `avatar`, `language`, `currency`, `role`, preferences |
| `PasswordResetToken` | Reset flow | `tokenHash` (unique), `expiresAt`, `usedAt` |
| `City` | Destination catalogue | `name`, `country`, `region`, `description`, `image`, `costIndex`, `popularity`, `latitude`, `longitude` |
| `Activity` | Things to do | `cityId`, `name`, `description`, `category`, `image`, `duration`, `estimatedCost`, `latitude`, `longitude`, `popularity` |
| `Trip` | A journey | `userId`, `name`, `description`, `coverImage`, `startDate`, `endDate`, `isPublic`, `publicSlug` (unique), `budgetLimit`, `viewCount`, `sourceTripId` |
| `TripStop` | A city stay inside a trip | `tripId`, `cityId`, `startDate`, `endDate`, `order` — unique on `(tripId, cityId)` |
| `ItineraryItem` | A scheduled entry | `tripId`, `tripStopId`, `activityId`, `title`, `category`, `date`, `startTime`, `endTime`, `notes`, `order`, `customCost` |
| `Expense` | Logged spending | `tripId`, `category`, `amount`, `description`, `date` |
| `SavedDestination` | Bookmark | `userId`, `cityId` — unique on `(userId, cityId)` |

**Cascade rules.** Deleting a user removes their trips, expenses, bookmarks and reset tokens.
Deleting a trip removes its stops, itinerary items and expenses. Deleting a stop removes the
activities scheduled at it. Deleting a *city or activity* from the catalogue is restricted while
anything references it, so a trip cannot be silently damaged.

**Indexes.** Added on the columns the list endpoints filter and sort by — `Trip(userId, startDate)`,
`Trip(publicSlug)`, `TripStop(tripId, order)`, `ItineraryItem(tripId, date, order)`,
`Expense(tripId, date)`, `SavedDestination(userId)`, `City(country)`, `City(popularity)`,
`Activity(cityId, category)`.

**Costing.** Activity costs come from the catalogue estimate unless a traveller overrides them with
`customCost`, in which case that wins. `Budget` combines planned activity spend with logged expenses.

---

## Getting started

### Prerequisites

- **Node.js 20+** (Node 24 was used to build this) and npm 10+.
- **PostgreSQL 14+** — either an existing server, a hosted instance such as Neon/Supabase, or the
  bundled zero-setup launcher described below (no Docker required).

### 1. Install

```bash
npm install
```

This installs the root tooling and both workspaces (`client`, `server`) and generates the Prisma
client. If your npm version gates postinstall scripts, run `npm approve-scripts` (or
`npm rebuild`) so Prisma's engines download.

### 2. Configure the environment

```bash
cp .env.example .env
```

Then edit `.env` and set `DATABASE_URL` and a `JWT_SECRET`. See
[Environment variables](#environment-variables).

### 3. Create the database

Pick whichever matches your environment:

```bash
# Option A — you already have PostgreSQL running
npm run prisma:migrate        # applies migrations

# Option B — no database at all (downloads a local PostgreSQL into .pgdata)
npm run db:local              # keep this running in its own terminal, then:
npm run prisma:migrate

# Option C — hosted provider (Neon, Supabase, Railway, …)
# paste the connection string into DATABASE_URL first, then:
npm run prisma:push           # or prisma:migrate
```

### 4. Seed the demo data

```bash
npm run seed
```

### 5. Run it

```bash
npm run dev
```

- App → <http://localhost:5173>
- API → <http://localhost:4000/api/health>

Or run the two halves separately with `npm run dev:server` and `npm run dev:client`. Vite proxies
`/api` to the backend, so the browser stays same-origin and auth cookies work in development without
fighting `SameSite` rules.

---

## Environment variables

All variables live in `.env` at the repository root; `.env.example` documents them.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | PostgreSQL connection string. |
| `JWT_SECRET` | yes | — | At least 16 characters. The server refuses to boot without it, in every environment. |
| `JWT_EXPIRES_IN` | no | `7d` | Session cookie lifetime. |
| `RESET_TOKEN_TTL_MINUTES` | no | `60` | How long a password-reset token stays valid. |
| `PORT` | no | `4000` | API port. |
| `NODE_ENV` | no | `development` | In `production` the session cookie is marked `secure` and reset tokens are no longer echoed to the log. |
| `CLIENT_URL` | no | `http://localhost:5173` | Used for CORS, the cookie origin and reset links. |
| `SERVER_URL` | no | `http://localhost:4000` | Public API base URL. |
| `STORAGE_PROVIDER` | no | `none` | `none` stores images as URLs or inline data URLs. `cloudinary` and `s3` are recognised but need credentials. |
| `STORAGE_API_KEY` / `STORAGE_API_SECRET` | no | — | Only needed for a real provider. Without them uploads fall back to inline data URLs. |
| `STORAGE_BUCKET` / `STORAGE_FOLDER` | no | `globetrotter` | Bucket or top-level folder for hosted images. |
| `SEED_USER_PASSWORD` | no | `Password123!` | Password given to seeded accounts. Read by the seed script only. |

Validation is strict: a missing `DATABASE_URL` or a `JWT_SECRET` under 16 characters prints the
offending variables and exits rather than failing on the first request.

Rate-limit thresholds are code constants rather than environment variables, because they are part of
security design rather than a deployment choice: 300 requests/minute globally, 25 per 15 minutes on
the auth endpoints, and 120/minute on writes.

**Never commit real secrets.** `.env` is git-ignored; only `.env.example` is tracked.

### A note on images

With `STORAGE_PROVIDER=none` the app still supports cover images and avatars through two paths that
need no credentials: paste an external URL, or upload a file which is downscaled in the browser
(longest edge capped at 1600px, re-encoded to WebP) and stored inline. Every image also has a
deterministic gradient fallback, so nothing ever renders as a broken image.

---

## Database setup & seeding

```bash
npm run prisma:generate   # regenerate the client after editing the schema
npm run prisma:migrate    # create + apply a migration (development)
npm run prisma:push       # push the schema without a migration file
npm run prisma:studio     # browse the data
npm run seed              # load demo cities, activities, users, trips and expenses
npm run db:reset          # drop everything, re-migrate and re-seed
npm run db:local          # zero-setup local PostgreSQL into .pgdata
```

A fresh `npm run db:reset` is the fastest way back to a known-good demo state.

**What the seed loads:** 16 destinations across India, Asia and Europe with realistic descriptions,
cost indices and coordinates; 100+ curated activities spread across eight categories with durations,
prices and imagery; three accounts (a demo traveller, an admin and a second traveller); a set of
trips owned by each — including public, upcoming, ongoing and completed examples — and matching
expense logs. Trip dates are generated relative to *today*, so the demo always has genuinely upcoming
trips rather than a fixture frozen in the past.

---

## Run commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API and the Vite dev server together. |
| `npm run dev:server` / `npm run dev:client` | Run one half on its own. |
| `npm run build` | Type-checks and builds the server and the client for production. |
| `npm start` | Starts the compiled API. |
| `npm run typecheck` | Type-checks both workspaces without emitting. |
| `npm test` | Runs the backend integration suite. |
| `npm run smoke` | End-to-end API verification against a running server. |
| `npm run seed` / `npm run db:reset` | Seed or reset the database. |
| `npm run db:local` | Start a local PostgreSQL with no Docker or system install. |

---

## Demo credentials

Development only — these accounts are created by `npm run seed`.

| Role | Email | Password |
| --- | --- | --- |
| Demo traveller | `demo@globetrotter.app` | `Password123!` |
| Admin | `admin@globetrotter.app` | `Password123!` |
| Second traveller | `priya@globetrotter.app` | `Password123!` |

In development the login screen has a one-click button that fills the demo credentials, and the
forgot-password flow returns the reset link directly instead of emailing it. Both behaviours are
disabled in production.

### Five-minute demo script

1. **Sign in** as the demo traveller — the dashboard shows live statistics, an upcoming trip with a
   budget bar, a cost-per-trip chart and derived notifications.
2. **Plan New Trip** — name it, pick dates, then choose two or three destinations and watch the route
   and cost summary update as you go.
3. **Add activities** in step 3, then review and create.
4. **Itinerary** — reorder with drag-and-drop, edit a time, and add something that overlaps to see the
   conflict warning and the "Add anyway" resolution.
5. **Budget** — see the category pie, the per-day bars, add an expense and set a limit below the
   estimate to trigger the over-budget alert.
6. **Calendar** — switch to week view and drag an activity onto another day.
7. **Share** — turn sharing on, copy the link, open it in a private window (no account needed), then
   **Copy This Trip** to clone it into another account.

---

## API documentation

Base URL `http://localhost:4000/api`. Authenticated routes read the JWT from an httpOnly cookie, so a
browser client needs `withCredentials`. The paginated list endpoints (`/trips`, `/cities`,
`/activities`) accept `page`, `pageSize` (max 60, default 12), `sortBy` and `sort`, and return `meta`
alongside `data`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/register` | — | Create an account and sign in. Body: `name`, `email`, `password`, `confirmPassword`, `avatar?` |
| POST | `/login` | — | Sign in. Body: `email`, `password`, `rememberMe?` |
| POST | `/logout` | — | Clear the session cookie. |
| GET | `/me` | ✔ | The current user and their preferences. |
| POST | `/forgot-password` | — | Request a reset link. Always returns the same response, so it cannot enumerate accounts. |
| POST | `/reset-password` | — | Body: `token`, `password`, `confirmPassword`. |
| POST | `/change-password` | ✔ | Body: `currentPassword`, `password`, `confirmPassword`. |

Rate limited: 25 requests per 15 minutes on `/register` and `/login`.

### Trips — `/api/trips`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | List your trips. Filters: `q` (name, description or city), `status` (UPCOMING/ONGOING/COMPLETED/ALL), `visibility` (PUBLIC/PRIVATE/ALL), `sortBy` (createdAt/startDate/name/cost). |
| POST | `/` | Create a trip, optionally with its `stops[]` in one request. |
| GET | `/:id` | Full trip: stops, itinerary items, owners and derived metrics. |
| PUT | `/:id` | Update details. Refuses date changes that would strand an existing stay. |
| DELETE | `/:id` | Delete the trip and everything under it. |
| POST | `/:id/share` | Body: `isPublic`. Mints or clears the public slug. |
| GET | `/:id/conflicts` | Full conflict report for the trip. |
| POST | `/:id/stops` | Add a city stay. Body: `cityId`, `startDate`, `endDate`. |
| PUT | `/:id/stops/reorder` | Body: `stopIds[]`. |
| POST | `/:id/itinerary` | Add an itinerary entry. Body: `activityId?`, `title?`, `date`, `startTime`, `endTime?`, `notes?`, `customCost?`, `allowOverlap?`. |
| PUT | `/:id/itinerary/reorder` | Bulk move/reorder. Body: `items[]` of `{ id, order, date?, startTime?, endTime? }`. |
| GET | `/:id/budget` | Totals, category split, per-day series, statistics and expenses. |
| POST | `/:id/expenses` | Log an expense. Body: `category`, `amount`, `description`, `date`. |

### Stops, itinerary items and expenses

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/stops/:id/activities` | Activities in that stay's city. |
| POST | `/api/stops/:id/activities` | Add an activity to a stay. Body: `activityId`, `date?`, `startTime?`, `endTime?`, `notes?`, `customCost?`, `allowOverlap?`. |
| PUT | `/api/stops/:id` | Update stay dates or order. |
| DELETE | `/api/stops/:id` | Remove a stay and the activities at it. |
| PUT | `/api/itinerary-items/:id` | Edit an entry (time, date, notes, cost, category). |
| DELETE | `/api/itinerary-items/:id` | Remove an entry. |
| PUT | `/api/expenses/:id` · DELETE | Edit or delete an expense. |

### Discovery

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/cities` | optional | Search. Filters: `q`, `country`, `region`, `minCostIndex`, `maxCostIndex`, `minPopularity`, `sortBy`. |
| GET | `/api/cities/facets` | — | Countries and regions with counts, plus the cost-index range. |
| GET | `/api/cities/popular` | — | Most popular destinations. |
| GET | `/api/cities/:id` | optional | City with its activities and highlight picks. |
| GET | `/api/cities/:cityId/activities` | — | Activities in a city. |
| GET | `/api/activities` | — | Search activities. Filters: `q`, `cityId`, `category`, `minCost`, `maxCost`, `maxDuration`. |
| GET | `/api/activities/:id` | — | A single activity. |

### Sharing

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/shared/:slug` | — | Public itinerary. Never includes the owner's email. |
| POST | `/api/shared/:slug/copy` | ✔ | Copy into your account as a private trip. 409 if you already own it. |

### Account

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/profile` | Profile plus trip statistics. |
| PUT | `/api/profile` | Update `name`, `email`, `avatar`, `language`, `currency`. |
| PUT | `/api/profile/preferences` | Update theme, default visibility and notification toggles. |
| DELETE | `/api/profile` | Delete the account. Body: `password`, `confirmation: "DELETE"`. |
| GET | `/api/saved` · POST `/api/saved` · DELETE `/api/saved/:cityId` | Bookmarked destinations. |
| GET | `/api/dashboard` · GET `/api/dashboard/notifications` | Dashboard aggregate and derived notifications. |
| GET | `/api/admin/analytics` | Admin only (403 otherwise). |
| GET | `/api/uploads/config` · POST `/api/uploads` | Image handling config and inline/URL upload. |
| GET | `/api/health` | Liveness probe. |

### Error format

```json
{
  "error": {
    "message": "The end date cannot be before the start date.",
    "code": "VALIDATION_ERROR",
    "details": { "endDate": ["The end date cannot be before the start date."] }
  }
}
```

`400` malformed body · `401` not signed in · `403` wrong role · `404` missing or not yours · `409`
conflict (duplicate city, overlapping activity, copying your own trip) · `422` validation · `429`
rate limited · `500` unexpected (the stack trace is logged, never returned).

---

## Testing

### Backend integration suite

```bash
npm test
```

94 tests across five suites run the **real Express app in-process** with Supertest against an
isolated PostgreSQL database, so requests pass through the actual middleware stack — validation,
auth, cookies, error handling — rather than calling services directly.

| Suite | Covers |
| --- | --- |
| `auth.test.ts` | Registration, duplicate email, weak password, login, wrong password, session, logout, password change, reset flow, account deletion. |
| `trips.test.ts` | Creation with stops, listing, every filter and sort, detail shape, updates, date-shrink refusal, deletion, owner scoping. |
| `itinerary.test.ts` | Adding and editing entries, reordering, moving between days, conflict detection, overlap acceptance, stay management. |
| `budget-sharing.test.ts` | Expense CRUD, totals and per-category splits, budget limits, sharing toggle, slug generation, public read, copy trip, authorization. |
| `discovery.test.ts` | City and activity search, filters, facets, pagination, bookmarks. |

### End-to-end smoke test

```bash
npm run dev        # in one terminal
npm run smoke      # in another
```

83 checks drive the live API over HTTP through the full journey — auth, dashboard, trips, discovery,
bookmarks, profile, trip creation with cities, itinerary conflicts, expenses, budget, public sharing,
copy trip, authorization boundaries, admin analytics and error handling.

### Type checking

```bash
npm run typecheck
```

---

## Deployment

The API is a standard Node service and the client builds to static files.

**1. Provision PostgreSQL** and set `DATABASE_URL` (Neon, Supabase, Railway, RDS, …).

**2. Set production variables** — at minimum `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`,
`CLIENT_URL` and `SERVER_URL`. In production the server refuses to start without a real
`JWT_SECRET`, uses secure cookies and stops returning reset tokens in API responses.

**3. Apply migrations and seed** (seed optional):

```bash
npx prisma migrate deploy
npm run seed
```

**4. Build:**

```bash
npm run build
```

This emits `server/dist` and `client/dist`.

**5. Serve.** Run `npm start` for the API and serve `client/dist` from any static host, configuring a
rewrite so all non-asset paths fall through to `index.html` (the app uses client-side routing).

**Reverse proxy.** Front the API on the same origin as the client — for example proxy `/api` to the
Node service — so the httpOnly auth cookie is first-party and no cross-site cookie configuration is
needed. If the API must live on its own host, set `CLIENT_URL` to the front-end origin and
`COOKIE_DOMAIN` accordingly, and the server will allow it through CORS with credentials.

---

## Screenshots

> Run `npm run dev` and sign in as the demo traveller to see each of these populated.

| Screen | What to look at |
| --- | --- |
| `docs/screenshots/landing.png` | Hero with a live three-city route, itinerary preview and cost panel; popular destination rail; how-it-works; features. |
| `docs/screenshots/dashboard.png` | Greeting, four statistic cards, planning analytics strip, upcoming-trip banner with budget bar, cost-per-trip chart, quick actions and notifications. |
| `docs/screenshots/create-trip.png` | Five-step wizard with a live trip summary and reference cost estimate. |
| `docs/screenshots/itinerary.png` | Three-pane builder — cities and dates, day timeline with drag handles, activity search and the trip summary. |
| `docs/screenshots/budget.png` | Category breakdown, over-budget alert, pie and per-day charts, expense table. |
| `docs/screenshots/calendar.png` | Month view with draggable entries, plus week, day and timeline modes. |
| `docs/screenshots/discover.png` | City discovery with search, cost-band chips, country/region filters and the trending rail. |
| `docs/screenshots/shared.png` | Public itinerary page as a signed-out visitor, with Copy This Trip. |

---

## Feature checklist

### Authentication

- [x] Signup with password strength indicator, show/hide password and optional avatar
- [x] Login with remember me, forgot-password link and error states
- [x] Logout
- [x] Forgot password (development-safe token workflow)
- [x] Reset password
- [x] Change password from Settings
- [x] Protected routes; unauthenticated visitors are redirected and returned afterwards
- [x] Admin-only routes enforced on client and server

### Trips

- [x] Create via a five-step wizard
- [x] Edit details, cover image, dates, sharing and budget limit
- [x] Delete with confirmation
- [x] View a trip workspace with overview, itinerary, budget and calendar
- [x] Search by name, description or city
- [x] Filter by upcoming / ongoing / completed and public / private
- [x] Sort by date, creation, name or cost; grid and list views; pagination

### Cities

- [x] Search by name, country or region
- [x] Filter by country, region, cost band and popularity
- [x] View a city with cost index, popularity, daily estimate and activities
- [x] Save and unsave destinations
- [x] Add a city to an existing trip or start a new trip from it

### Activities

- [x] Search with category, cost and duration filters
- [x] Add to an itinerary (from the builder, the calendar or a stay)
- [x] Remove and edit (time, date, notes, category, custom cost)
- [x] Reorder by drag-and-drop, with keyboard-accessible alternatives

### Itinerary

- [x] Multi-city routes with per-city dates
- [x] Day-by-day plan grouped by city, and a chronological timeline
- [x] Calendar month / week / day / timeline views
- [x] Drag to reorder and drag to reschedule
- [x] Conflict detection for overlaps and out-of-range entries, with a resolution path

### Budget

- [x] Expenses with the five categories, add / edit / delete
- [x] Total calculation and per-category split
- [x] Daily cost calculation, average per day, highest and cheapest day
- [x] Pie and bar charts
- [x] Optional budget limit with an over-budget warning

### Sharing

- [x] Public / private toggle with a generated slug
- [x] Share link with copy and Web Share
- [x] Public itinerary page with no private data
- [x] Copy Trip into another account, leaving the original untouched

### Profile & settings

- [x] View and edit profile, avatar, language and currency
- [x] Settings for account, preferences, privacy and account deletion
- [x] Saved destinations with view, remove and add-to-trip
- [x] In-app notifications derived from real data

### UI

- [x] Responsive at 375px, 768px and 1440px+ — sidebar becomes a drawer, cards stack, tables become
      cards, the itinerary keeps full width
- [x] Dark mode, persisted locally and on the profile
- [x] Loading skeletons on every API-driven screen
- [x] Empty states for trips, cities, activities, expenses, saved destinations, search misses and
      public trips
- [x] Error states, a 404 page, an unauthorized page and a top-level error boundary
- [x] Toast notifications for every mutation
- [x] Accessibility: labelled controls, keyboard navigation, visible focus rings, ARIA on
      interactive widgets, reduced-motion support, and no icon-only button without a label

### Quality gates

- [x] `npm run typecheck` — clean across both workspaces
- [x] `npm run build` — server and client build for production
- [x] `npm test` — 94 backend integration tests passing
- [x] `npm run smoke` — 83 end-to-end API checks passing

---

## Future improvements

- **Collaborative trips.** The schema already separates trips from their owner's account; an
  invitation model with per-member roles is the natural next step.
- **Real email delivery.** `forgotPassword` returns a token in development only. Wiring a provider
  (Resend, Postmark, SES) and removing the development branch is a small change behind the existing
  service boundary.
- **Object storage uploads.** `STORAGE_PROVIDER` and the upload endpoint already distinguish URL,
  inline and provider-backed images; only the direct-to-storage signing flow is missing.
- **Maps.** `City` and `Activity` both store coordinates, so a Mapbox or Leaflet route view is
  additive rather than a migration.
- **Optimistic conflict resolution.** The API returns structured conflicts; offering a one-click
  "shift these to the next free slot" would build on that without new endpoints.
- **Offline itinerary.** TanStack Query already caches every screen, so a service worker plus an
  offline mutation queue would make the builder usable on a plane.
- **Currency conversion.** Costs are stored in the profile's currency; storing a base amount plus a
  rate would make switching currency truthful rather than cosmetic.
- **Collaborative filtering.** Destination recommendations from the seeded plan data rather than
  popularity alone.

---

Built for travellers who plan. Every screen, button and flow in this repository is wired to the API —
there are no placeholder pages, no static mock data outside the seeded database, and no controls that
do nothing.
