# CrwdCtrl — Dead Code Removal & Restructuring Log

**Date:** 2026-06-15  
**Based on:** [CODEBASE_CLEANUP_AUDIT.md](./CODEBASE_CLEANUP_AUDIT.md), [CODEBASE_RESTRUCTURING.md](./CODEBASE_RESTRUCTURING.md)  
**Scope:** Phase 0 cleanup + Phases 1–3 restructuring

---

## Health score trajectory

| Stage | Score | What changed |
|-------|------:|--------------|
| Initial audit | 58 / 100 | Baseline |
| After Phase 0 | ~68 / 100 | Dead files + unused deps |
| **After Phases 1–3** | **76 / 100** | Router, `pages/`, `services/api/` |
| **After duplicate consolidation (Phase A)** | **79 / 100** | Shared fetch, payment quote, layout, CSS tokens |

---

## Phase 0 — Dead code removal ✅

### Summary (Phase 0)

| Metric | Count |
|--------|------:|
| Source files deleted | **37** |
| Duplicate asset files deleted | **4** |
| Root package files removed | **2** (`package.json`, `package-lock.json`) |
| npm packages removed (frontend) | **5** |
| npm packages removed (backend) | **3** |
| Dead exports removed | **1** (`verifyPaymentProof`) |
| Broken references fixed | **2** (model registry, stub banner) |
| Frontend packages pruned from lockfile | **35** |
| Backend packages pruned from lockfile | **45** |

---

## Phases 1–3 — Restructuring ✅

### Phase 1 — Router extraction

| Action | Detail |
|--------|--------|
| Created `app/router/` | `index.jsx`, `lazyPages.js`, `publicRoutes.jsx`, `adminRoutes.jsx`, `organizerRoutes.jsx`, `redirects.jsx` |
| Slimmed `App.jsx` | 546 → **393 lines**; routes replaced with `<AppRoutes />` |
| Preserved URLs | All public, admin, organizer paths unchanged |

### Phase 2 — Page moves

| Domain folder | Files | Notes |
|---------------|------:|-------|
| `pages/home/` | 1 | Dashboard (eager-loaded) |
| `pages/auth/` | 3 | login, register, EmailVerification |
| `pages/legal/` | 6 | terms, privacy, contact, etc. |
| `pages/profile/` | 7 | booking, favorites, edit-profile, etc. |
| `pages/payment/` | 3 | checkout, invoice, QR ticket |
| `pages/registration/` | 1 | RegistrationDetails |
| `pages/events/` | 1 | events-page |
| `pages/treks/` | 5 | hub, detail, booking, category, community |
| `pages/sports/` | 4 | category, run club, run event, booking |
| `pages/fests/` | 6 | list, detail, cultural/tech/sports, registration |
| `pages/competitions/` | 4 + subfolder | list, detail, register, registration |
| `pages/admin/` | 13 | layout, dashboard, CRUD pages, section manager |
| `pages/organizer/` | 6 | scanner login, checkin, scan |
| **Total** | **60** | Route screens only |

**Duplicate removal (post-move):** 47 files deleted from `components/pages/` and `components/organizer/` (copies left after `git mv`).

**Admin modals remain** in `components/admin/` (FestFormModal, Competition_Modal, CheckinScannerPage, etc.) — Phase 4 target: `features/admin/components/`.

**Import tooling:** `frontend/scripts/fix-page-imports.mjs` + manual fixes for `compition-register-page/` depth.

### Phase 3 — API layer

| File | Purpose |
|------|---------|
| `services/api/client.js` | `API_BASE_URL`, `resolveUrl`, `publicFetch`, `publicFetchJSON`, `userFetchJSON` |
| `services/api/admin.api.js` | Admin token refresh + `adminFetch` / `adminFetchJSON` |
| `services/api/search.api.js` | Fest/competition search, keywords, upcoming fests |
| `services/api/auth.api.js` | Shim → `utils/api.js` `authAPI` |
| `services/api/index.js` | Barrel export |
| `utils/adminApi.js` | Re-export shim (deprecated path) |
| `services/searchService.js` | Re-export shim (deprecated path) |

**Deferred:** `firebase.js` → `lib/firebase/`, full `authService` migration, page-level inline `fetch` → API modules.

### Verification (2026-06-15)

```
frontend: npm run build  ✅
frontend: npm run lint    ✅
backend:  node -e "require('./src/app')"  ✅
```

---

## Files Deleted

### Superseded components (15)

| File | Reason |
|------|--------|
| `frontend/src/components/EventCard.jsx` | Replaced by `HomeEventCard.jsx` |
| `frontend/src/components/FestCard.jsx` | Replaced by inline `FestEventCard` + `HomeEventCard` |
| `frontend/src/components/TrendingCard.jsx` | Never imported |
| `frontend/src/components/HappeningCard.jsx` | Never imported |
| `frontend/src/components/ViewDetails.jsx` | Superseded by `components/pages/view-details.jsx` |
| `frontend/src/components/LoadingSkeleton.jsx` | Replaced by `HomeEventCardSkeleton.jsx` |
| `frontend/src/components/LoadingBar.jsx` | Only used by dead `withPageLoading` |
| `frontend/src/components/RouteLoader.jsx` | Only used by dead `LoadingBar` |
| `frontend/src/components/withPageLoading.jsx` | HOC never used |
| `frontend/src/components/AppLoadingPage.jsx` | Never imported |
| `frontend/src/components/AuthLoadingPage.jsx` | Never imported |
| `frontend/src/components/LogoSplash.jsx` | Dead splash chain |
| `frontend/src/components/BootSplashOverlay.jsx` | Dead splash chain |
| `frontend/src/components/BootLogoAssemble.jsx` | Dead splash chain |
| `frontend/src/components/EmailVerificationBanner.jsx` | Stub (`return null`); import removed from `App.jsx` |

### Animation duplicates (2)

| File | Reason |
|------|--------|
| `frontend/src/components/animations/StickyBookingBar.jsx` | `motion/StickyCta` used instead |
| `frontend/src/components/animations/variants.js` | Duplicate of `motion/variants.js` |

### Orphan pages (2)

| File | Reason |
|------|--------|
| `frontend/src/components/pages/AdminDashboard.jsx` | Superseded by `admin/AdminDashboardPage.jsx` |
| `frontend/src/components/pages/CompetitionRegistrationsAdmin.jsx` | No route in `App.jsx` |

### Unused hooks (3)

| File | Reason |
|------|--------|
| `frontend/src/hooks/useBottomNavPageBoot.js` | Never imported |
| `frontend/src/hooks/useEnv.js` | Never imported |
| `frontend/src/hooks/useBootSplashTheme.js` | Only used by deleted splash chain |

### Duplicate / dead services & utilities (6)

| File | Reason |
|------|--------|
| `frontend/src/services/apiService.js` | Demo stub; never imported |
| `frontend/src/utils/authFetch.js` | Only used by deleted `apiService.js` |
| `frontend/src/utils/errorHandler.js` | Zero importers |
| `frontend/src/utils/performanceUtils.js` | Zero importers |
| `frontend/src/utils/imageUtils.js` | Duplicate of `fallbackImageGenerator.js` |
| `frontend/src/utils/imagePreprocessor.js` | Only used by deleted static data files |

### Legacy static data (3)

| File | Reason |
|------|--------|
| `frontend/src/data/eventsData.js` | Orphan; fest UI is API-driven |
| `frontend/src/data/comingSoonEvents.js` | Only imported by deleted `eventsData.js` |
| `frontend/src/data/lastYearHitsEvents.js` | Never imported |

### Unused motion components (2)

| File | Reason |
|------|--------|
| `frontend/src/motion/components/StaggerChildren.jsx` | Exported but never consumed |
| `frontend/src/motion/components/SplashScreen.jsx` | Exported but never consumed |

### Duplicate assets (4)

| File | Reason |
|------|--------|
| `frontend/src/assets/mobile-icons/marathon - Copy.png` | Accidental duplicate |
| `frontend/src/assets/mobile-icons/run clubs - Copy.png` | Accidental duplicate |
| `frontend/src/assets/mobile-icons/sports club - Copy.png` | Accidental duplicate |
| `frontend/src/assets/mobile-icons/others - Copy.png` | Accidental duplicate |

### Root orphan package (2)

| File | Reason |
|------|--------|
| `package.json` | Only declared unused `mongodb` dep |
| `package-lock.json` | Lockfile for orphan root package |

**Kept (live):** `frontend/src/data/real-data/competitionDataService.js` and related JSON/images — still powers `/competition-register`.

---

## Code Modified (not deleted)

| File | Change |
|------|--------|
| `frontend/src/App.jsx` | Removed `EmailVerificationBanner` import and render |
| `frontend/src/motion/index.js` | Removed `StaggerChildren` and `SplashScreen` barrel exports |
| `frontend/vite.config.js` | Removed `better-auth`, `react-icons`, `react-responsive`, `react-circular-progressbar` from `manualChunks` |
| `frontend/package.json` | Removed 5 unused dependencies |
| `backend/package.json` | Removed 3 unused dependencies |
| `backend/src/models/index.js` | Added `homepage_section_model` startup registration |
| `backend/src/utils/paymentProof.js` | Removed dead `verifyPaymentProof` export |

---

## Dependencies Removed

### Frontend (`frontend/package.json`)

| Package | Reason |
|---------|--------|
| `axios` | Zero imports; app uses native `fetch` |
| `better-auth` | Zero imports; only referenced in Vite chunk config |
| `react-icons` | Zero imports; app uses `lucide-react` |
| `react-responsive` | Zero imports |
| `react-circular-progressbar` | Zero imports |

**Not removed:** `@capacitor/browser` — synced to Android; may be used at native layer. Evaluate separately with `cap:sync`.

### Backend (`backend/package.json`)

| Package | Reason |
|---------|--------|
| `firebase` (client SDK) | Backend uses `firebase-admin` only |
| `twilio` | Zero imports |
| `node-fetch` | Zero imports; `axios` used in `cashfreeService` |

**Not removed:** `csv-parser` — still used by `backend/batch_email.js`.

### Root

| Package | Reason |
|---------|--------|
| `mongodb` | Entire root `package.json` removed; backend uses `mongoose` |

---

## Build Verification

All checks run on **2026-06-15** after cleanup.

| Check | Command | Result |
|-------|---------|--------|
| Frontend install | `cd frontend && npm install` | ✅ 35 packages removed from tree |
| Frontend production build | `cd frontend && npm run build` | ✅ **Passed** in ~18s (2814 modules) |
| Frontend lint | `cd frontend && npm run lint` | ✅ **Passed** (exit 0) |
| Backend install | `cd backend && npm install` | ✅ 45 packages removed from tree |
| Backend app load | `node -e "require('./src/app')"` | ✅ **Passed** — `backend app loads OK` |
| PWA precache | (part of Vite build) | ✅ 101 entries generated |

### Build notes

- No unresolved module errors after deletions.
- Vite chunk warnings about `login.jsx` / `register.jsx` static+dynamic imports are **pre-existing**, not introduced by this cleanup.
- Precache size dropped slightly: **2264.88 KiB → 2244.36 KiB**.

---

## Remaining cleanup items

### Completed in Phases 1–3

| Item | Status |
|------|--------|
| Move pages out of `components/pages/` → `pages/{domain}/` | ✅ Done |
| Extract router from monolithic `App.jsx` | ✅ Done |
| Consolidate `adminApi` + `searchService` → `services/api/` | ✅ Done (with shims) |
| Delete duplicate `components/pages/` + `components/organizer/` copies | ✅ Done (47 files) |

### Still deferred (Phases 4–8)

| Item | Phase | Priority |
|------|-------|----------|
| Inline `authFetch` in `SectionManager`, `PageSectionsPage`, `NotificationsContext` | 3/4 | Medium |
| Component regroup (`components/layout/`, `features/admin/`) | 4 | Medium |
| `utils/` subfolder regroup | 4 | Medium |
| Split `index.css` (2,270 lines) into `styles/` layers | 5 | Medium |
| Backend `model/` → `modules/{domain}/` layout | 7 | High |
| Rename `usercontroller.js`, `student&participant.js`, etc. | 6 | Low |
| Split `registrationController.js` (1,807 lines) | 8 | Medium |
| Split `adminRoute.js` (726 lines) | 7 | Medium |
| Consolidate trek payment verification (3 paths) | 8 | High |
| Create `DUPLICATE_CODE_CONSOLIDATION.md` | — | Medium |

### Optional dependency review

| Package | Location | Notes |
|---------|----------|-------|
| `@capacitor/browser` | frontend | Not imported in `src/`; verify Android usage before removal |
| `csv-parser` | backend | Only used by `batch_email.js`; remove with script if ops agrees |

### Naming / typos (no functional impact)

- `compition-register-page/` folder name
- `Competition_Modal.jsx`
- Public `pages/fests/FestsPage.jsx` vs admin `pages/admin/FestsPage.jsx` (collision resolved by domain folder)

---

## Rollback

To revert this cleanup:

```bash
git checkout HEAD -- frontend/src backend/src frontend/package.json backend/package.json frontend/vite.config.js package.json package-lock.json
cd frontend && npm install
cd ../backend && npm install
```

Or revert the commit that introduced this cleanup.

---

*Generated after implementing audit Phase 0 and restructuring Phases 1–3. See [CODEBASE_RESTRUCTURING.md](./CODEBASE_RESTRUCTURING.md) for Phases 4–8.*

---

## Update (2026-06-15) — Consolidation Phases A–D complete

- Phases A–D: API consolidation, fest triplet, auth.api.js — see [DUPLICATE_CODE_CONSOLIDATION.md](./DUPLICATE_CODE_CONSOLIDATION.md)
- **Final health score: 86/100** — deploy ready — see [FINAL_AUDIT_REPORT.md](./FINAL_AUDIT_REPORT.md)
