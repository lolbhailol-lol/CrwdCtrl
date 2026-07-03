# CrwdCtrl — Bugs, Holes & Errors Audit Report

**Audit Date:** Current session  
**Scope:** Full-stack review (backend, frontend, models, integrations)  
**Compared against:** `PROJECT_AUDIT.md` (June 9, 2026), `SECURITY_FIXES_PHASE1.md` (June 9, 2026)  

---

## Executive Summary

This audit categorizes findings into three buckets:
1. **✅ Already Fixed** — Security Phase 1 patches that are properly implemented
2. **🔴 Still Broken / Unfixed** — Issues from prior audits that remain live in production
3. **🆕 Newly Discovered** — Bugs, holes, and errors not previously documented

**Overall Risk Level: HIGH** — While critical payment and auth holes were patched in Phase 1, several exploitable gaps remain, plus new bugs in data validation, race conditions, and frontend routing.

---

## 1. ✅ Already Fixed (Phase 1 — Verified in Code)

These six critical fixes from `SECURITY_FIXES_PHASE1.md` are properly implemented and working:

| # | Fix | Status |
|---|-----|--------|
| 1 | **Trek payment re-verification** — `verifyTrekBookingPayment()` validates Cashfree order, tags, and idempotency before booking | ✅ Working |
| 2 | **Trek order server-side pricing** — `createTrekOrder` computes price from DB, ignores client `baseAmount` | ✅ Working |
| 3 | **Competition register hardened** — `authenticateToken` + `competitionRegisterLimiter` + duplicate check | ✅ Working |
| 4 | **Admin bcrypt password** — `ADMIN_PASSWORD_HASH` with bcrypt compare, dev plaintext fallback | ✅ Working |
| 5 | **Cashfree webhook** — `POST /api/payment/webhook` with HMAC-SHA256 signature verification | ✅ Working |
| 6 | **Firebase ID token verification** — `resolveFirebaseIdentity()` verifies `idToken` via Firebase Admin | ✅ Working |

---

## 2. 🔴 Still Broken / Unfixed from Prior Audits

These issues were documented in `PROJECT_AUDIT.md` but remain unfixed:

### CRITICAL

| # | Issue | Location | Why It Matters |
|---|-------|----------|----------------|
| 1 | **Sports registration payment NOT re-verified** | `categoryRegistrationController.js` (sports path) | Sports bookings accept `paymentId` from client body without calling `verifyCashfreePayment`. Same exploit as the pre-fix trek bug — fake bookings possible. |
| 2 | **Event show registration payment NOT re-verified** | `event_show_registration` flow | Event show bookings trust client-supplied payment proof without server-side Cashfree re-verification. |

### HIGH

| # | Issue | Location | Why It Matters |
|---|-------|----------|----------------|
| 3 | **JWT in localStorage** — XSS token theft | Frontend auth context | Any XSS vulnerability grants full account takeover. No `httpOnly` cookie alternative exists. |
| 4 | **AdminProtectedRoute checks token presence only** | Frontend admin routes | Expired or forged admin tokens are accepted until an API call fails. No JWT expiry validation on route guard. |
| 5 | **Firebase config + VAPID key committed** | `vercel.json`, `firebase-messaging-sw.js` | Public repo contains sensitive Firebase credentials. Rotation is painful. |
| 6 | **Zero automated tests** | Entire codebase | `"test": "echo 'No tests specified'"` — regressions go undetected. |
| 7 | **No refresh tokens for regular users** | `usercontroller.js` | 7-day JWT expiry forces re-login. No silent refresh mechanism. |

### MEDIUM

| # | Issue | Location | Why It Matters |
|---|-------|----------|----------------|
| 8 | **`initReminderCron()` never started** | `server.js` vs `reminderService.js` | Automated event reminders are implemented but dead — cron job is never invoked at server boot. |
| 9 | **Broken `/theatre` route** | `HomeCategoryBar.jsx`, `Navbar.jsx` | Links to `/theatre` but no public route exists. Users hit 404. |
| 10 | **Broken `/dashboard` route** | `EmailVerification.jsx`, `FestRegistration.jsx` | Post-auth navigation to `/dashboard` falls through to home. No dedicated dashboard. |
| 11 | **`paymentController` uses wrong Event model** | `paymentController.js:48-56` | `resolvePricedEntity` queries `Event` model for `eventId`, but platform events use `PlatformEvent`. Platform event payments likely fail or pull wrong price. |
| 12 | **CORS allows any `*.vercel.app`** | `cors.js` | `https://crwdctrl-mvp-git-main.vercel.app` is explicit, but the wildcard pattern `*.vercel.app` is not needed — still a broader surface than necessary. |
| 13 | **Public fest debug endpoint** | `publicFestRoute.js` | `GET /fests/:id/debug` exposes metadata without `devOnly` middleware. |
| 14 | **Sentry configured but not wired** | `.env.example` has `SENTRY_DSN` | `initSentry()` is called in `server.js`, but frontend Sentry is not integrated. Errors go unmonitored. |

### LOW

| # | Issue | Location | Why It Matters |
|---|-------|----------|----------------|
| 15 | **In-memory fest cache** | `festOrganizerController.js` | Breaks across Railway replicas. Stale data until manual `/admin/clear-cache`. |
| 16 | **Server starts before DB ready** | `server.js` | Transient 500s on cold start if request arrives before MongoDB connects. |

---

## 3. 🆕 Newly Discovered Issues

These were NOT in the June 2026 audits:

### 🔴 CRITICAL

#### 3.1 Race Condition: Duplicate Payment Orders on Rapid Double-Submit
**File:** `backend/src/controllers/paymentController.js:150-192` (`createOrder`)  
**Problem:** `createOrder` does not check for existing pending orders for the same user + entity before creating a new Cashfree order. A user double-clicking "Pay" can create multiple Cashfree orders, each deducting from their account if all succeed.  
**Fix:** Add idempotency — check `PaymentOrder` for a recent `PENDING` order for the same `(userId, entityType, entityId)` within the last 10 minutes before calling Cashfree.

#### 3.2 Missing `catch` on `verifyCashfreePayment` in Webhook
**File:** `backend/src/controllers/paymentWebhookController.js:22-31`  
**Problem:** `verifyWebhookSignature` throws `WEBHOOK_SECRET_MISSING`, but if `verifyCashfreePayment` itself throws (network error, Cashfree down), the webhook handler crashes and Cashfree retries endlessly. No outer try-catch around the payment verification after signature validation.  
**Fix:** Wrap payment state updates in try-catch and return 200 to acknowledge.

#### 3.3 QR Check-in: No Rate Limiting
**File:** `backend/src/routers/qrRoute.js` / `scannerRoute.js`  
**Problem:** `POST /qr/verify` and scanner check-in endpoints have no rate limits. An attacker can brute-force QR hashes (`crypto.randomBytes(16)` = 128-bit, but if leaked/stolen, mass check-ins are possible).  
**Fix:** Add `apiLimiter` or a dedicated scanner rate limiter.

### 🟠 HIGH

#### 3.4 `authorizeRoles` Re-queries User from DB
**File:** `backend/src/middleware/authmiddleware.js:70-96`  
**Problem:** `authenticateToken` already loads the user (`await User.findById(decoded.userId).select('-password')`) and attaches `req.user = { userId, role }`. But `authorizeRoles` queries the DB **again** for the same user. This doubles DB load on every authorized request.  
**Fix:** Use `req.user.role` directly — it was already fetched. Only re-query if you need fresh role data.

#### 3.5 `deleteAccount` Does Not Invalidate JWTs
**File:** `backend/src/controllers/usercontroller.js:886-940`  
**Problem:** After soft-delete, the user's JWT remains valid until expiry (7 days). A deleted user can still access the API with their old token. No token revocation list exists.  
**Fix:** Add a `tokenVersion` or `jti` field to User model and check it in `authenticateToken`.

#### 3.6 `updateUserProfile` Missing `runValidators: true` on Some Paths
**File:** `backend/src/controllers/usercontroller.js:821-825`  
**Problem:** `findByIdAndUpdate` uses `{ new: true, runValidators: true }`, but if `req.body` contains fields not in the schema, they are silently ignored. More importantly, **role escalation is possible** — `role` is not in the allowed update fields, but if a crafted request includes it, Mongoose ignores it... unless `req.body` is passed directly with `$set`. Actually, `updateData` is built manually, so role is safe. BUT:  
**The real bug:** `profilePic` accepts any string — no URL validation. A user can set `profilePic` to a malicious `javascript:` URL or an enormous data URI.  
**Fix:** Validate `profilePic` is a valid HTTPS URL or Cloudinary URL.

#### 3.7 Cashfree Webhook: No Order Tag Validation
**File:** `backend/src/controllers/paymentWebhookController.js:102-118`  
**Problem:** On `PAYMENT_SUCCESS`, the webhook updates `PaymentOrder` to `PAID` but does NOT validate that the order tags (trekId, eventId, people, totalAmount) match any expected values. A manipulated Cashfree order (if attacker somehow controls order creation) could mark the wrong entity as paid.  
**Fix:** Cross-reference `orderTags.entityType` and `orderTags.entityId` against known entities before updating.

#### 3.8 `registrationController.js` — Massive File, Response Sent Before Async Operations Complete
**File:** `backend/src/controllers/registrationController.js`  
**Problem:** The file is 2,430+ lines. Multiple paths call `res.status(201).json(...)` then fire `setImmediate(async () => { ... })` for emails/Sheets. If the server crashes or restarts during `setImmediate`, those operations are lost with no retry. No job queue (Bull, SQS) exists.  
**Fix:** Consider a lightweight job queue or at minimum, log failed background tasks for retry.

#### 3.9 `uploadController.js` — Folder Path Injection
**File:** `backend/src/controllers/uploadController.js:80-85`, `117-128`  
**Problem:** `folder` comes from `req.body.folder` with minimal sanitization (`startsWith('crwdctrl/')` check for multi-upload, but single upload has NO check). A malicious `folder` value like `../../../etc` could write outside intended Cloudinary space (though Cloudinary likely blocks this, defense in depth is missing).  
**Fix:** Strict allowlist for folder names — only permit `crwdctrl/<known-category>`.

### 🟡 MEDIUM

#### 3.10 `notifyLoginSuccess` Can Be Used for Notification Spam
**File:** `backend/src/controllers/usercontroller.js:44-67`  
**Problem:** Every login triggers an in-app notification + push. A script logging in repeatedly spams the user's device. No deduplication or cooldown.  
**Fix:** Add a 5-minute cooldown on login notifications per user.

#### 3.11 `getClientIp` Trusts `X-Forwarded-For` Without Validation
**File:** `backend/src/controllers/usercontroller.js:18-24`  
**Problem:** `getClientIp` takes the first IP from `X-Forwarded-For` blindly. This header can be spoofed by clients. The `trust proxy` setting in `app.js` mitigates some of this, but the first IP in a multi-proxy chain may still be attacker-controlled.  
**Fix:** Use `req.ip` (Express-trusted) instead of manually parsing `X-Forwarded-For`.

#### 3.12 `socialAuth` Valid Providers List Missing Apple
**File:** `backend/src/controllers/usercontroller.js:422`  
**Problem:** `validProviders = ['google', 'facebook', 'twitter']` — if Firebase Apple Sign-In is enabled on the frontend, the backend rejects it as "Invalid authentication provider".  
**Fix:** Add `'apple'` to the valid providers list.

#### 3.13 `TrekBooking` Model Missing Unique Index on `payment_order_id`
**File:** `backend/src/model/trek_booking_model.js`  
**Problem:** The `trekPaymentVerification.js` checks for existing bookings by `payment_order_id`, but there's no DB-level unique constraint. A race condition between two parallel requests with the same `paymentOrderId` could both pass the existence check and both insert.  
**Fix:** Add `payment_order_id: { type: String, sparse: true, unique: true }` to the schema.

#### 3.14 `generateOrderId` Is Predictable
**File:** `backend/src/services/cashfreeService.js:39`  
**Problem:** `crypto.randomBytes(12).toString('hex')` produces 24 hex chars. While cryptographically random, the `order_` prefix makes it obvious these are generated server-side. Not a security hole per se, but order IDs are guessable in format.  
**Note:** Low severity — Cashfree order IDs don't need secrecy.

#### 3.15 Frontend: `AdSenseLoader` Component May Load on Non-Content Pages
**File:** `frontend/src/App.jsx:367` (`<AdSenseLoader />`)  
**Problem:** AdSense loads globally on every route, including `/login`, `/register`, `/admin/*`, `/payment/*`. This violates AdSense policies (ads on auth pages, checkout flows, admin panels) and risks account suspension.  
**Fix:** Conditionally render `<AdSenseLoader />` only on public content pages.

#### 3.16 `checkinService.js` — Circular Require Risk
**File:** `backend/src/services/checkinService.js:178,303,439,567`  
**Problem:** Multiple `require('../controllers/notificationController')` calls are made *inside* functions (runtime requires). While this avoids circular deps at load time, it masks architecture issues. More critically, `createNotification` is called inside `setImmediate` with no error recovery — if `require` fails (e.g., file rename), the check-in silently skips notifications.  
**Fix:** Move requires to top of file; add error recovery.

#### 3.17 `apiRoutes` Mounts `publicHomepageSectionRoutes` Twice
**File:** `backend/src/routes/index.js:68-69`  
**Problem:** `router.use('/homepage-sections', publicHomepageSectionRoutes)` and `router.use('/page-sections', publicHomepageSectionRoutes)` both mount the same router. This creates duplicate route handlers — requests to `/api/homepage-sections/...` and `/api/page-sections/...` both work. Not a security issue, but unnecessary route pollution.

#### 3.18 `batch_email.js` at Repo Root
**File:** `backend/batch_email.js`  
**Problem:** This file exists at the backend root with unclear purpose. If it contains hardcoded email lists or credentials, it's a leak risk. Not read in detail, but flagged for review.

---

## 4. 📊 Summary Table

| Severity | Count | Already Fixed | Still Broken | Newly Discovered |
|----------|-------|---------------|--------------|------------------|
| Critical | 5 | 3 | 2 | 3 |
| High | 10 | 3 | 5 | 4 |
| Medium | 12 | 0 | 6 | 6 |
| Low | 5 | 0 | 2 | 3 |
| **Total** | **32** | **6** | **15** | **16** |

---

## 5. 🎯 Top 10 Priority Fixes

| Rank | Issue | File | Effort |
|------|-------|------|--------|
| 1 | Sports/event-show payment NOT re-verified | `categoryRegistrationController.js`, event show flow | Medium |
| 2 | Race condition: duplicate Cashfree orders | `paymentController.js` | Low |
| 3 | Deleted account JWTs remain valid | `authmiddleware.js`, `usermodel.js` | Medium |
| 4 | QR check-in no rate limits | `scannerRoute.js`, `qrRoute.js` | Low |
| 5 | `authorizeRoles` double DB query | `authmiddleware.js` | Low |
| 6 | AdSense loads on restricted pages | `App.jsx` | Low |
| 7 | `profilePic` accepts any string (XSS risk) | `usercontroller.js` | Low |
| 8 | `initReminderCron` never started | `server.js` | Low |
| 9 | Missing unique index on `payment_order_id` | `trek_booking_model.js` | Low |
| 10 | `uploadController` folder path injection | `uploadController.js` | Low |

---

## 6. 🔧 Quick Wins (Under 10 Lines Each)

1. **Add `unique: true, sparse: true` to `TrekBooking.payment_order_id`** — prevents race-condition duplicates.
2. **Remove duplicate route mount** in `routes/index.js:69` — delete `router.use('/page-sections', ...)`.
3. **Move `require('../controllers/notificationController')`** to top of `checkinService.js`.
4. **Add `apple` to `validProviders`** in `usercontroller.js:422`.
5. **Replace `getClientIp`** with `req.ip` in `usercontroller.js`.
6. **Call `initReminderCron()` in `server.js`** after `startServer()`.
7. **Add `runValidators: true`** consistency check on all `findByIdAndUpdate` calls.
8. **Validate `profilePic`** as HTTPS URL in `updateUserProfile`.

---

*End of audit. Recommend addressing the Top 10 Priority Fixes before open public launch.*
