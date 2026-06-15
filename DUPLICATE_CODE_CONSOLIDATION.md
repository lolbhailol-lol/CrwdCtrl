# CrwdCtrl — Duplicate Code Consolidation

**Date:** 2026-06-15  
**Based on:** [CODEBASE_CLEANUP_AUDIT.md](./CODEBASE_CLEANUP_AUDIT.md), [CODEBASE_RESTRUCTURING.md](./CODEBASE_RESTRUCTURING.md)  
**Companion:** [DEAD_CODE_REMOVAL.md](./DEAD_CODE_REMOVAL.md)  
**Status:** Phases A + B + C + D complete · Optional Phases 4–8 remain

---

## Why this matters

Duplicate fetch/auth/pricing logic causes **real user-facing bugs**, not just messy code:

| Risk | Example |
|------|---------|
| Stale admin sessions | `SectionManager` used raw `localStorage` token — no refresh on 401 |
| Wrong platform fee | `TrekBookingPage` hardcoded `0.03` instead of `utils/platformFee.js` |
| Payment quote drift | Fest + competition each had copy-pasted `/payment/quote` handlers |
| Env URL inconsistency | 40+ files repeat `VITE_API_BASE_URL \|\| localhost` |

Consolidation fixes bugs **and** makes Phases 4–8 faster.

---

## Health score impact

| Stage | Score | What improved |
|-------|------:|---------------|
| Initial audit | 58 | Baseline |
| After Phases 0–3 (router, pages, API shell) | 76 | Structure |
| After Phase A consolidation | 79 | DRY + admin token refresh + shared payment quote |
| **After Phase B (admin modals)** | **82** | All admin form modals on `adminFetch` — no duplicate token refresh |
| **After Phase C (page fetch + fest triplet)** | **84** | Shared `publicFetchJSONRetry`, `FestTypePage`, centralized API URL |
| **After Phase D (auth & legacy API)** | **86** | `auth.api.js`, bookings strict fetch, zero direct `utils/api` page imports |
| After optional Phases 4–8 | **88–90** | CSS split, features folder, backend modules |

### Dimension changes (Phase A)

| Dimension | 76 → 79 | Reason |
|-----------|--------:|--------|
| DRY / duplication | +6 | Removed ~120 lines of duplicate fetch helpers |
| Reference integrity | +2 | Single fee rate, admin refresh on section manager |
| Maintainability | +2 | Layout folder, CSS tokens extracted |
| Structure | +1 | `components/layout/`, `styles/tokens.css` started |

### Dimension changes (Phase B)

| Dimension | 79 → 82 | Reason |
|-----------|--------:|--------|
| DRY / duplication | +4 | Removed ~250 lines of duplicate admin fetch/token logic |
| Reference integrity | +2 | Single admin HTTP path for all form modals |
| Maintainability | +2 | Upload + CRUD + clear-cache all use same retry semantics |
| Bug risk | −1 | Fewer stale-token failures on long admin sessions |

---

## What you get (benefits)

### For users
- **Fewer admin logouts** when editing homepage sections (token refresh via `adminFetch`)
- **Consistent pricing** on trek bookings (same 3% rule as fest/competition flows)
- **More reliable notifications** (shared auth fetch, no duplicate token logic)
- **Same URLs and UI** — no visible breaking changes

### For developers
- **One place to change API base URL** → `services/api/client.js`
- **One place for admin HTTP** → `services/api/admin.api.js`
- **One place for payment quotes** → `services/api/payment.api.js`
- **Layout components grouped** → `components/layout/` (shims keep old imports working)
- **Design tokens separated** → `styles/tokens.css` (Phase 5 started)

### For the codebase
- ~**120 lines** of duplicate helpers removed in Phase A
- ~**250+ lines** removed in Phase B (admin modals → `adminFetch`)
- ~**350+ lines** removed in Phase C (fest triplet, fetchJSON helpers, API URL imports)
- Backend `modules/` (Phase 7–8) unlocks isolated testing per domain

---

## Consolidation map

```
services/api/
├── client.js           ✅ resolveUrl, publicFetch, userFetchJSON
├── admin.api.js        ✅ adminFetch, adminFetchJSON, getAdminToken
├── search.api.js       ✅ fest/competition search
├── payment.api.js      ✅ fetchPaymentQuote (NEW)
├── fests.api.js        ✅ fetchRawPublicFests, fetchPublicFestsByType (NEW)
├── public.api.js       ✅ trek community + run club detail fetches (NEW)
├── auth.api.js         ⏳ shim only — migrate AuthContext.apiCall
├── registration.api.js ⏳ pay-and-register, my-registrations
├── fests.api.js        ⏳ fetchAllFests, public fest detail
└── notifications.api.js ⏳ optional — NotificationsContext uses userFetchJSON
```

---

## Phase A — Completed (2026-06-15)

| # | Duplicate | Files | Consolidated to | Status |
|---|-----------|-------|-----------------|--------|
| 1 | Inline `authFetch` (admin) | `SectionManager.jsx`, `PageSectionsPage.jsx` | `adminFetch` / `adminFetchJSON` | ✅ |
| 2 | `safe()` manual admin fetch | `SectionManager.jsx` | `adminFetchJSON` | ✅ |
| 3 | Inline `authFetchJSON` (user) | `NotificationsContext.jsx` | `userFetchJSON` from `client.js` | ✅ |
| 4 | Raw `/admin/verify` fetch | `AdminProtectedRoute.jsx` | `adminFetch` | ✅ |
| 5 | `Math.ceil(baseFee * 0.03)` | `TrekBookingPage.jsx` | `calculatePlatformFee()` | ✅ |
| 6 | `fetchPaymentQuote` copy | `FestRegistration.jsx`, `CompetitionRegistration.jsx` | `payment.api.js` | ✅ |
| 7 | Layout components flat | `Sidebar`, `Navbar`, `Footer`, etc. | `components/layout/` + shims | ✅ |
| 8 | CSS design tokens in monolith | `index.css` lines 1–73 | `styles/tokens.css` | ✅ (partial Phase 5) |

### Verification

```
frontend: npm run build  ✅
frontend: npm run lint    ✅
```

---

## Phase B — Admin modals — Completed (2026-06-15)

| Duplicate | Files | Consolidated to | Status |
|-----------|-------|-----------------|--------|
| `refreshAdminToken` copy | `FestFormModal.jsx`, `Competition_Modal.jsx` | `adminFetch` (auto-refresh) | ✅ |
| Raw `fetch` + Bearer | 7 admin form modals | `adminFetch` / `adminFetchJSON` | ✅ |
| Manual clear-cache fetch | `FestFormModal.jsx`, `Competition_Modal.jsx` | `adminFetch('/admin/clear-cache')` | ✅ |

**Migrated files (7):** `EventShowFormModal`, `SportsFormModal`, `RunClubFormModal`, `TrekCommunityFormModal`, `TrekFormModal`, `FestFormModal`, `Competition_Modal`.

**Import convention:** `import { adminFetch, adminFetchJSON } from '../../utils/adminApi'`

- JSON CRUD → `adminFetchJSON(path, { method, body })`
- FormData uploads → `adminFetch('/admin/upload/images', { method: 'POST', body: fd })`
- No manual token refresh — `adminFetch` handles 401 retry + redirect

**Out of scope (unchanged):** `CheckinScannerPage.jsx` still reads `admin_token` from localStorage for scanner QR flow.

### Verification

```
frontend: npm run build  ✅
frontend: npm run lint    ✅
```

---

## Phase B follow-up — Inline `API_BASE_URL` (mostly done)

| Duplicate | Files | Target | Status |
|-----------|-------|--------|--------|
| Inline `API_BASE_URL` | ~20 pages + components | `services/api/client.js` | ✅ (pages) |
| Remaining | `AuthContext.jsx`, `ConnectionStatus.jsx` | Phase D / diagnostic | ⏳ |

---

## Phase C — Page-level fetch helpers — Completed (2026-06-15)

| Duplicate | Files | Consolidated to | Status |
|-----------|-------|-----------------|--------|
| `fetchJSON` + iOS retry | `view-details`, `competition-list`, `Competitions-view-details`, `Dashboard`, `treks-page` | `publicFetchJSONRetry` in `client.js` | ✅ |
| `/fests/all` inline fetch | `cultural-fest`, `tech-fest`, `sports-fest`, `FestsPage` | `fests.api.js` | ✅ |
| Fest subpage triplet | `cultural-fest`, `tech-fest`, `sports-fest` | Shared `FestTypePage.jsx` | ✅ |
| Community detail pair | `CommunityDetailPage`, `RunClubDetailPage` | `public.api.js` | ✅ |
| Page sections fetch | `CustomPageSectionsRenderer` | `publicFetchJSONRetry` | ✅ |
| Inline API URL (batch) | 12+ pages, `App.jsx`, `analyticsService` | `API_BASE_URL` / `resolveUrl` from `client.js` | ✅ |

### New shared modules

- **`client.js`** — `publicFetchJSONRetry(path, { timeout, retries, cacheBust })` with exponential backoff
- **`fests.api.js`** — `fetchRawPublicFests()`, `fetchPublicFestsByType(festType)`
- **`public.api.js`** — `fetchTrekCommunity`, `fetchTreksByCommunity`, `fetchRunClub`, `fetchSportsByRunClub`
- **`FestTypePage.jsx`** — single component; cultural/tech/sports pages are thin wrappers

### Verification

```
frontend: npm run build  ✅
frontend: npm run lint    ✅
```

---

## Phase D — Context & legacy API — Completed (2026-06-15)

| Duplicate | Files | Consolidated to | Status |
|-----------|-------|-----------------|--------|
| `apiCall` helper | `AuthContext.jsx` | `userApiCall` in `auth.api.js` | ✅ |
| `validateToken` | `AuthContext.jsx` | `validateUserToken` in `auth.api.js` | ✅ |
| `getAuthHeaders` | `AuthContext.jsx` | `getUserAuthHeaders` in `auth.api.js` | ✅ |
| Raw auth fetch | `profile/booking.jsx` | `fetchMyRegistrations`, `fetchMySportsRegistrations` | ✅ |
| `utils/api.js` direct imports | 4 files | `services/api/auth.api.js` shim | ✅ |
| Inline API URL | `ConnectionStatus.jsx` | `API_BASE_URL` / `resolveUrl` | ✅ |
| `analyticsService.js` | 1 file | `resolveUrl` (Phase C) | ✅ |

**Legacy retained:** `utils/api.js` — login/register/profile only; marked legacy; no page-level imports.

### Verification

```
frontend: npm run build       ✅
frontend: npm run lint        ✅
frontend: npm run verify-build ✅
backend:  npm run verify-deploy ✅
```

See **[FINAL_AUDIT_REPORT.md](./FINAL_AUDIT_REPORT.md)** for full dimension scores and deploy checklist.

---

## Phases 4–8 cross-reference

| Restructuring phase | Consolidation overlap |
|--------------------|------------------------|
| **Phase 4** — `features/admin/components/` | Move admin modals after Phase B `adminFetch` migration |
| **Phase 5** — CSS split | `styles/tokens.css` done; next: `layout.css`, `cards.css` |
| **Phase 6** — Backend naming | Independent of frontend DRY |
| **Phase 7** — `backend/modules/` | Group controllers by domain |
| **Phase 8** — Mega-file splits | `registrationController`, `adminRoute`, fest modals |

---

## Rules for safe consolidation

1. **Move calls, not behavior** — same endpoints, same headers, same error handling semantics.
2. **One PR per pattern** — e.g. admin modals separate from fest subpage merge.
3. **Keep shims** until all imports updated (`utils/adminApi.js` pattern).
4. **Test after each batch:** login, fest register, trek book, admin sections, notifications bell.
5. **Never change API response shapes** during consolidation PRs.

---

## Manual test checklist

After each consolidation batch:

- [ ] Home loads, search works
- [ ] Fest detail → register → payment quote
- [ ] Competition registration quote
- [ ] Trek booking fee breakdown matches fest (3% platform fee)
- [ ] Admin → Section Manager save + reorder
- [ ] Admin → Page Sections reorder
- [ ] Notification bell (logged in)
- [ ] Admin login + verify route
- [ ] Light/dark mode (after CSS changes)

---

## Score projection (full roadmap)

| Milestone | Score | Cumulative work |
|-----------|------:|-----------------|
| Audit baseline | 58 | — |
| Phase 0 cleanup | 68 | Dead code removed |
| Phases 1–3 | 76 | Router, pages, API shell |
| Phase A consolidation | 79 | Safe wins — done |
| **Phase B (admin modals)** | **82** | All form modals on `adminFetch` — done |
| **Phase C (page fetch + fest triplet)** | **84** | Shared fetch helpers + FestTypePage — done |
| **Phase D (auth & legacy API)** | **86** | auth.api.js + bookings — done |
| Optional Phases 4–8 | 88–90 | CSS split, features folder, backend modules |

**Target for production-grade maintainability: 85+** — **achieved (86)**

---

## Related files

| Document | Purpose |
|----------|---------|
| [CODEBASE_CLEANUP_AUDIT.md](./CODEBASE_CLEANUP_AUDIT.md) | Original audit + updated scores |
| [CODEBASE_RESTRUCTURING.md](./CODEBASE_RESTRUCTURING.md) | 8-phase migration plan |
| [FINAL_AUDIT_REPORT.md](./FINAL_AUDIT_REPORT.md) | **Final scores (86/100) + deploy readiness** |

---

*Phases A–D complete. Final scores and deploy checklist: [FINAL_AUDIT_REPORT.md](./FINAL_AUDIT_REPORT.md).*
