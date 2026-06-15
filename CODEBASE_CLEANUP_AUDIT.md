# CrwdCtrl — Codebase Cleanup Audit

**Date:** 2026-06-15  
**Scope:** Full repository (`frontend/`, `backend/`, root)  
**Method:** Static import tracing from `main.jsx` / `server.js`, route registration analysis, dependency usage grep, `npm run build` verification  
**Original status:** Analysis only (no code modified at audit time)

> **Update (2026-06-15):** Phases 0–3 + consolidation Phases A–D are **complete**. Final health score: **86 / 100**. See [FINAL_AUDIT_REPORT.md](./FINAL_AUDIT_REPORT.md) for deploy readiness and all dimension scores.

---

## Overall Health Score

| When | Score | Notes |
|------|------:|-------|
| Initial audit | **58 / 100** | Pre-cleanup baseline |
| After Phase 0 cleanup | **~68 / 100** | Dead files + deps removed |
| After Phases 1–3 | **76 / 100** | Router, pages, API layer |
| After consolidation A–D | **86 / 100** | Full API layer, fest triplet, auth.api.js |

### Final dimension scores (post Phases 0–D)

| Dimension | Baseline | Final | Notes |
|-----------|:--------:|:-----:|-------|
| Code utilization (dead/orphan files) | 62 | **92** | Dead + duplicate page copies removed |
| Dependency hygiene | 48 | **78** | 8 unused npm packages removed |
| Structure & conventions | 55 | **85** | `pages/{domain}/`, `app/router/`, `services/api/*` |
| DRY / duplication | 50 | **82** | Shared fetch, admin HTTP, fest triplet |
| Maintainability (file size) | 42 | **68** | `App.jsx` slimmed; mega-modals remain |
| Reference integrity | 90 | **98** | `npm run build` + `npm run lint` pass |
| Backend organization | 72 | **74** | Unchanged structure; all files reachable |
| API layer consistency | 45 | **88** | Unified `services/api/` |
| Auth & session handling | 55 | **90** | `auth.api.js` |
| Deploy readiness | 70 | **94** | verify-build + verify-deploy pass |

**Full breakdown:** [FINAL_AUDIT_REPORT.md](./FINAL_AUDIT_REPORT.md)

### Superseded dimension table (post Phases 0–3 only)

| Dimension | Was | Now | Notes |
|-----------|----:|----:|-------|
| Code utilization (dead/orphan files) | 62 | **88** | 37 dead files + 47 duplicate page copies removed |
| Dependency hygiene | 48 | **72** | 8 unused npm packages removed; root orphan `package.json` gone |
| Structure & conventions | 55 | **78** | `pages/{domain}/`, `app/router/`, admin modals stay in `components/admin/` |
| DRY / duplication | 50 | **62** | `services/api/client.js` + shims; inline `fetch` still in ~35 page files |
| Maintainability (file size) | 42 | **55** | `App.jsx` 546 → 393 lines; `index.css` still 2,270 lines |
| Reference integrity | 90 | **95** | `npm run build` + `npm run lint` pass |
| Backend organization | 72 | **72** | Unchanged — Phases 6–8 pending |

---

## Executive Summary

CrwdCtrl is a **functional, deployable** monorepo with a large React/Vite frontend and Express/Mongoose backend. The backend is comparatively lean — every `src/` file is reachable from the server entry graph. The frontend carries **significant legacy baggage**: superseded card components, unused loading/splash chains, static data files replaced by API-driven flows, and several unused npm packages.

Highest-impact cleanup: remove confirmed frontend orphans (~28 files), prune unused dependencies, consolidate API/fetch patterns, and split mega-modals/pages when touched for features.

---

# Dead Files

Files with no inbound imports from the live application graph (or only referenced by other dead files).

## Frontend — Components (superseded UI)

| File | Why unused | Confidence | Safe to delete? |
|------|------------|------------|---------------|
| `frontend/src/components/EventCard.jsx` | Replaced by `HomeEventCard.jsx`; zero importers | 98% | Yes |
| `frontend/src/components/FestCard.jsx` | Replaced by inline `FestEventCard` in `FestsPage.jsx` + `HomeEventCard` | 95% | Yes |
| `frontend/src/components/TrendingCard.jsx` | Never imported; trending layout handled in `HomeEventCard` | 95% | Yes |
| `frontend/src/components/HappeningCard.jsx` | Never imported | 95% | Yes |
| `frontend/src/components/ViewDetails.jsx` | Superseded by `components/pages/view-details.jsx` | 98% | Yes |
| `frontend/src/components/LoadingSkeleton.jsx` | Replaced by `HomeEventCardSkeleton.jsx` | 95% | Yes |
| `frontend/src/components/LoadingBar.jsx` | Only used by dead `withPageLoading.jsx` | 98% | Yes |
| `frontend/src/components/RouteLoader.jsx` | Only used by dead `LoadingBar.jsx` | 98% | Yes |
| `frontend/src/components/withPageLoading.jsx` | HOC never used in routes or components | 98% | Yes |
| `frontend/src/components/AppLoadingPage.jsx` | Never imported; boot splash handled via HTML `#boot-splash` | 98% | Yes |
| `frontend/src/components/AuthLoadingPage.jsx` | Never imported | 98% | Yes |
| `frontend/src/components/LogoSplash.jsx` | Only used by dead loading pages above | 95% | Yes |
| `frontend/src/components/BootSplashOverlay.jsx` | Only used by dead splash chain + unused `motion/SplashScreen` | 90% | Yes |
| `frontend/src/components/BootLogoAssemble.jsx` | Only used by `BootSplashOverlay.jsx` | 90% | Yes |
| `frontend/src/components/animations/StickyBookingBar.jsx` | Never imported; `motion/StickyCta` used instead | 95% | Yes |
| `frontend/src/components/animations/variants.js` | Never imported; `motion/variants.js` is the live copy | 95% | Yes |

## Frontend — Pages (no route)

| File | Why unused | Confidence | Safe to delete? |
|------|------------|------------|---------------|
| `frontend/src/components/pages/AdminDashboard.jsx` | Superseded by `admin/AdminDashboardPage.jsx` (routed at `/admin`) | 98% | Yes |
| `frontend/src/components/pages/CompetitionRegistrationsAdmin.jsx` | No route in `App.jsx` | 98% | Yes |

## Frontend — Hooks

| File | Why unused | Confidence | Safe to delete? |
|------|------------|------------|---------------|
| `frontend/src/hooks/useBottomNavPageBoot.js` | Exported but never imported | 98% | Yes |
| `frontend/src/hooks/useEnv.js` | `useEnv` / `withEnv` never imported outside file | 98% | Yes |
| `frontend/src/hooks/useBootSplashTheme.js` | Only used by dead `BootSplashOverlay.jsx` | 90% | Yes (with splash chain) |

## Frontend — Services & Utils

| File | Why unused | Confidence | Safe to delete? |
|------|------------|------------|---------------|
| `frontend/src/services/apiService.js` | Demo stub; never imported | 98% | Yes |
| `frontend/src/utils/authFetch.js` | Only imported by dead `apiService.js` | 95% | Yes |
| `frontend/src/utils/errorHandler.js` | Error-handler class with zero importers | 98% | Yes |
| `frontend/src/utils/performanceUtils.js` | debounce/throttle helpers; zero importers | 98% | Yes |
| `frontend/src/utils/imageUtils.js` | Overlaps `fallbackImageGenerator.js`; zero importers | 95% | Yes |
| `frontend/src/utils/imagePreprocessor.js` | Only used by orphan static data files (below) | 90% | Yes (after data cleanup) |

## Frontend — Static Data (legacy catalog)

| File | Why unused | Confidence | Safe to delete? |
|------|------------|------------|---------------|
| `frontend/src/data/eventsData.js` | Static fest catalog; nothing imports it (API-driven now) | 95% | Yes (confirm API covers all fest UI) |
| `frontend/src/data/comingSoonEvents.js` | Only imported by orphan `eventsData.js` | 90% | Yes (with `eventsData.js`) |
| `frontend/src/data/lastYearHitsEvents.js` | Never imported | 98% | Yes |

**Not dead:** `frontend/src/data/real-data/competitionDataService.js` — actively used by `/competition-register` via `compition-register-page.jsx`.

## Frontend — Motion (exported but never consumed)

| File | Why unused | Confidence | Safe to delete? |
|------|------------|------------|---------------|
| `frontend/src/motion/components/StaggerChildren.jsx` | Re-exported in `motion/index.js` but never imported | 90% | Yes (remove barrel export too) |
| `frontend/src/motion/components/SplashScreen.jsx` | Re-exported but never imported | 90% | Yes (remove barrel export too) |

## Frontend — Dead stub (imported but empty)

| File | Why unused | Confidence | Safe to delete? |
|------|------------|------------|---------------|
| `frontend/src/components/EmailVerificationBanner.jsx` | Imported in `App.jsx` but `return null` (fully commented-out implementation) | 85% | No — remove import from `App.jsx` first, or restore feature |

## Backend — Runtime `src/` files

| Finding | Confidence | Safe to delete? |
|---------|------------|---------------|
| **No fully orphaned files** under `backend/src/` — all controllers, routers, models, services, utils, and middleware are referenced | 95% | N/A |

## Backend — Standalone scripts (not server-wired)

| File | Why unused at runtime | Confidence | Safe to delete? |
|------|----------------------|------------|---------------|
| `backend/scripts/backfill-qr-codes.js` | One-off ops script | 90% | No — keep for ops unless migration confirmed done |
| `backend/scripts/cleanup-duplicate-registrations.js` | One-off ops script | 90% | No |
| `backend/scripts/hash-admin-password.js` | CLI utility | 95% | No |
| `backend/scripts/migrate-theatre-to-events.js` | One-time migration | 85% | Maybe — if migration verified complete |
| `backend/scripts/test-cashfree.js` | Manual smoke test | 90% | No |
| `backend/scripts/verify-admin-hash.js` | CLI utility | 95% | No |
| `backend/scripts/verify-deploy.js` | Used by `npm run verify-deploy` | 95% | No |
| `backend/scripts/verify-firebase-admin.js` | CLI utility | 95% | No |
| `backend/batch_email.js` | Standalone bulk-email script | 95% | Maybe — if bulk email no longer needed |
| `backend/test.users.csv` | Input for `batch_email.js` | 95% | Maybe — with `batch_email.js` |

## Root

| File | Why unused | Confidence | Safe to delete? |
|------|------------|------------|---------------|
| Root `package.json` + `package-lock.json` | Only declares `mongodb`; not used by frontend or backend (backend uses mongoose) | 99% | Yes — remove entire root package or document purpose |

---

# Duplicate Files

| File A | File B | Relationship | Confidence | Safe to delete? |
|--------|--------|--------------|------------|---------------|
| `frontend/src/assets/mobile-icons/marathon - Copy.png` | `marathon.png` | Accidental Finder duplicate | 80% | Yes (after visual diff) |
| `frontend/src/assets/mobile-icons/run clubs - Copy.png` | `run clubs.png` | Accidental duplicate | 80% | Yes |
| `frontend/src/assets/mobile-icons/sports club - Copy.png` | `sports club.png` | Accidental duplicate | 80% | Yes |
| `frontend/src/assets/mobile-icons/others - Copy.png` | `others.png` | Accidental duplicate | 80% | Yes |
| `frontend/src/data/real-data/aarohan-comition-images/Aarohan logo copy.svg` | (original logo elsewhere) | Likely accidental copy | 75% | Maybe |
| `frontend/src/components/animations/variants.js` | `frontend/src/motion/variants.js` | Duplicate animation presets; only `motion/` copy is used | 95% | Yes (animations copy) |
| `frontend/src/components/pages/FestsPage.jsx` | `frontend/src/components/admin/FestsPage.jsx` | **Same name, different purpose** (public vs admin) — not duplicate content, but naming collision | 100% | No — rename for clarity instead |
| `frontend/src/utils/fallbackImageGenerator.js` | `frontend/src/utils/imageUtils.js` | Overlapping canvas fallback logic; only former is used | 90% | Yes (`imageUtils.js`) |

---

# Unused Dependencies

## Root `package.json`

| Package | Why unused | Confidence | Safe to delete? |
|---------|------------|------------|---------------|
| `mongodb` | No imports in repo; backend uses `mongoose` which bundles its own driver | 99% | Yes |

## Frontend `package.json`

| Package | Why unused | Confidence | Safe to delete? |
|---------|------------|------------|---------------|
| `axios` | Zero `import`/`require` in `src/`; app uses native `fetch` | 99% | Yes |
| `better-auth` | Listed in deps and Vite chunk config only; zero source imports | 99% | Yes (also update `vite.config.js` manualChunks) |
| `react-icons` | Zero imports; app uses `lucide-react` | 99% | Yes |
| `react-responsive` | Zero imports | 99% | Yes |
| `react-circular-progressbar` | Zero imports | 99% | Yes |
| `@capacitor/browser` | Synced to Android but never imported in `src/` | 90% | Maybe — remove from Capacitor config if dropped |

## Backend `package.json`

| Package | Why unused | Confidence | Safe to delete? |
|---------|------------|------------|---------------|
| `firebase` (client SDK) | Backend uses `firebase-admin` only | 99% | Yes |
| `twilio` | Zero imports anywhere in backend | 99% | Yes |
| `node-fetch` | Zero direct imports; `axios` used in `cashfreeService` | 99% | Yes |
| `csv-parser` | Only used by `backend/batch_email.js`, not `src/` | 85% | Yes if `batch_email.js` removed |

---

# Broken References

**Build status:** `npm run build` in `frontend/` completed successfully (no unresolved module errors).

| Reference | Location | Issue | Confidence | Safe to delete? |
|-----------|----------|-------|------------|---------------|
| `verifyPaymentProof` export | `backend/src/utils/paymentProof.js` | Exported but never called; only `signPaymentProof` is used | 95% | No — remove dead export only |
| `festTypeLabel` export | `backend/src/utils/searchKeywords.js` | Exported but only used internally | 90% | No — stop exporting only |
| `homepage_section_model.js` | `backend/src/models/index.js` | Model used by controller but **not registered** at startup | 95% | No — add to index instead |
| Inline `authFetch` duplicates | `SectionManager.jsx`, `PageSectionsPage.jsx`, `NotificationsContext.jsx` | Duplicate of pattern in dead `utils/authFetch.js` | 90% | No — consolidate into shared util |

No confirmed broken JS import paths were found in static analysis. Asset paths (`share.svg`, `calendar.svg`, `symbi-images/`, `payment-qr/image.png`) resolve correctly on disk.

---

# Structural Problems

| Issue | Details | Confidence | Safe to delete? |
|-------|---------|------------|---------------|
| Pages inside `components/pages/` | 43 page files live under `components/` instead of `pages/` or `routes/` | 100% | No — rename/move incrementally |
| `model/` vs `models/` split (backend) | Schemas in `src/model/`; registry only in `src/models/index.js` | 100% | No — consolidate naming in refactor |
| Inconsistent file naming (backend) | `usercontroller.js`, `userroute.js`, `studentroute.js` vs `adminFestController.js` | 100% | No |
| Special-character filename | `backend/src/model/student&participant.js` — awkward on some shells | 100% | No — rename carefully with migration |
| Three "event" domains | `event_model` (fest sub-events), `platform_event_model`, `event_show_model` (shows/theatre) | 100% | No — document domain glossary |
| Fat routers with inline logic | `adminRoute.js` (726 lines), `publicFestRoute.js`, `publicTrekRoute.js` query models directly | 95% | No — extract to controllers |
| Fat controllers | `registrationController.js` (1,807 lines), `festOrganizerController.js` (1,125 lines) | 100% | No — split by domain |
| Mega CSS monolith | `frontend/src/index.css` (2,270 lines) | 100% | No — split into tokens + modules |
| Typo naming persists | `compition-register-page/`, `Competition_Modal.jsx`, `BGMI-competion.png` | 100% | No — rename when touching those flows |
| Duplicate route aliases | `/homepage-sections` and `/page-sections` mount same router (intentional) | 100% | No |
| Legacy redirects retained | `/theatre` → `/events`, `/registered-fest` → `/booking`, `/dashboard` → `/` | 100% | No — keep for bookmarks/SEO |

---

# Technical Debt

## Duplicate logic

| Area | Files involved | Issue | Confidence |
|------|----------------|-------|------------|
| Search keywords | `frontend/src/utils/buildSearchKeywords.js`, `backend/src/utils/searchKeywords.js`, `searchService.js` + `useHeroSearch.js` | Client mirrors server keyword builder; API also serves `/search/keywords` | 95% |
| Platform fee | `frontend/src/utils/platformFee.js`, `backend/src/utils/platformFee.js`, inline math in `TrekBookingPage.jsx` | Fee rules duplicated; trek page reimplements 3% inline | 90% |
| Trek payment verification | `backend/src/utils/trekPaymentVerification.js`, `paymentController.verifyTrekPayment`, `paymentVerification.js` | Three overlapping Cashfree verify paths with different checks | 90% |
| API / fetch patterns | `utils/api.js`, `utils/adminApi.js`, `services/searchService.js`, `services/authService.js`, inline `fetch()` in 40+ components | No single HTTP client layer | 95% |
| Auth fetch helpers | Inline in `SectionManager`, `PageSectionsPage`, `NotificationsContext` vs dead `utils/authFetch.js` | Copy-pasted bearer-token fetch | 90% |
| QR check-in parsing | `frontend/src/utils/qrCheckin.js`, `backend/src/utils/qrCheckin.js` | Split client/server parsers for same domain | 85% |
| Card component evolution | `EventCard` → `FestCard`/`TrendingCard`/`HappeningCard` → `HomeEventCard` | Old generations left in tree | 95% |
| Fest list cards | `FestsPage.jsx` inline `FestEventCard`, `events-page.jsx` inline `CommunityEventCard` | Similar card markup not shared | 80% |
| Hub page pattern | `treks-page.jsx`, `events-page.jsx`, `sports-category.jsx` | ~60% shared structure (filters, hero, skeletons) | 85% |

## Duplicate API calls / state

| Pattern | Locations | Issue | Confidence |
|---------|-----------|-------|------------|
| Favorites state | `FavoritesContext` + localStorage + per-page favorite toggles | Single context is good; some pages re-fetch fest lists independently | 75% |
| Registered events | `RegisteredEventsContext` overlaps booking page fetches | Potential double-fetch on profile/booking flows | 70% |
| Health check | `App.jsx` fires `/api/health` up to 4 times on load | Intentional cold-start retry but noisy | 80% |
| Keyword merge | `useHeroSearch` merges API keywords + client `buildSearchKeywordsFromCatalog` | Same data from two sources | 90% |

## Circular / tight coupling (backend)

| Chain | Risk | Confidence |
|-------|------|------------|
| `reminderService` / `checkinService` → `notificationController` | Services import controller (layer violation) | 90% |
| `homepageSectionController` / `adminSectionController` → `festOrganizerController.clearAllCaches` | Cross-controller cache invalidation coupling | 90% |
| `registrationController` → `notificationController` + `googleSheetsService` | Large controller orchestrates many side effects | 85% |

Not a hard circular `require()` loop, but **architectural cycles** that complicate testing and extraction.

## Large files that should be split (>400 lines)

| Lines | File | Suggested split |
|------:|------|-----------------|
| 2,270 | `frontend/src/index.css` | Design tokens, layout, component styles |
| 2,511 | `frontend/src/components/admin/FestFormModal.jsx` | Form sections, media upload, validation |
| 2,477 | `frontend/src/components/admin/Competition_Modal.jsx` | Wizard steps, pricing, media |
| 2,413 | `frontend/src/components/pages/FestRegistration.jsx` | Auth gate, form, payment, confirmation |
| 1,807 | `backend/src/controllers/registrationController.js` | Fest vs competition vs payment handlers |
| 1,591 | `frontend/src/components/pages/Competitions-view-details.jsx` | Fetch layer, hero, registration CTA |
| 1,473 | `frontend/src/components/pages/CompetitionRegistration.jsx` | Same pattern as fest registration |
| 1,306 | `frontend/src/components/pages/Dashboard.jsx` | Data hooks, hero, carousels |
| 1,296 | `frontend/src/components/admin/SectionManager.jsx` | Per-entity tabs |
| 1,209 | `frontend/src/firebase.js` | Auth, messaging, analytics modules |
| 1,125 | `backend/src/controllers/festOrganizerController.js` | Public fest API vs cache vs CRUD |
| 1,050 | `frontend/src/data/real-data/competitionDataService.js` | Per-fest data modules (live) |
| 1,005 | `backend/src/services/emailService.js` | Provider adapters (Resend vs nodemailer) |
| 916 | `frontend/src/data/comingSoonEvents.js` | Orphan — delete rather than split |
| 914 | `frontend/src/components/pages/profile-pages/edit-profile.jsx` | Form vs avatar upload |
| 912 | `frontend/src/components/Navbar.jsx` | Search vs nav chrome |
| 839 | `frontend/src/components/admin/CheckinScannerPage.jsx` | Scanner UI vs API |
| 815 | `frontend/src/components/pages/TrekBookingPage.jsx` | Booking steps |
| 802 | `frontend/src/components/admin/SectionLivePreview.jsx` | Per-page preview renderers |
| 740 | `backend/src/services/googleSheetsService.js` | Sheets append vs template helpers |
| 729 | `backend/src/controllers/usercontroller.js` | Auth vs profile vs upload |
| 726 | `backend/src/routers/adminRoute.js` | Split by resource |
| 671 | `frontend/src/components/pages/register.jsx` | OAuth vs email flows |
| 626 | `backend/src/controllers/adminFestController.js` | |
| 616 | `frontend/src/utils/api.js` | Auth vs upload helpers |
| 590 | `frontend/src/services/authService.js` | Provider-specific flows |
| 532 | `frontend/src/context/AuthContext.jsx` | |

---

# Recommended Cleanup Plan

## Phase 1 — Zero-risk deletions (1–2 hours)

| Action | Files | Risk |
|--------|-------|------|
| Delete superseded card components | `EventCard`, `FestCard`, `TrendingCard`, `HappeningCard`, `ViewDetails` | Low |
| Delete dead loading/splash chain | `AppLoadingPage`, `AuthLoadingPage`, `LogoSplash`, `BootSplashOverlay`, `BootLogoAssemble`, `LoadingBar`, `RouteLoader`, `withPageLoading`, `LoadingSkeleton`, `useBootSplashTheme` | Low |
| Delete unused hooks/utils/services | `useBottomNavPageBoot`, `useEnv`, `apiService`, `authFetch`, `errorHandler`, `performanceUtils`, `imageUtils` | Low |
| Delete orphan pages | `AdminDashboard.jsx`, `CompetitionRegistrationsAdmin.jsx` | Low |
| Delete duplicate animation copy | `components/animations/variants.js`, `StickyBookingBar.jsx` | Low |
| Remove motion dead exports | `StaggerChildren.jsx`, `SplashScreen.jsx` + barrel exports | Low |
| Delete duplicate asset copies | 4 `*- Copy.png` in `mobile-icons/` | Low (visual check) |
| Remove unused npm packages | See Unused Dependencies tables | Low (run build + Capacitor sync after) |

## Phase 2 — Data layer cleanup (2–4 hours)

| Action | Prerequisite | Risk |
|--------|--------------|------|
| Delete `eventsData.js`, `comingSoonEvents.js`, `lastYearHitsEvents.js`, `imagePreprocessor.js` | Confirm all fest UI uses API (`/fests`, `/platform-events`, etc.) | Medium |
| Keep `competitionDataService.js` + JSON assets | Still powers `/competition-register` | — |
| Remove `EmailVerificationBanner` import from `App.jsx` OR restore implementation | Product decision | Low |

## Phase 3 — Dependency & root cleanup (1 hour)

| Action | Risk |
|--------|------|
| Remove root `package.json` mongodb dep (or document monorepo purpose) | Low |
| Remove backend `firebase`, `twilio`, `node-fetch` | Low |
| Remove frontend `axios`, `better-auth`, `react-icons`, `react-responsive`, `react-circular-progressbar` | Low |
| Update `vite.config.js` to drop `better-auth` manual chunk | Low |

## Phase 4 — Backend hygiene (2–3 hours)

| Action | Risk |
|--------|------|
| Register `homepage_section_model.js` in `models/index.js` | Low |
| Remove dead `verifyPaymentProof` export | Low |
| Consolidate trek payment verification into one module | Medium — needs payment regression tests |
| Evaluate `batch_email.js` + `csv-parser` removal | Low if ops agrees |

## Phase 5 — Structural refactors (ongoing, per feature)

| Action | Risk |
|--------|------|
| Introduce shared `httpClient.js` (auth + admin + public) | Medium |
| Unify search keywords: API-only or client-only | Medium |
| Rename `compition-register-page` → `competition-register-page` | Medium (route + imports) |
| Rename admin `FestsPage` → `AdminFestsPage` | Low |
| Split `FestFormModal`, `Competition_Modal`, `FestRegistration` when next edited | Medium |
| Split `index.css` into layered imports | Medium |
| Extract fat router logic into controllers | High |
| Rename `model/` → `models/` with consistent casing | High |

---

## Inventory Reference

### Frontend (live graph)

| Category | Count | Status |
|----------|------:|--------|
| Pages (routed) | 41 | All routed pages in `App.jsx` are reachable |
| Pages (orphan) | 2 | `AdminDashboard`, `CompetitionRegistrationsAdmin` |
| Components (total `.jsx` in `components/`) | ~134 | ~15 confirmed dead |
| Hooks | 8 | 3 dead (`useBottomNavPageBoot`, `useEnv`, `useBootSplashTheme`) |
| Contexts | 6 | All 6 used (`Auth`, `DarkMode`, `Favorites`, `RegisteredEvents`, `Notifications`, `MobileSearch`) |
| Services | 4 | 1 dead (`apiService`); `authService`, `searchService`, `analyticsService` live |
| Utils | 49 | 5 dead (+ `imagePreprocessor` if data removed) |
| Assets | 39 | 4 duplicate copies flagged |

### Backend (live graph)

| Category | Count | Status |
|----------|------:|--------|
| Routers | 27 | All mounted in `routes/index.js` |
| Controllers | 27 | All referenced by routers, webhooks, or services |
| Models | 19 | All used; 1 missing from startup registry |
| Services | 8 | All used |
| Utils | 9 | All used (1 dead export) |
| Middleware | 10 | All used |
| Scripts | 8 | Standalone ops tools |

---

## Appendix: Scoring Methodology

Starting from 100, weighted deductions were applied:

- **−14** — ~13% of frontend modules are dead or stub-only  
- **−10** — 9 unused npm packages across packages  
- **−9** — Structural inconsistency (folder layout, naming, fat files)  
- **−9** — Duplicate logic (fetch layers, keywords, payments, fees)  
- **−5** — Tight service→controller coupling in backend  
- **+5** — Clean backend `src/` reachability and passing production build  

**Final score: 58/100** — functional product with manageable but real cleanup debt, concentrated in the frontend legacy layer.

---

*Generated by static analysis. Re-run after major refactors.*

---

## Post-Restructuring Summary (Phases 0–3 complete)

### What changed

| Area | Before | After |
|------|--------|-------|
| Route definitions | Inline in `App.jsx` (546 lines) | `frontend/src/app/router/` — `publicRoutes`, `adminRoutes`, `organizerRoutes`, `redirects`, `lazyPages` |
| `App.jsx` | Routes + 50+ lazy imports | Shell + providers only (**393 lines**) |
| Pages | `components/pages/` (43 files) | `pages/{domain}/` (**60 route files** across 12 domains) |
| Admin route screens | `components/admin/*Page.jsx` | `pages/admin/` (13 files); modals/scanners remain in `components/admin/` |
| Organizer screens | `components/organizer/` | `pages/organizer/` (6 files) |
| API layer | `utils/adminApi.js`, `services/searchService.js` scattered | `services/api/{client,admin,search,auth}.api.js` + backward-compat shims |

### New frontend layout (implemented)

```
frontend/src/
├── App.jsx                     # shell (393 lines)
├── app/router/
│   ├── index.jsx               # AppRoutes composition
│   ├── lazyPages.js            # all lazy + eager page imports
│   ├── publicRoutes.jsx
│   ├── adminRoutes.jsx
│   ├── organizerRoutes.jsx
│   └── redirects.jsx
├── pages/
│   ├── home/ auth/ legal/ profile/ payment/
│   ├── registration/ events/ treks/ sports/
│   ├── fests/ competitions/ admin/ organizer/
└── services/api/
    ├── client.js               # resolveUrl, publicFetch, userFetchJSON
    ├── admin.api.js
    ├── search.api.js
    ├── auth.api.js             # shim → utils/api auth slice
    └── index.js
```

### Verification (2026-06-15)

- `frontend`: `npm run build` ✅ · `npm run lint` ✅
- `backend`: `node -e "require('./src/app')"` ✅

### Still open (Phases 4–8)

- Component regrouping (`components/layout/`, `features/`)
- CSS split (`index.css` → `styles/`)
- Backend `modules/` layout, naming normalization, mega-file splits
- Inline `fetch` in pages → `services/api/*` (incremental)
- `DUPLICATE_CODE_CONSOLIDATION.md` not yet created

### Score trajectory

**58 → 68 (Phase 0) → 76 (Phases 1–3)** — on track for **75+** target; Phases 4–8 should push toward **82+**.

---
