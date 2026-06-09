# Production Hardening — Phase 2

**Date:** June 9, 2026  
**Baseline:** Security Phase 1 launch score **62/100**  
**Updated launch readiness score:** **78/100**

This document records production-readiness work across observability, database, routing, security, and deployment verification. No UI redesign or new product features were added.

---

## Summary of Changes

| # | Area | Status | What changed |
|---|------|--------|--------------|
| 1 | Sentry error monitoring | ✅ | `@sentry/node` (backend) + `@sentry/react` (frontend); optional via `SENTRY_DSN` / `VITE_SENTRY_DSN` |
| 2 | Centralized logging | ✅ | Structured JSON logger in production; request lifecycle logging; error handler integration |
| 3 | MongoDB index optimization | ✅ | Compound indexes on Registration, PaymentOrder, FestOrganizer, Theatre; `syncIndexes()` on prod startup |
| 4 | DB connection readiness | ✅ | Server waits for MongoDB before listening; `/api/health` returns 503 when DB down; new `/api/ready` |
| 5 | Environment validation | ✅ | Stricter production env checks (Cashfree, admin hash, FRONTEND_URL, JWT length) |
| 6 | Admin route security | ✅ | `GET /api/admin/verify`; admin login rate limit; `AdminProtectedRoute` validates token + server verify |
| 7 | CORS tightening | ✅ | Removed `*.vercel.app` wildcard; explicit allowlist + `CORS_EXTRA_ORIGINS` env |
| 8 | Debug endpoints removed from prod | ✅ | `devOnly` on fest debug, registration debug, trek-community ping |
| 9 | `/dashboard` route fix | ✅ | Route added → renders existing `Dashboard` component |
| 10 | `/theatre` route fix | ✅ | Public `GET /api/theatre` + `theatre-page.jsx` + `/theatre` route |
| 11 | Reminder cron | ✅ | `initReminderCron()` wired in `server.js` after DB connect |
| 12 | Rate limiting review | ✅ | `adminAuthLimiter`, `registrationLimiter`; existing limits retained |
| 13 | Deployment verification | ✅ | `scripts/verify-deploy.js` + `npm run verify-deploy` |

---

## Files Created

| File | Purpose |
|------|---------|
| `backend/src/utils/logger.js` | Centralized structured logging |
| `backend/src/config/sentry.js` | Sentry initialization (backend) |
| `backend/src/routers/publicTheatreRoute.js` | Public theatre listing API |
| `backend/scripts/verify-deploy.js` | Post-deploy health/readiness checks |
| `frontend/src/utils/sentry.js` | Sentry initialization (frontend) |
| `frontend/src/components/pages/theatre-page.jsx` | Public theatre browse page |
| `PRODUCTION_HARDENING.md` | This document |

---

## Files Modified

### Backend

| File | Changes |
|------|---------|
| `backend/src/server.js` | Await DB before listen; Sentry init; reminder cron; structured shutdown logging |
| `backend/src/app.js` | `/api/ready`; health returns 503 when DB disconnected |
| `backend/src/config/db.js` | `isDbReady()`; production `syncIndexes()`; logger integration |
| `backend/src/config/requiredEnv.js` | Expanded production required/recommended vars |
| `backend/src/config/cors.js` | Removed wildcard; `CORS_EXTRA_ORIGINS` support |
| `backend/src/middleware/errorHandler.js` | Logger + Sentry on 5xx |
| `backend/src/middleware/requestLogger.js` | Structured request logging (prod) |
| `backend/src/middleware/adminAuth.js` | Reduced verbose logging in production |
| `backend/src/middleware/rateLimiter.js` | `adminAuthLimiter`, `registrationLimiter` |
| `backend/src/routers/publicFestRoute.js` | `devOnly` on `/:id/debug` |
| `backend/src/routers/registrationRoute.js` | `devOnly` on debug routes; `registrationLimiter` on fest register |
| `backend/src/routers/adminRoute.js` | Admin login rate limit; `GET /verify` |
| `backend/src/routers/adminTrekCommunityRoute.js` | `devOnly` on `/ping` |
| `backend/src/routes/index.js` | Mount `/theatre` public routes |
| `backend/src/services/reminderService.js` | Logger instead of raw console |
| `backend/src/model/registration_model.js` | User/fest/reminder compound indexes |
| `backend/src/model/payment_order_model.js` | userId + status indexes |
| `backend/src/model/fest_organizer_model.js` | status/approval/priority indexes |
| `backend/src/model/theatre_model.js` | Compound listing index |
| `backend/.env.example` | `SENTRY_DSN`, `CORS_EXTRA_ORIGINS` |
| `backend/package.json` | `@sentry/node`; `verify-deploy` script |

### Frontend

| File | Changes |
|------|---------|
| `frontend/src/main.jsx` | Sentry init on boot |
| `frontend/src/App.jsx` | `/dashboard`, `/theatre` routes |
| `frontend/src/components/ErrorBoundary.jsx` | Sentry capture |
| `frontend/src/components/admin/AdminProtectedRoute.jsx` | JWT expiry + `/admin/verify` |
| `frontend/package.json` | `@sentry/react`; `verify-build` script |

---

## Deployment Checklist

### Railway (backend)

1. Set or confirm production env vars:
   - `MONGODB_URI`, `JWT_SECRET` (≥32 chars)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`
   - `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_ENV`
   - `FRONTEND_URL=https://www.crwdctrl.in`
   - `FIREBASE_SERVICE_ACCOUNT_KEY`
   - `SENTRY_DSN` (recommended)
   - `CORS_EXTRA_ORIGINS` (only if you need extra preview URLs)

2. Deploy backend, then verify:
   ```bash
   cd backend
   npm run verify-deploy -- https://crwdctrl-production-9c58.up.railway.app
   ```

3. Confirm logs show:
   - `MongoDB connection successful`
   - `Event reminder cron initialized`

### Vercel (frontend)

1. Set `VITE_SENTRY_DSN` (recommended)
2. Deploy frontend
3. Verify:
   - `/dashboard` loads home dashboard
   - `/theatre` loads theatre listing
   - Admin routes redirect to login when token missing/expired

---

## Launch Readiness Score

| Category | Before (Phase 1) | After (Phase 2) | Notes |
|----------|------------------|-----------------|-------|
| Security | 14/20 | 17/20 | CORS, debug lockdown, admin verify |
| Payments | 12/15 | 12/15 | Unchanged from Phase 1 |
| Auth | 10/15 | 11/15 | Admin session validation improved |
| Observability | 2/10 | 8/10 | Sentry + structured logging |
| Data layer | 8/12 | 11/12 | Indexes + readiness checks |
| Routing / UX stability | 6/12 | 10/12 | Dashboard + theatre fixed |
| Ops / deploy | 5/10 | 9/10 | verify-deploy, ready endpoint, cron |
| Testing | 0/6 | 0/6 | Still no automated tests |
| **Total** | **62/100** | **78/100** | |

---

## Remaining Risks

| Severity | Risk | Mitigation path |
|----------|------|-----------------|
| **High** | JWT stored in `localStorage` (XSS token theft) | Move to httpOnly cookies or session-based auth |
| **High** | Firebase/API keys in frontend bundle (`vercel.json`, service worker) | Use env-only injection; rotate exposed keys |
| **Medium** | No automated test suite | Add API integration tests for auth, payments, registrations |
| **Medium** | Sentry not active until DSN env vars set | Configure `SENTRY_DSN` + `VITE_SENTRY_DSN` in Railway/Vercel |
| **Medium** | Reminder cron uses string `festDate` parsing | Normalize fest dates to ISO Date in schema |
| **Medium** | In-memory fest cache not replica-safe | Redis or DB-backed cache for multi-instance Railway |
| **Low** | `AdminDashboard.jsx` orphan still calls `/admin/dashboard` | Page unused in router; safe to delete later |
| **Low** | Preview Vercel deploys need explicit CORS entry | Add preview URL to `CORS_EXTRA_ORIGINS` |

---

## Verification Performed

- [x] Frontend production build (`npm run build`) succeeds
- [x] Backend modules load without syntax errors
- [x] `/dashboard` route registered
- [x] `/theatre` route + public API registered
- [x] Debug routes gated with `devOnly`
- [x] Reminder cron initialized from `server.js`
- [ ] Live production verify-deploy (run after deploy with Railway URL)

---

## Related Documents

- `PROJECT_AUDIT.md` — Initial full audit (54/100)
- `SECURITY_FIXES_PHASE1.md` — Payment/auth security fixes (62/100)
