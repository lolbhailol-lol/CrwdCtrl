# CrwdCtrl — Project Audit Report

**Audit date:** June 9, 2026  
**Scope:** Full read-only codebase review (frontend, backend, integrations, deployment)  
**Compared against:** `ARCHITECTURE.md`  
**Method:** Static analysis of all routes, controllers, models, middleware, services, frontend pages, env usage, and deployment configs. No code was modified.

---

## Executive Summary

CrwdCtrl is a **community and event discovery platform** (college fests, treks, sports, theatre, run clubs) built as a **React 19 + Vite SPA** (Vercel) talking to an **Express 5 + Mongoose monolith** (Railway) backed by **MongoDB Atlas**. The product surface is broad and feature-rich for an MVP: user auth (email + Firebase social), fest/competition registration with dynamic forms, **Cashfree** payments, **Cloudinary** uploads, **Google Sheets** sync, in-app + **FCM push** notifications, QR check-in, and a multi-module **admin dashboard**.

`ARCHITECTURE.md` accurately describes the high-level topology (client → API → MongoDB + external services) but **understates complexity**: dual registration systems, separate admin auth, Google Sheets, and several unwired or partially implemented features are not reflected.

**Overall assessment:** The codebase is **functional for controlled beta/MVP use** but has **critical security gaps**, **no automated tests**, **fragmented frontend API patterns**, and **production risks** around payments, trek bookings, and admin access. Several user-facing links are broken (`/theatre`, `/dashboard`), and scheduled reminders are implemented but never started.

**Launch Readiness Score: 54 / 100** — see dedicated section below.

---

## Current Architecture

### Runtime topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User Browser (PWA-capable)                                             │
│  React 19 + React Router 7 + Tailwind 4 + Firebase Client SDK           │
│  Deployed: Vercel (SPA rewrite → index.html)                            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS REST (JWT Bearer)
                                │ Firebase OAuth / FCM (direct to Google)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Express 5 API — /api/*                                                 │
│  Helmet, CORS, compression, rate limits, JWT middleware                 │
│  Deployed: Railway (nixpacks, Node 20, PORT 8080)                       │
│  Kept warm: GitHub Actions cron every 5 min → /api/health               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Mongoose ODM
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MongoDB Atlas                                                          │
└─────────────────────────────────────────────────────────────────────────┘

External: Cashfree PG │ Cloudinary │ Resend/SMTP │ Firebase Admin (FCM) │ Google Sheets API
```

### Repository layout

| Area | Path | Stack |
|------|------|-------|
| Frontend | `frontend/` | Vite 7, React 19, PWA plugin |
| Backend | `backend/src/` | Express 5, Mongoose 8 |
| Docs | `ARCHITECTURE.md` | Mermaid diagram only |
| CI | `.github/workflows/keep-alive.yml` | Railway health ping |
| Root | `package.json` | Only `mongodb` dep (orphan) |

### ARCHITECTURE.md vs implementation

| Documented | Actual | Match? |
|------------|--------|--------|
| React app + API client + JWT session | Yes — `utils/api.js`, `AuthContext`, localStorage tokens | ✅ |
| Firebase Auth, Messaging, Analytics | Yes — `firebase.js`, FCM SW, `NotificationsContext` | ✅ |
| Express `/api` + middleware layer | Yes — `app.js`, rate limits, Helmet, CORS | ✅ |
| Routes: Users, Admin, Events, Fests, Competitions, Treks, Sports, Payments, Notifications, QR, Analytics | Yes — 22 route modules mounted in `routes/index.js` | ✅ |
| Mongoose models | 17 model files + `models/index.js` loader | ✅ |
| Cashfree payments | `cashfreeService.js`, `paymentController.js` | ✅ |
| Cloudinary uploads | `cloudinaryService.js`, `uploadController.js`, registration uploads | ✅ |
| Resend / SMTP email | `emailService.js` | ✅ |
| Firebase Admin push | `pushService.js` | ✅ |
| Google Sheets | `googleSheetsService.js` — **not in diagram** | ⚠️ Gap |
| Dual user vs admin JWT auth | Separate `adminAuth` + env credential login | ⚠️ Gap |
| Legacy manual competition registration | Public `/api/competitions/register` + frontend QR flow | ⚠️ Gap |
| Category registrations (sports/trek/theatre) | `/api/category-registrations` | ⚠️ Gap |
| Run clubs, trek communities, theatre admin | Additional verticals beyond diagram labels | ⚠️ Partial |

---

## Frontend Analysis

### Stack and entry

- **Entry:** `frontend/src/main.jsx` — theme init, boot splash, PWA SW (prod only)
- **Router:** `frontend/src/App.jsx` — ~35 public routes + 10 nested `/admin/*` routes
- **State:** Context providers for Auth, DarkMode, Favorites, RegisteredEvents, Notifications, PageTransition

### Route inventory (public)

| Category | Routes |
|----------|--------|
| Home / discovery | `/`, `/fests`, `/cultural-fest`, `/tech-fest`, `/sports`, `/sports-fest`, `/treks`, `/treks/community/:id`, `/treks/category/:category`, `/trek/:id`, `/trek/:id/book` |
| Fest / competition detail | `/view-details/:eventId`, `/competitions-view-details/:competitionId`, `/competition-list/:eventId` |
| Registration | `/fest/:festId/register`, `/competition-registration/:competitionId`, `/competition-register`, `/registration-details/:registrationId`, `/qr-ticket/:registrationId` |
| Auth / profile | `/login`, `/register`, `/verify-email`, `/profile`, `/edit-profile`, `/booking`, `/notifications` |
| Static | `/about`, `/contact-us`, `/terms-and-conditions`, `/privacy-policy`, `/help-center`, `/list-your-fest`, `/favorites`, `/connection-status` |

### Admin routes (`/admin/*`)

Dashboard, Fests, Competitions, Registrations, Analytics, Check-in Scanner, Sports, Treks, Theatre, Section Manager — all behind `AdminProtectedRoute`.

### API client patterns (architectural debt)

| Pattern | Location | Issue |
|---------|----------|-------|
| Central `ApiClient` | `utils/api.js` | Well-structured but **underused** |
| Inline `fetch` + `VITE_API_BASE_URL` | 30+ page/admin files | Duplicated base URL, inconsistent error handling |
| `AuthContext.apiCall()` | `context/AuthContext.jsx` | Third parallel pattern |
| `authFetch.js` | `utils/authFetch.js` | Reads wrong key (`token` vs `crwdctrl_token`); only used by dead `apiService.js` |

### Third-party (frontend)

| Service | Integration |
|---------|-------------|
| Firebase Auth | Google/Facebook popup + redirect, email/password |
| Firebase Analytics | `getAnalytics(app)` |
| Firebase FCM | Token registration → `POST /notifications/register-push` |
| Cashfree JS SDK | `utils/useCashfree.js` — fest, competition, trek flows |
| Google AdSense | `AdSense.jsx` on content pages |
| PWA | `vite-plugin-pwa`, API caching |
| Geocoding | Nominatim / BigDataCloud on Dashboard |

### Frontend strengths

- Responsive mobile-first UI (bottom nav, sticky header, skeleton loaders)
- Modern Cashfree payment flow for dynamic fest/competition registration
- PWA + backend wake-up on cold start
- Comprehensive admin CRUD for multiple verticals

### Frontend weaknesses

- **Broken routes:** `HomeCategoryBar` and `Navbar` link to `/theatre` — **no public route exists** (only `/admin/theatre`)
- **Broken navigation:** `EmailVerification.jsx` and `FestRegistration.jsx` navigate to `/dashboard` — **route undefined** (SPA falls through to home via rewrite, but no dedicated dashboard)
- **Orphan components:** `AdminDashboard.jsx`, `CompetitionRegistrationsAdmin.jsx`, `EventsPage.jsx` + `EventFormModal.jsx` — built but not routed
- **List Your Fest:** `list-your-fest.jsx` simulates submit (`setTimeout`) — no backend integration
- **Dual registration UX:** Modern Cashfree flow vs legacy `compition-register-page.jsx` (manual QR screenshot)
- **Feature flags** in `config/env.js` defined but never enforced in components
- **Unused deps:** `better-auth` in `package.json`, zero imports
- **Secrets in repo:** Full Firebase config + VAPID key in `vercel.json` and hardcoded in `public/firebase-messaging-sw.js`

---

## Backend Analysis

### Entry and app layer

- **`server.js`:** dotenv → `assertProductionEnv()` → async Mongo connect → listen `0.0.0.0:8080` → graceful shutdown
- **`app.js`:** Helmet (CSP disabled), CORS, 10mb JSON, compression, security headers, dev request logger, `/api` rate limiter (300/15min prod), health endpoints, route mount, 404 + error handlers
- **Note:** Server starts **before** MongoDB connection completes — early requests can fail

### Route modules (22)

`users`, `students`, `fest-organizer`, `fests`, `competitions`, `admin`, `admin/events`, `admin/sports`, `admin/run-clubs`, `admin/treks`, `admin/trek-communities`, `trek-communities`, `admin/theatre`, `events`, `treks`, `sports`, `run-clubs`, `category-registrations`, `registrations`, `payment`, `notifications`, `qr`, `analytics`

### Controllers (19)

User, student, fest organizer, admin auth/fest/event/sports/run-club/trek/trek-community/theatre/section, registration, competition, category registration, payment, notification, QR, analytics, upload.

### Middleware (7)

| Middleware | Role |
|------------|------|
| `authmiddleware.js` | User JWT (`authenticateToken`), role authorization |
| `adminAuth.js` | Admin JWT (`role === 'admin'`), blocks refresh tokens |
| `rateLimiter.js` | API (300), auth (20), payment (60) per 15 min |
| `security.js` | Cache-Control on GET |
| `errorHandler.js` | Sanitized prod error messages |
| `requestLogger.js` | Dev-only logging |
| `devOnly.js` | 404 in production for debug routes |

### Services (6)

| Service | File | Status |
|---------|------|--------|
| Cashfree | `cashfreeService.js` | Active — PG API v2025-01-01 |
| Cloudinary | `cloudinaryService.js` | Active |
| Email | `emailService.js` | Active — Resend primary, SMTP fallback, queued sends |
| Push | `pushService.js` | Active if Firebase Admin creds set |
| Google Sheets | `googleSheetsService.js` | Active for registration row append |
| Reminders | `reminderService.js` | **Implemented but never started** (`initReminderCron` not called from `server.js`) |

### Backend strengths

- Layered Express structure with clear route/controller separation
- Production env validation for critical secrets (`MONGODB_URI`, `JWT_SECRET`)
- Rate limiting, Helmet, graceful shutdown
- Rich registration pipeline: forms, payments, Cloudinary, Sheets, email, push, QR
- `devOnly` middleware on several admin debug routes

### Backend weaknesses

- **No tests** — `"test": "echo 'No tests specified'"`
- **No Cashfree webhook** — payment confirmation relies entirely on client-initiated verify
- **No shared input validation** (Zod/Joi) — ad-hoc per controller
- **In-memory fest cache** in `festOrganizerController` — won't sync across Railway replicas
- **Verbose admin auth logging** — token metadata logged on every request
- **Optional integrations fail silently** at startup (Cashfree, Cloudinary, Firebase push only warn)

---

## Database Analysis

### MongoDB via Mongoose — 17 collections

| Model | File | Purpose |
|-------|------|---------|
| User | `usermodel.js` | Auth, roles, FCM tokens, Firebase UID, social auth |
| Student | `student&participant.js` | Extended profile, registered fests/events/competitions |
| FestOrganizer | `fest_organizer_model.js` | Fest listings, dynamic registration config, home sections |
| Competition | `competition_model.js` | Competitions under fests, form schemas, fees |
| Registration | `registration_model.js` | Primary fest/competition registrations + payment + QR |
| CompetitionRegistration | `competition_registration_model.js` | **Legacy** manual payment registrations |
| Event | `event_model.js` | Fest sub-events/workshops (organizer-scoped) |
| PlatformEvent | `platform_event_model.js` | Standalone discovery events (`/api/events`) |
| CategoryRegistration | `category_registration_model.js` | Sports/trek/theatre unified registrations |
| SportsEvent | `sports_model.js` | Sports listings |
| RunClub | `run_club_model.js` | Run club profiles |
| Trek | `trek_model.js` | Trek listings |
| TrekBooking | `trek_booking_model.js` | Trek booking records |
| TrekCommunity | `trek_community_model.js` | Trek organizer communities |
| Theatre | `theatre_model.js` | Theatre shows (admin-managed) |
| Notification | `notification_model.js` | In-app notifications (90-day TTL) |
| Analytics | `analytics_model.js` | Event tracking (90-day TTL) |

### Schema concerns

1. **Dual "Event" concepts** — `Event` (fest workshop) vs `PlatformEvent` (discovery). `paymentController` imports `Event`, not `PlatformEvent` — platform event payments likely broken.
2. **Dual competition registration** — `Registration` (modern) vs `CompetitionRegistration` (legacy public endpoint).
3. **`festDate` stored as string** on `FestOrganizer` — unreliable parsing for reminder cron and date filters.
4. **`competition_model` indexes `{ status: 1 }`** but schema has **no `status` field** — dead index.
5. **`CategoryRegistration.eventId`** is polymorphic ObjectId without formal `ref` — no DB-level referential integrity.
6. **No migration tooling** — schema changes applied ad-hoc via Mongoose.
7. **Registration data retained indefinitely** — only analytics/notifications have TTL.

### Indexes (notable)

- User: sparse unique on `email`, `phoneNumber`, `firebaseUid`
- Registration: unique compound `{ fest, user, competitionId }` (sparse)
- Competition: `{ fest: 1 }`, ineffective `{ status: 1 }`

---

## Authentication Flow

### User authentication

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Firebase     │     │ Frontend        │     │ Backend          │
│ (OAuth/email)│────▶│ authService.js  │────▶│ POST /users/     │
│              │     │ AuthContext     │     │ login|register|  │
└──────────────┘     └─────────────────┘     │ social-auth      │
                              │               └────────┬─────────┘
                              │                        │
                              ▼                        ▼
                     localStorage:              JWT signed with
                     crwdctrl_token             JWT_SECRET
                     crwdctrl_user              (7d typical)
                              │
                              ▼
                     Subsequent API calls:
                     Authorization: Bearer <token>
                     authenticateToken → loads user role from DB
```

**Issues:**
- Backend **does not verify Firebase ID tokens** — accepts client-supplied `firebaseUid` without cryptographic validation
- Frontend sends `isVerified: true` to backend on register/social flows — **bypasses Firebase email verification** for API access
- Passwords hashed via bcrypt on User model (`comparePassword`)
- JWT stored in `localStorage` — XSS-exposed
- No password reset / forgot-password flow
- No refresh token for regular users (only admin has refresh)

### Admin authentication

```
POST /admin/login
  → plaintext compare ADMIN_EMAIL / ADMIN_PASSWORD (env vars)
  → JWT access (1h) + refresh (7d)
  → stored as admin_token / admin_refresh_token in localStorage

AdminProtectedRoute: checks admin_token EXISTS only — no expiry validation until API call fails
adminAuth middleware: verifies JWT, role === 'admin'
```

**Issues:**
- Single shared admin credential in environment — no hashing, no MFA, no audit log
- Admin and user tokens share browser localStorage namespace
- `adminAuth.js` logs token fragments and decoded payload on every request

---

## Payment Flow

### Fest / competition (authenticated)

```
Frontend (FestRegistration / CompetitionRegistration)
  1. POST /payment/quote        → ticket + 3% platform fee breakdown
  2. POST /payment/order        → Cashfree order created (return URL = FRONTEND_URL)
  3. Cashfree checkout modal    → user pays
  4. POST /payment/verify       → server verifies with Cashfree API
  5. POST /registrations/.../pay-and-register OR register after verify
     → Registration saved, email, push, Google Sheets, QR generated
```

### Trek (partially unauthenticated)

```
Frontend (TrekBookingPage)
  1. POST /payment/trek-order     → NO AUTH REQUIRED
  2. Cashfree checkout
  3. POST /payment/trek-verify    → NO AUTH REQUIRED
  4. POST /treks/:id/register     → NO AUTH REQUIRED
     → Trusts amountPaid/paymentId from request body without server-side re-verification
```

### Legacy manual payment

```
POST /api/competitions/register (PUBLIC, no auth)
  → FormData with payment screenshot
  → CompetitionRegistration model
  → Used by compition-register-page.jsx for hardcoded competitions
```

### Payment architecture gaps

| Gap | Risk |
|-----|------|
| No Cashfree webhook handler | Client can close browser before verify; payment state desync |
| No idempotency keys | Double-submit can create duplicate orders/registrations |
| Trek register doesn't re-verify payment | Fake bookings with arbitrary `paymentId` |
| `paymentController` uses wrong Event model for `eventId` | Platform event payments broken |
| Platform fee (3%) calculated client + server — no single source of truth audit | Minor manipulation risk if server quote skipped |

**Env:** `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_ENV`, `FRONTEND_URL` (backend); `VITE_CASHFREE_MODE` (frontend)

---

## Notification Flow

### In-app notifications

```
registrationController / reminderService / usercontroller (login)
  → notificationController.createNotification()
  → Notification model (MongoDB, 90-day TTL)

Frontend: NotificationsContext
  → GET /notifications, /unread-count
  → PUT /read-all, /:id/read
  → DELETE /:id
```

### Push (FCM)

```
Frontend: requestNotificationPermission() → FCM token
  → POST /notifications/register-push → User.fcmTokens[]

Backend: pushService.js (firebase-admin)
  → sendPushNotification(userId, { title, body, link })
  → Triggered on: login, registration success, reminder cron (if started)
  → Invalid tokens pruned from User.fcmTokens
```

### Email

```
emailService.js
  → Resend (RESEND_API_KEY, RESEND_FROM) preferred
  → Gmail SMTP (EMAIL_USER, EMAIL_PASS) fallback
  → Templates: welcome, registration, organizer alert, login confirmation, broadcast
  → Queued async sends
```

### Reminder cron (NOT RUNNING)

`reminderService.initReminderCron()` — hourly check for fests in next 24h → email + push + in-app. **Never called from `server.js`.**

### SMS

`twilio` package in `backend/package.json` — **zero usage in codebase**.

---

## Admin System

### Capabilities

| Module | API Base | Features |
|--------|----------|----------|
| Dashboard | `/admin/stats`, `/analytics/dashboard` | User/fest/competition counts, analytics |
| Fests | `/admin/fests` | CRUD, priority, reorder, broadcast announcement |
| Competitions | `/admin/competitions`, inline in adminRoute | CRUD, fee config, form schemas |
| Registrations | `/registrations/admin/*` | Review, status updates, Sheets diagnose |
| Sports / Run clubs | `/admin/sports`, `/admin/run-clubs` | CRUD |
| Treks / Communities | `/admin/treks`, `/admin/trek-communities` | CRUD |
| Theatre | `/admin/theatre` | CRUD — **no public listing API** |
| Platform events | `/admin/events` | CRUD — **EventsPage not routed in frontend** |
| Sections | `/admin/sections/reorder` | Home page carousel/section ordering |
| Check-in | `/qr/checkin/:hash` | QR scanner verification |
| Uploads | `/admin/upload/image(s)` | Cloudinary |
| Cache | `/admin/clear-cache` | Clears in-memory fest cache |

### Admin auth weaknesses

- Env-based single credential
- Frontend guard is token-presence only
- Token refresh logic duplicated across 3+ admin components
- Debug endpoints on admin route (some `devOnly`-protected): payment tests, Google Sheets tests, QR tests

### Unwired admin features

- `toggleFestApproval` exported in `festOrganizerController` — **no route**
- `EventsPage` / `EventFormModal` — built, not in router
- `CompetitionRegistrationsAdmin.jsx` — standalone page, not routed

---

## API Inventory

**Base URL:** `/api`  
**Total route modules:** 22  
**Approximate endpoints:** 120+

### Summary by domain

| Domain | Prefix | Auth default | Key endpoints |
|--------|--------|--------------|---------------|
| Users | `/users` | Mixed | register, login, social-auth, profile, upload |
| Students | `/students` | Student role | profile CRUD, registered lists |
| Fest organizer | `/fest-organizer` | Organizer | fest/event/competition CRUD |
| Public fests | `/fests` | Public | all, search, upcoming, `/:id/public`, **`/:id/debug`** |
| Competitions | `/competitions` | Mixed | search (public), **`register` (public)**, admin registration mgmt |
| Admin | `/admin` | Admin | login, refresh, stats, fests, competitions, uploads, debug |
| Admin verticals | `/admin/events\|sports\|run-clubs\|treks\|trek-communities\|theatre` | Admin | Standard CRUD |
| Public discovery | `/events`, `/treks`, `/sports`, `/run-clubs`, `/trek-communities` | Public | List + detail; trek register |
| Registrations | `/registrations` | User/Admin | fest/competition register, pay-and-register, admin review |
| Category regs | `/category-registrations` | User/Admin | sports/trek/theatre register |
| Payments | `/payment` | Mixed | quote/order/verify (auth); **trek-order/verify (public)** |
| Notifications | `/notifications` | User | CRUD + register-push |
| QR | `/qr` | User/Admin | generate QR, check-in, stats |
| Analytics | `/analytics` | Mixed | track (public), dashboard (admin) |
| Health | `/health`, `/keep-alive`, `/status` | Public | Ops |

### High-risk public endpoints

| Method | Path | Issue |
|--------|------|-------|
| POST | `/competitions/register` | Unauthenticated PII + payment screenshot upload |
| POST | `/payment/trek-order` | Unauthenticated order creation |
| POST | `/payment/trek-verify` | Unauthenticated payment verification |
| POST | `/treks/:id/register` | No payment re-verification; trusts body |
| GET | `/fests/:id/debug` | Fest metadata leak in production |
| GET | `/registrations/debug/user-registrations` | Debug data dump (auth required but no devOnly) |
| GET | `/registrations/admin/debug/registration/:id` | Full registration responses dump |

---

## Third-Party Integrations

| Service | Backend | Frontend | Env vars | Status |
|---------|---------|----------|----------|--------|
| **MongoDB Atlas** | `config/db.js` | — | `MONGODB_URI` | Required in prod |
| **JWT** | `jwtSecret.js`, auth middleware | Token in localStorage | `JWT_SECRET` | Required in prod |
| **Firebase Auth** | UID linking only (no token verify) | Full OAuth + email | `VITE_FIREBASE_*` | Active |
| **Firebase FCM** | `pushService.js` (admin SDK) | `firebase.js`, messaging SW | `FIREBASE_SERVICE_ACCOUNT_KEY`, `VITE_FIREBASE_VAPID_KEY` | Active if configured |
| **Firebase Analytics** | — | `firebase.js` | `VITE_FIREBASE_MEASUREMENT_ID` | Active |
| **Cashfree** | `cashfreeService.js` | `@cashfreepayments/cashfree-js` | `CASHFREE_*`, `VITE_CASHFREE_MODE` | Active; no webhooks |
| **Cloudinary** | `cloudinaryService.js`, `uploadController.js` | Via API uploads | `CLOUDINARY_*` | Optional |
| **Resend** | `emailService.js` | — | `RESEND_API_KEY`, `RESEND_FROM` | Preferred email |
| **Gmail SMTP** | `emailService.js` fallback | — | `EMAIL_USER`, `EMAIL_PASS` | Fallback |
| **Google Sheets** | `googleSheetsService.js` | — | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Optional |
| **Google AdSense** | — | `AdSense.jsx` | — | Frontend only |
| **Twilio** | — | — | — | **Dead dependency** |
| **Firebase client SDK (backend)** | — | — | — | **Dead dependency** (`firebase` npm in backend) |
| **better-auth** | — | — | — | **Dead dependency** (frontend) |

---

## Missing Features

| Feature | Evidence |
|---------|----------|
| Public theatre browsing/booking | Navbar links `/theatre`; no public route or API |
| Public platform events UI | Admin CRUD + `/api/events` exist; `EventsPage` not routed |
| Password reset | No route or UI |
| Cashfree webhooks | No handler in codebase |
| Event reminder cron | `initReminderCron` never started |
| List Your Fest backend | Frontend simulates success only |
| User dashboard route | `/dashboard` navigated to but undefined |
| Automated tests | None in frontend or backend |
| API documentation | No OpenAPI/Swagger |
| Sentry / error tracking | Env vars in `.env.example`, not wired |
| SMS notifications | Twilio installed, unused |
| Fest approval toggle API | Handler exists, no route |
| Password strength beyond 6 chars | Minimal validation |
| GDPR/data export | No user data export/delete flow |
| CI test/lint pipeline | Only keep-alive workflow |
| Public theatre category registration UI | Backend `category-registrations` supports theatre; no dedicated frontend page found |

---

## Bugs Found

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| 1 | `/dashboard` route missing | `EmailVerification.jsx`, `FestRegistration.jsx` | Post-verify/register navigation broken |
| 2 | `/theatre` public route missing | `HomeCategoryBar.jsx`, `Navbar.jsx` | Category nav 404 |
| 3 | `initReminderCron()` never called | `server.js` vs `reminderService.js` | No automated event reminders |
| 4 | `paymentController` uses `Event` not `PlatformEvent` for `eventId` | `paymentController.js` | Platform event payments fail/wrong price |
| 5 | Trek registration trusts client `paymentId`/`amountPaid` | `publicTrekRoute.js` | Free/cheap trek bookings possible |
| 6 | `authFetch.js` uses `token` key instead of `crwdctrl_token` | `utils/authFetch.js` | Latent auth failure if used |
| 7 | `AdminDashboard.jsx` calls `/admin/dashboard` | Orphan page | Wrong endpoint (actual: `/admin/stats`, `/analytics/dashboard`) |
| 8 | Competition model indexes nonexistent `status` field | `competition_model.js` | Wasted/misleading index |
| 9 | Firebase messaging SW uses SDK v10; client uses v12 | `firebase-messaging-sw.js` vs `package.json` | Potential FCM compatibility issues |
| 10 | `festDate` string parsing in reminder cron | `reminderService.js` | Reminders skip most real-world date formats |
| 11 | Server starts before DB ready | `server.js` | Transient 500s on cold start |
| 12 | `RegisteredEventsContext` uses hardcoded demo data | `context/RegisteredEventsContext` | Misleading "registered" state vs API |

---

## Dead Code

### Backend

| Item | Path |
|------|------|
| `firebase` npm package (client SDK) | `backend/package.json` |
| `twilio` npm package | `backend/package.json` |
| `initReminderCron` (unwired) | `services/reminderService.js` |
| `toggleFestApproval` (no route) | `controllers/festOrganizerController.js` |
| `sendPushToMultipleUsers` (unused export) | `services/pushService.js` |
| `testCloudinaryConnection`, `deleteFromCloudinary` (no callers) | `services/cloudinaryService.js` |
| Example organizer routes | `/users/organizer-only`, `/organizer-sponsor` |
| `batch_email.js` + `test.users.csv` | `backend/` — ops script, not API |
| `CompetitionRegistration` legacy path | May be intentional but overlaps modern flow |

### Frontend

| Item | Path |
|------|------|
| `AdminDashboard.jsx` | `components/pages/` |
| `CompetitionRegistrationsAdmin.jsx` | `components/pages/` |
| `EventsPage.jsx`, `EventFormModal.jsx` | `components/admin/` |
| `apiService.js` | `services/` |
| `authFetch.js` | `utils/` (wrong key, single dead consumer) |
| `eventsData.js` + static JSON | Largely superseded by API |
| `better-auth` dependency | `package.json` |
| `FEATURES` flags | `config/env.js` — never read |
| `SOCIAL_CONFIG` OAuth IDs | `config/env.js` — Firebase handles OAuth |
| Root `package.json` mongodb dep | Repository root |

---

## Duplicate Code

| Pattern | Occurrences |
|---------|-------------|
| `API_BASE_URL = import.meta.env.VITE_API_BASE_URL \|\| 'http://localhost:8080/api'` | 30+ files |
| `refreshAdminToken()` | `AdminDashboardPage`, `FestFormModal`, `Competition_Modal` |
| Fest category pages | `cultural-fest.jsx`, `tech-fest.jsx`, `sports-fest.jsx` — near-identical |
| Cloudinary configuration | `cloudinaryService.js` + `uploadController.js` (duplicate config block) |
| Competition registration flows | Cashfree (`CompetitionRegistration.jsx`) vs manual QR (`compition-register-page.jsx`) |
| Admin dashboard implementations | `AdminDashboard.jsx` vs `AdminDashboardPage.jsx` |
| Login/register modal triggers | Duplicated across help-center, favorites, list-your-fest, notifications |
| Dual Event models + dual Registration models | Backend domain duplication |

---

## Security Concerns

| Severity | Concern |
|----------|---------|
| **Critical** | Trek payment/register endpoints allow unauthenticated order creation and booking without server payment re-verification |
| **Critical** | Public `POST /competitions/register` accepts PII and payment screenshots without authentication |
| **Critical** | Admin auth uses plaintext env password comparison — single shared credential |
| **High** | Firebase UID accepted from client without server-side ID token verification — account linking hijack risk |
| **High** | JWT and admin tokens in `localStorage` — full compromise on any XSS |
| **High** | Firebase VAPID key and full config committed in `vercel.json` and `firebase-messaging-sw.js` |
| **High** | Frontend forces `isVerified: true` on backend sync — email verification bypass |
| **Medium** | CORS allows any `*.vercel.app` origin in production |
| **Medium** | `GET /fests/:id/debug` public in production |
| **Medium** | Registration debug endpoints lack `devOnly` middleware |
| **Medium** | `adminAuth.js` logs token details to stdout |
| **Medium** | No Cashfree webhook signature verification (webhooks absent entirely) |
| **Medium** | 10mb JSON body limit — DoS vector without stricter per-route limits |
| **Low** | Dev JWT fallback secret if `JWT_SECRET` unset in non-production |
| **Low** | `GET /admin/health` unauthenticated |
| **Low** | Extensive `console.log` of auth state, tokens, API URLs in production frontend code |
| **Info** | Firebase client API keys are public by design; VAPID in repo still increases abuse surface |

---

## Performance Concerns

| Concern | Detail |
|---------|--------|
| In-memory fest cache | `festOrganizerController` — stale data across instances, no distributed invalidation except manual `/admin/clear-cache` |
| No DB connection gate | Server accepts traffic before Mongo ready |
| Large registration controller | `registrationController.js` is monolithic — high maintainability cost, slow cold parse |
| 10mb upload payloads | Multer memory storage — memory pressure under concurrent uploads |
| Frontend bundle | Many eager + lazy splits but heavy page-level duplication; static JSON data still bundled |
| GitHub Actions keep-alive every 5 min | Masks Railway cold starts but adds constant traffic; not a substitute for proper always-on tier |
| N+1 patterns | Some admin list endpoints populate nested refs without pagination caps |
| Analytics track endpoint | Public, unrate-limited beyond global API limiter — abuse potential |
| PWA caches API responses | Stale data risk if cache keys not carefully invalidated |

---

## Scalability Concerns

| Concern | Detail |
|---------|--------|
| Monolithic Express app | All verticals in one deploy unit — can't scale trek vs fest independently |
| No job queue | Email, Sheets, push sent inline or via simple queue in emailService — no Bull/SQS for retries at scale |
| No horizontal cache sync | In-memory fest cache breaks with multiple Railway replicas |
| MongoDB single cluster | No read replicas or sharding strategy documented |
| File uploads via API memory | Cloudinary streaming helps but multer buffers in RAM first |
| Reminder cron in-process | Even if wired, won't run correctly on multiple instances without leader election |
| Google Sheets as registration sink | Rate limits and contention at high registration volume |
| No CDN strategy for user uploads | Cloudinary handles delivery but not explicitly configured in code |
| Session/stateless JWT only | No token revocation list — compromised tokens valid until expiry |

---

## Production Risks

| Risk | Likelihood | Impact |
|------|------------|--------|
| Payment desync (no webhooks) | Medium | High — paid users not registered |
| Fake trek bookings | High | Medium — revenue loss, oversold treks |
| Admin credential leak from env | Medium | Critical — full platform control |
| XSS → token theft | Medium | High — account takeover |
| Railway cold start + no DB ready | High | Medium — failed registrations during spike |
| Cashfree creds missing in prod | Low | High — payments silently fail (warn-only at startup) |
| Firebase push not configured | Medium | Low — silent degradation |
| Keep-alive GitHub Action failure | Low | Medium — cold starts return |
| Dual registration systems confusion | Medium | Medium — data in wrong collection |
| Secrets in git (`vercel.json`) | Ongoing | Medium — key rotation difficulty, abuse |
| No monitoring/alerting | High | High — incidents discovered by users |
| No backups documented | Unknown | Critical if Atlas backups not configured in Atlas console |

---

## Launch Readiness Score

### **54 / 100**

| Category | Weight | Score | Notes |
|----------|--------|-------|-------|
| Core functionality | 20% | 16/20 | Fest/trek/sports discovery, registration, payments largely work |
| Security | 20% | 6/20 | Critical auth/payment gaps |
| Reliability | 15% | 7/15 | No webhooks, cold starts, unwired cron |
| Code quality | 15% | 8/15 | Structured backend; fragmented frontend |
| Testing & CI | 10% | 1/10 | Zero automated tests |
| Observability | 10% | 3/10 | Console logs only; health endpoints exist |
| Documentation | 5% | 3/5 | ARCHITECTURE.md accurate at high level |
| Deployment | 5% | 4/5 | Vercel + Railway working; secrets in repo |
| Data model integrity | 5% | 3/5 | Duplicate models, string dates |
| UX completeness | 5% | 3/5 | Broken routes, orphan admin pages |

**Recommendation:** Suitable for **closed beta** with manual ops oversight. **Not recommended for open public launch** until payment security, admin auth, and critical route bugs are resolved.

---

## Top 20 Issues Ranked By Severity

| Rank | Severity | Issue | Area |
|------|----------|-------|------|
| 1 | **Critical** | Trek register endpoint accepts bookings without server-side payment re-verification | Backend — `publicTrekRoute.js` |
| 2 | **Critical** | Public trek payment order/verify endpoints have no authentication | Backend — `paymentRoute.js` |
| 3 | **Critical** | Public competition registration accepts PII + payment screenshots without auth | Backend — `competitionRoute.js` |
| 4 | **Critical** | Admin login uses plaintext env password — single shared credential, no MFA | Backend — `adminAuthController.js` |
| 5 | **High** | No Cashfree webhook — payment confirmation relies solely on client verify call | Backend — missing feature |
| 6 | **High** | Firebase UID trusted without server-side ID token verification | Backend — `usercontroller.js` |
| 7 | **High** | JWT/admin tokens in localStorage — XSS leads to full account compromise | Frontend |
| 8 | **High** | Firebase VAPID key + config committed in `vercel.json` and service worker | Frontend / deployment |
| 9 | **High** | Frontend sends `isVerified: true` — bypasses email verification for API access | Frontend — `authService.js`, `AuthContext.jsx` |
| 10 | **High** | Zero automated tests (unit, integration, e2e) | Full stack |
| 11 | **Medium** | `initReminderCron` never started — reminder feature completely dead | Backend — `server.js` |
| 12 | **Medium** | Broken `/theatre` and `/dashboard` routes linked from UI | Frontend |
| 13 | **Medium** | `paymentController` uses wrong Event model — platform event payments broken | Backend |
| 14 | **Medium** | CORS allows any `*.vercel.app` origin | Backend — `cors.js` |
| 15 | **Medium** | Public fest debug endpoint exposes metadata in production | Backend — `publicFestRoute.js` |
| 16 | **Medium** | Dual parallel registration systems (modern vs legacy) cause data fragmentation | Full stack |
| 17 | **Medium** | No error monitoring (Sentry configured in env example but not integrated) | Full stack |
| 18 | **Medium** | AdminProtectedRoute checks token presence only, not validity/expiry | Frontend |
| 19 | **Low** | In-memory fest cache incompatible with horizontal scaling | Backend |
| 20 | **Low** | Dead dependencies (`twilio`, `firebase` backend, `better-auth`) and orphan components increase attack surface and confusion | Full stack |

---

## Appendix: Environment Variables

### Backend (from `.env.example` + codebase)

| Variable | Required (prod) | Purpose |
|----------|-----------------|---------|
| `MONGODB_URI` | **Yes** | Database |
| `JWT_SECRET` | **Yes** | Token signing |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Recommended | Admin login |
| `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_ENV` | Recommended | Payments |
| `FRONTEND_URL` | Optional | Cashfree return URL |
| `CLOUDINARY_*` | Optional | Media uploads |
| `RESEND_API_KEY`, `RESEND_FROM` | Optional | Email |
| `EMAIL_USER`, `EMAIL_PASS` | Optional | SMTP fallback |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Optional | Sheets |
| `GOOGLE_PRIVATE_KEY_ID`, `GOOGLE_CLIENT_ID` | Optional | Admin Sheets test only |
| `FIREBASE_SERVICE_ACCOUNT_KEY` or `PATH` | Optional | Push notifications |
| `PORT`, `HOST`, `NODE_ENV` | Runtime | Server config |

### Frontend (from `.env.example` + `vercel.json`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | API endpoint |
| `VITE_API_TIMEOUT` | Request timeout |
| `VITE_CASHFREE_MODE` | `production` / `sandbox` |
| `VITE_FIREBASE_*` | Firebase client config |
| `VITE_FIREBASE_VAPID_KEY` | FCM web push |
| `VITE_JWT_TOKEN_KEY` | localStorage key (default `crwdctrl_token`) |
| `VITE_ENABLE_*` | Feature flags (unused in code) |
| `VITE_GOOGLE_ANALYTICS_ID`, `VITE_SENTRY_DSN`, `VITE_HOTJAR_ID` | Not integrated |

---

## Appendix: Deployment Configuration

| Component | Platform | Config file | Notes |
|-----------|----------|-------------|-------|
| Frontend | Vercel | `frontend/vercel.json` | SPA rewrite, env vars embedded |
| Backend | Railway | `backend/nixpacks.toml` | Node 20, `npm start` |
| Keep-alive | GitHub Actions | `.github/workflows/keep-alive.yml` | Pings Railway every 5 minutes |
| PWA | Vite | `frontend/vite.config.js` | Service worker, manifest |
| Backend health | Express | `/api/health`, `/api/keep-alive` | DB status in health response |

---

*End of audit. No code was modified during this review.*
