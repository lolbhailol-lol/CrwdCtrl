# CrwdCtrl Production Audit — Verified Findings Register

**Date:** 2026-08-17
**Method:** Static code inspection, import-graph tracing, verified from repository code (not hypothetical).
**Scope:** Full monorepo (`backend/`, `frontend/`, `treks/`, mobile Capacitor).

---

## How to read this document

Each finding lists severity, the exact file and code path, root cause, and fix status. Severities:

- **HIGH** — data loss, RCE, financial fraud, cross-user access, mass account compromise.
- **MEDIUM** — meaningful risk but limited blast radius, hardening opportunities.
- **LOW** — code smell with theoretical risk, or defense-in-depth.

Status legend: `open` (found and unfixed), `fixed` (this audit), `mitigated` (partial), `wontfix` (accepted risk).

---

## Wave 1 — P0 Security & Production Bugs

### H1 — Public payment verify endpoints (Cashfree trek/sports)

- **Severity:** HIGH
- **Files:** [backend/src/routers/paymentRoute.js](backend/src/routers/paymentRoute.js) lines 11, 13; [backend/src/controllers/paymentController.js](backend/src/controllers/paymentController.js) `verifyTrekPayment`, `verifySportsPayment`
- **Root cause:** `POST /api/payment/trek-verify` and `/api/payment/sports-verify` are mounted without any auth middleware. Anyone with a leaked `orderId` (24-char hex) can call Cashfree verify, mark the `PaymentOrder` `PAID`, and receive a signed `paymentProof` JWT usable to complete a registration.
- **Impact:** Fraudulent booking confirmation, replay attacks against paid orders, order-status pollution.
- **Fix:** Attach `optionalAuthenticateToken`; enforce ownership on `PaymentOrder` (userId must match the authenticated user when the order has one); return cached success without re-hitting Cashfree when the order is already `PAID` (idempotent).
- **Status:** **fixed** (Wave 1.1)

### H2 — reCAPTCHA middleware fails open

- **Severity:** HIGH
- **File:** [backend/src/middleware/recaptcha.js](backend/src/middleware/recaptcha.js)
- **Root cause:** `verifyRecaptcha` returns `next()` when the client omits a token (line 21-32) and when Google is unreachable (line 66-69), even in production. Combined with the absence of `verifyRecaptcha` on `/social-auth`, bots can enumerate credentials or spam account creation limited only by rate-limiter windows.
- **Fix:** Fail closed in production when `RECAPTCHA_SECRET_KEY` is configured and the client sends no token. Keep dev/staging permissive. Extend to `/social-auth`.
- **Status:** **fixed** (Wave 1.2)

### H3 — Offline bundle signing key reuses JWT_SECRET

- **Severity:** HIGH (Campus Hunt only, feature-flagged)
- **File:** [backend/src/modules/campus-hunt/services/offlineExportService.js](backend/src/modules/campus-hunt/services/offlineExportService.js) `bundleSigningKey()` (line 64-72)
- **Root cause:** Falls back to `JWT_SECRET` and finally a hardcoded literal. A compromise of either key allows forging offline progress signatures and altering leaderboard input.
- **Fix:** Require `OFFLINE_BUNDLE_KEY` in `requiredEnv.js` when `CAMPUS_HUNT_ENABLED=true`; refuse to boot without it in production.
- **Status:** **fixed** (Wave 1.3)

### H4 — CompetitionRegistration indexes never created

- **Severity:** HIGH (performance)
- **File:** [backend/src/model/competition_registration_model.js](backend/src/model/competition_registration_model.js) line 146-154
- **Root cause:** Uses `indexes: [...]` inside schema options — Mongoose ignores this. Only the implicit `_id` index and `registrationId`'s unique index exist. Every list/query by `email`, `competitionName`, `status`, or `submittedAt` scans the collection.
- **Fix:** Replace with `schema.index(...)` calls.
- **Status:** **fixed** (Wave 1.4)

### M1 — Organizer portals only check client-side token presence

- **Severity:** MEDIUM
- **Files:** [frontend/src/pages/fest-organizer/FestOrganizerProtectedRoute.jsx](frontend/src/pages/fest-organizer/FestOrganizerProtectedRoute.jsx), [frontend/src/pages/trek-organizer/TrekOrganizerProtectedRoute.jsx](frontend/src/pages/trek-organizer/TrekOrganizerProtectedRoute.jsx)
- **Root cause:** Only checks `localStorage` presence, not JWT expiry. Backend still enforces auth on each API call, but stale tokens produce a flurry of 401s and a poor UX. `run-club` and `event-organizer` routes already do expiry checks.
- **Fix:** Extend fest/trek guards to check JWT `exp` client-side (same pattern as `isRunClubOrganizerTokenExpired`).
- **Status:** **fixed** (Wave 1.5)

### M2 — Sensitive User fields exposed by default

- **Severity:** MEDIUM
- **File:** [backend/src/model/usermodel.js](backend/src/model/usermodel.js) `password`, `otp`, `otpExpires`
- **Root cause:** Fields lack `select: false`. Every `User.find*()` without a projection returns hashed password + active OTP.
- **Fix:** Add `select: false`; opt-in with `.select('+password')` in login (`user.comparePassword` is a method — the doc must include the field for it to work).
- **Status:** **fixed** (Wave 1.6)

### M3 — Campus Hunt hardcoded default password

- **Severity:** MEDIUM (Campus Hunt only)
- **File:** [backend/src/modules/campus-hunt/services/rosterProvisionService.js](backend/src/modules/campus-hunt/services/rosterProvisionService.js) `repairTeamRoster` default `HUNT2026`
- **Root cause:** If admin triggers `repair` without a password, all provisioned users share `HUNT2026`. Not exploitable unless the endpoint is exposed to a real event, but a foot-gun in production.
- **Fix:** Require passwords or auto-generate strong ones in production; keep the demo default only when `NODE_ENV !== 'production'`.
- **Status:** **fixed** (Wave 1.7)

### M4 — Cashfree webhook secret not required in production

- **Severity:** MEDIUM
- **File:** [backend/src/config/requiredEnv.js](backend/src/config/requiredEnv.js)
- **Root cause:** `CASHFREE_WEBHOOK_SECRET` is not required. When missing, `verifyWebhookSignature` falls back to `CASHFREE_CLIENT_SECRET` — usable but discouraged.
- **Fix:** Add to production `recommended` warn list (already elevated in Wave 1.3 change).
- **Status:** **fixed** (Wave 1.3)

### M5 — Legacy `/api/qr/checkin` uses adminAuth

- **Severity:** MEDIUM (legacy path)
- **File:** [backend/src/routers/qrRoute.js](backend/src/routers/qrRoute.js) lines 23-24
- **Root cause:** Fest check-in should use scanner-scoped JWT (`scannerAuth`), not the master admin token. `/api/scanner/:festId/checkin` is the correct path.
- **Fix:** Add doc comment noting this is legacy; keep behavior (any admin can check-in) but log usage. Migration to scannerAuth deferred as it requires client changes.
- **Status:** **mitigated** (Wave 1.8 — documented, no client uses this path per audit)

### M6 — Verbose admin `console.log` in production

- **Severity:** LOW (was labelled L4)
- **File:** [backend/src/routers/adminRoute.js](backend/src/routers/adminRoute.js) `PUT /competitions/:competitionId` handler
- **Root cause:** Dumps the entire request body and competition state to stdout on every competition update. On Railway logs, these persist and may contain payment QR configs or PII in registration fields.
- **Fix:** Reduce to a single structured log with competition ID + timestamp; drop body dumps.
- **Status:** **fixed** (Wave 1.8)

### M7 — Legacy organizer mass-assignment

- **Severity:** MEDIUM
- **File:** [backend/src/controllers/festOrganizerController.js](backend/src/controllers/festOrganizerController.js) `updateEvent`, `updateCompetition` (lines 1081, 1121)
- **Root cause:** Iterates `Object.keys(req.body)` and assigns to the document. An attacker with an organizer JWT could set fields not on the intended form (e.g., `organizer` reference, sensitive counters).
- **Fix:** Add a per-model allowlist. Ownership check already limits blast radius to the organizer's own resources, but ID fields must never be mass-assigned.
- **Status:** **fixed** (Wave 1.8)

---

## Wave 2 — Performance & Scalability

### P1 — Missing index on EventShowRegistration.qrCodeData

- **Severity:** MEDIUM (peak event day)
- **File:** [backend/src/model/event_show_registration_model.js](backend/src/model/event_show_registration_model.js)
- **Root cause:** Check-in path calls `EventShowRegistration.findOne({ qrCodeData })` ([backend/src/utils/qrCheckin.js](backend/src/utils/qrCheckin.js) line 50) but no index on the field.
- **Fix:** Add sparse index; unique blocked because legacy records may share `null`.
- **Status:** **fixed** (Wave 2)

### P2 — QR check-in sequential collection scans

- **Severity:** MEDIUM
- **File:** [backend/src/utils/qrCheckin.js](backend/src/utils/qrCheckin.js) `resolveCheckinRecord`
- **Root cause:** 4 sequential `findOne` calls when only one collection actually holds the record. Latency compounds during event-day peak.
- **Fix:** Parallel `Promise.all` with early-exit — issue all four queries at once; first non-null wins.
- **Status:** **fixed** (Wave 2)

### P3 — Leaderboard rebuild for single-team standing

- **Severity:** MEDIUM (Campus Hunt only)
- **File:** [backend/src/modules/campus-hunt/services/leaderboardService.js](backend/src/modules/campus-hunt/services/leaderboardService.js) `standingForTeam`
- **Root cause:** Reruns the full leaderboard query + ranking for every single-team standing request. Fine at 40 teams; wasteful when polled by 40 players simultaneously.
- **Fix:** Same call for now (pool is small). Documented; not fixed unless we see load. Add short-term (5s) in-memory cache in later waves.
- **Status:** **wontfix** (P4 escalation only if load justifies it — bounded pool)

### P4 — Roster lookups per member

- **Severity:** LOW
- **File:** [backend/src/modules/campus-hunt/services/teamGateService.js](backend/src/modules/campus-hunt/services/teamGateService.js) `setTeamSharedPassword`
- **Root cause:** `Promise.all(rosterIds.map(User.findById))` — N round trips per team.
- **Fix:** Single `User.find({ _id: { $in: rosterIds } })`.
- **Status:** **fixed** (Wave 2)

---

## Wave 3 — Reliability & Observability

### R1 — `/api/health` leaks Firebase project details

- **Severity:** LOW
- **File:** [backend/src/app.js](backend/src/app.js) lines 95-112
- **Root cause:** Public health endpoint returns `firebase.projectId`, `firebase.error`, `environment`. Minor recon aid; useful for uptime probes but should be minimal in production.
- **Fix:** Trim public payload to `{ ok, status, timestamp }`; keep the verbose form on `/api/ready` (still public — Railway probes) and admin-only endpoints.
- **Status:** **fixed** (Wave 3)

### R2 — Sentry lacks tags for payment/webhook/QR flows

- **Severity:** LOW
- **File:** [backend/src/config/sentry.js](backend/src/config/sentry.js)
- **Root cause:** No structured tags for payment verify failures, webhook signature skips, QR check-in misses. Hard to query in Sentry UI.
- **Fix:** Add tagged Sentry breadcrumbs in `paymentController.verifyPayment`, `paymentWebhookController`, and `qrController.verifyQRFromPayload`.
- **Status:** **fixed** (Wave 3)

### R3 — Payment/auth flows have no integration tests

- **Severity:** MEDIUM
- **Files:** [backend/tests/](backend/tests/)
- **Root cause:** 28 tests, ~24 are Campus Hunt. No coverage of: payment verify auth binding, idempotency, cross-user registration read, reCAPTCHA fail-closed behavior.
- **Fix:** Add pure unit tests where possible (no DB): reCAPTCHA middleware, verify ownership helper, admin field allowlist. Full integration deferred to a dedicated test-infra initiative.
- **Status:** **fixed** (Wave 3 — targeted unit tests added)

---

## Wave 4 — Code Quality & Structure

### Q1 — Duplicate organizer session utilities

- **Severity:** LOW
- **Files:** [frontend/src/utils/festOrganizerSession.js](frontend/src/utils/festOrganizerSession.js), [trekOrganizerSession.js](frontend/src/utils/trekOrganizerSession.js), [runClubOrganizerSession.js](frontend/src/utils/runClubOrganizerSession.js), [eventShowOrganizerSession.js](frontend/src/utils/eventShowOrganizerSession.js)
- **Root cause:** 4 near-identical modules with the same read/write/token/expiry pattern.
- **Fix:** Extract a small `createPortalSession(storageKey, memoryKey)` factory that returns the same public API. Keep existing named exports so call sites don't change.
- **Status:** **fixed** (Wave 4)

### Q2 — Mega-files (>1.7k lines) block bug isolation

- **Severity:** LOW (chronic maintainability debt)
- **Files:** `Competition_Modal.jsx` (2601), `FestFormModal.jsx` (2430), etc.
- **Root cause:** Historical incremental growth.
- **Fix:** **Deferred** — only refactor when fixing a bug in that file, per plan Rule 4.1.
- **Status:** **wontfix** (rule-bounded; extract on future touch)

---

## Wave 5 — Infrastructure & Runbook

### I1 — Deployment runbook missing pre/post-deploy smoke

- **Severity:** LOW
- **File:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Fix:** Extend with a smoke checklist and env matrix.
- **Status:** **fixed** (Wave 5 — RUNBOOK.md added)

### I2 — Untracked Campus Hunt WIP in git status

- **Severity:** INFO
- **Files:** ~45 files under `backend/src/modules/campus-hunt/` and `frontend/src/features/campus-hunt/`
- **Fix:** These were re-scanned as part of this audit; findings above cover them. Not staged/committed by the audit itself — the human maintainer should review the diff and commit intentionally.
- **Status:** **open** (owner decision)

---

## Positive patterns preserved

- Cashfree webhook raw-body HMAC verification before JSON parse ([app.js](backend/src/app.js) line 36-40, [paymentWebhookController.js](backend/src/controllers/paymentWebhookController.js))
- Hunt JWT enforced to `/campus-hunt/*` only ([authmiddleware.js](backend/src/middleware/authmiddleware.js) line 42-50)
- Registration queries scoped to `user: userId` ([registration/queries.js](backend/src/controllers/registration/queries.js))
- Sentry beforeSend strips Authorization headers ([sentry.js](backend/src/config/sentry.js))
- `devOnly` middleware applied consistently to debug routes
- Rate limiters tuned per surface (auth, payment, scanner, campus-hunt)
- Production env assertion on boot ([requiredEnv.js](backend/src/config/requiredEnv.js))
- SQLite encryption for offline Campus Hunt data
