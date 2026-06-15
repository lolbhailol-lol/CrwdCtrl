# CrwdCtrl — Codebase Restructuring Plan

**Date:** 2026-06-15  
**Based on:** [CODEBASE_CLEANUP_AUDIT.md](./CODEBASE_CLEANUP_AUDIT.md) (health score 58/100 → **76/100**)  
**Status:** **Phases 0–3 complete** · Phases 4–8 pending  
**Goal:** A predictable, domain-oriented layout that scales with fests, treks, sports, registrations, payments, admin, and organizer flows.

---

## Design Principles

1. **Route pages ≠ reusable components** — pages live under `pages/`; shared UI lives under `components/`.
2. **One HTTP layer** — all API calls go through `services/api/`; no inline `fetch` in pages.
3. **Domain folders on backend** — group model + controller + routes per bounded context; thin route files.
4. **Consistent naming** — `{resource}Controller.js`, `{resource}.routes.js`, `{resource}.model.js` on backend; PascalCase components on frontend.
5. **Incremental migration** — move in small PRs; keep `git mv` history; run build after each phase.
6. **Delete before move** — complete audit Phase 1 dead-file removal before large renames.

---

## 1. Current Structure

### Repository root

```
CrwdCtrl/
├── package.json              # orphan: only `mongodb` dep
├── frontend/                 # React 19 + Vite 7 + Capacitor
├── backend/                  # Express 5 + Mongoose
└── CODEBASE_CLEANUP_AUDIT.md
```

### Frontend (`frontend/src/`) — today

```
src/
├── main.jsx
├── App.jsx                   # 548 lines: routes + shell + providers
├── App.css
├── index.css                 # 2,270 lines (monolith)
├── firebase.js               # 1,209 lines at root
│
├── assets/
│   ├── mobile-icons/         # 30+ icons (incl. 4 duplicate *- Copy.png)
│   ├── loading-image/
│   └── payment-qr/
│
├── components/               # ~134 JSX files — pages mixed with UI
│   ├── admin/                # 32 admin screens + modals (flat)
│   ├── organizer/            # 6 organizer screens
│   ├── animations/           # 2 files (1 duplicate of motion/)
│   ├── common/               # EMPTY directory
│   ├── pages/                # 43 route screens (should not be under components/)
│   │   ├── profile-pages/    # 5 profile sub-pages
│   │   └── compition-register-page/  # typo folder name
│   └── [50+ root-level UI]   # Navbar, Sidebar, cards, search, splash, dead cards…
│
├── config/
│   ├── env.js
│   └── apiBase.js
│
├── constants/                # 9 domain constant files
├── context/                  # 6 React contexts
├── data/                     # legacy static data + real-data JSON
├── hooks/                    # 8 hooks (3 unused)
├── motion/                   # framer-motion primitives + barrel
├── services/                 # 4 files (auth, search, analytics, dead apiService)
└── utils/                    # 49 flat files (auth, payment, image, api mixed)
```

**Frontend pain points**

| Issue | Impact |
|-------|--------|
| Pages inside `components/pages/` | Unclear what is routable vs reusable |
| Flat `utils/` (49 files) | Hard to find payment vs auth vs image helpers |
| `App.jsx` owns all routes | No route modules; lazy imports 50+ lines |
| `firebase.js` at `src/` root | Infrastructure mixed with app entry |
| Duplicate concerns | `utils/api.js`, `utils/adminApi.js`, `services/*`, inline `fetch` |
| Empty `components/common/` | Dead folder |
| Admin public name collision | `components/pages/FestsPage.jsx` vs `components/admin/FestsPage.jsx` |

### Backend (`backend/src/`) — today

```
src/
├── server.js
├── app.js
│
├── config/                   # 6 files (db, cors, firebase, sentry, env, jwt)
├── constants/                # trekFilterOptions.js
│
├── controllers/              # 27 files (flat)
├── routers/                  # 27 files (flat) — inconsistent naming
├── routes/
│   └── index.js              # mounts all routers
│
├── model/                    # 19 Mongoose schemas (*.js, snake_case names)
├── models/
│   └── index.js              # registry only — missing homepage_section_model
│
├── middleware/               # 10 files (flat)
├── services/                 # 8 cross-cutting services (flat)
└── utils/                    # 9 pure helpers (flat)
```

**Backend pain points**

| Issue | Impact |
|-------|--------|
| `model/` vs `models/` split | Schemas in one folder, registry in another |
| Flat controllers/routers | 27+27 files; hard to see fest vs trek boundaries |
| Fat routers | `adminRoute.js` (726 lines) contains business logic |
| Fat controllers | `registrationController.js` (1,807 lines) |
| Naming inconsistency | `usercontroller.js`, `userroute.js`, `studentroute.js` |
| Special char file | `student&participant.js` |
| Service → controller imports | `reminderService` imports `notificationController` |

### Backend scripts (outside `src/`)

```
backend/scripts/              # 8 ops/CLI scripts
backend/batch_email.js        # standalone bulk email
```

---

## 2. Proposed Structure

### Target: Frontend

```
frontend/src/
├── main.jsx
├── app/
│   ├── App.jsx               # shell only (providers, layout chrome)
│   ├── App.css
│   ├── providers.jsx         # Auth, DarkMode, Favorites, etc.
│   └── router/
│       ├── index.jsx         # <Routes> composition
│       ├── public.routes.jsx
│       ├── admin.routes.jsx
│       ├── organizer.routes.jsx
│       └── redirects.jsx     # /theatre, /dashboard, legacy paths
│
├── pages/                    # ONE folder per route screen
│   ├── home/
│   │   └── DashboardPage.jsx
│   ├── auth/
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   └── EmailVerificationPage.jsx
│   ├── fests/
│   │   ├── FestsListPage.jsx
│   │   ├── FestDetailPage.jsx          # was view-details.jsx
│   │   ├── CulturalFestPage.jsx
│   │   ├── TechFestPage.jsx
│   │   ├── SportsFestPage.jsx
│   │   └── FestRegistrationPage.jsx
│   ├── competitions/
│   │   ├── CompetitionDetailPage.jsx   # was Competitions-view-details.jsx
│   │   ├── CompetitionListPage.jsx
│   │   ├── CompetitionRegisterPage.jsx # fix typo path
│   │   └── CompetitionRegistrationPage.jsx
│   ├── treks/
│   │   ├── TreksHubPage.jsx
│   │   ├── TrekDetailPage.jsx
│   │   ├── TrekBookingPage.jsx
│   │   ├── TrekCategoryPage.jsx
│   │   └── CommunityDetailPage.jsx
│   ├── sports/
│   │   ├── SportsCategoryPage.jsx
│   │   ├── RunClubDetailPage.jsx
│   │   ├── RunEventDetailPage.jsx
│   │   └── RunEventBookingPage.jsx
│   ├── events/
│   │   └── EventsHubPage.jsx
│   ├── profile/
│   │   ├── ProfilePage.jsx
│   │   ├── EditProfilePage.jsx
│   │   ├── BookingPage.jsx
│   │   ├── FavoritesPage.jsx
│   │   ├── NotificationsPage.jsx
│   │   ├── HelpCenterPage.jsx
│   │   └── ListYourFestPage.jsx
│   ├── payment/
│   │   ├── PaymentCheckoutPage.jsx
│   │   ├── PaymentInvoicePage.jsx
│   │   └── QRTicketPage.jsx
│   ├── registration/
│   │   └── RegistrationDetailsPage.jsx
│   ├── legal/
│   │   ├── TermsPage.jsx
│   │   ├── PrivacyPage.jsx
│   │   ├── ContactPage.jsx
│   │   ├── RefundsPage.jsx
│   │   ├── AboutPage.jsx
│   │   └── ProductsServicesPage.jsx
│   ├── admin/
│   │   ├── AdminLayout.jsx
│   │   ├── AdminDashboardPage.jsx
│   │   ├── AdminFestsPage.jsx          # renamed from admin/FestsPage
│   │   ├── AdminCompetitionsPage.jsx
│   │   ├── AdminRegistrationsPage.jsx
│   │   ├── AdminAnalyticsPage.jsx
│   │   ├── AdminScannerAccessPage.jsx
│   │   ├── AdminSportsPage.jsx
│   │   ├── AdminTreksPage.jsx
│   │   ├── AdminEventsPage.jsx
│   │   ├── AdminSectionManagerPage.jsx
│   │   └── AdminPageSectionsPage.jsx
│   ├── organizer/
│   │   ├── OrganizerEntryPage.jsx
│   │   ├── OrganizerLoginPage.jsx
│   │   ├── OrganizerFestListPage.jsx
│   │   ├── OrganizerCheckinPage.jsx
│   │   └── OrganizerScanPage.jsx
│   └── system/
│       └── ConnectionStatusPage.jsx
│
├── features/                 # feature-specific logic + sub-components
│   ├── admin/
│   │   ├── components/       # FestFormModal, CompetitionFormModal, modals…
│   │   ├── hooks/
│   │   └── utils/
│   ├── checkin/
│   │   └── CheckinScanner.jsx          # shared admin + organizer scanner
│   ├── home-sections/
│   │   ├── CustomPageSectionsRenderer.jsx
│   │   └── SectionLivePreview.jsx
│   ├── registration/
│   │   └── hooks/            # shared fest/competition registration hooks
│   └── search/
│       ├── hooks/            # useHeroSearch
│       └── components/       # HeroSearchBar, MobileSearchOverlay, etc.
│
├── components/               # shared, domain-agnostic UI only
│   ├── layout/
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Footer.jsx
│   │   ├── MobileBottomNav.jsx
│   │   ├── ProfileSidebar.jsx
│   │   └── PageTransition.jsx
│   ├── cards/
│   │   ├── HomeEventCard.jsx
│   │   ├── HomeEventCardSkeleton.jsx
│   │   └── HeroBanner.jsx
│   ├── feedback/
│   │   ├── ErrorBoundary.jsx
│   │   ├── LoginSuccessToast.jsx
│   │   └── ConnectionStatus.jsx        # if not a full page
│   └── ui/
│       ├── ContentImage.jsx
│       ├── AppLogo.jsx
│       ├── CardFavoriteButton.jsx
│       └── CarouselDotPagination.jsx
│
├── hooks/                    # app-wide hooks only
│   ├── useGlobalSmoothScroll.js
│   ├── useHomeCarousel.js
│   ├── useMobileHeaderCollapse.js
│   └── usePageContentLoading.js
│
├── context/                  # keep name (already established)
│   └── …
│
├── services/
│   ├── api/
│   │   ├── client.js         # base fetch + auth header + error handling
│   │   ├── auth.api.js       # from authService + utils/api auth slice
│   │   ├── admin.api.js      # from adminApi.js
│   │   ├── search.api.js     # from searchService.js
│   │   ├── fests.api.js
│   │   ├── treks.api.js
│   │   ├── registrations.api.js
│   │   ├── payments.api.js
│   │   └── notifications.api.js
│   └── analytics/
│       └── analytics.service.js
│
├── lib/                      # third-party app bootstrap
│   ├── firebase/
│   │   ├── index.js
│   │   ├── auth.js
│   │   ├── messaging.js
│   │   └── analytics.js
│   ├── sentry.js
│   ├── capacitor.js          # capacitorApp + capacitorPlatform
│   └── cashfree.js           # cashfreeNative + bootstrapCashfreeNative
│
├── utils/                    # pure functions — grouped by domain
│   ├── auth/
│   ├── payment/
│   ├── image/
│   ├── navigation/
│   ├── search/
│   └── storage/
│
├── constants/
├── config/
├── styles/
│   ├── index.css             # imports only
│   ├── tokens.css
│   ├── layout.css
│   ├── components/
│   │   ├── cards.css
│   │   ├── nav.css
│   │   └── admin.css
│   └── pages/
│
├── assets/                   # unchanged; remove *- Copy.* duplicates
├── motion/                   # keep; remove dead SplashScreen/StaggerChildren
│
└── data/                     # shrink to live static only
    └── competitions/         # was real-data/ — competition register flow
        ├── competitionDataService.js
        ├── fest-data.json
        └── images/
```

### Target: Backend

```
backend/
├── scripts/                  # unchanged location; add README index
├── src/
│   ├── server.js
│   ├── app.js
│   │
│   ├── config/
│   ├── constants/
│   │
│   ├── routes/
│   │   └── index.js          # thin mount table only
│   │
│   ├── modules/              # domain modules (primary organization)
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.routes.js
│   │   │   └── adminAuth.controller.js
│   │   ├── users/
│   │   │   ├── user.model.js
│   │   │   ├── user.controller.js
│   │   │   ├── user.routes.js
│   │   │   └── upload.controller.js
│   │   ├── students/
│   │   │   ├── student.model.js          # rename from student&participant.js
│   │   │   ├── student.controller.js
│   │   │   └── student.routes.js
│   │   ├── fests/
│   │   │   ├── festOrganizer.model.js
│   │   │   ├── event.model.js            # fest sub-events
│   │   │   ├── festOrganizer.controller.js
│   │   │   ├── adminFest.controller.js
│   │   │   ├── fest.public.routes.js
│   │   │   └── festOrganizer.routes.js
│   │   ├── competitions/
│   │   │   ├── competition.model.js
│   │   │   ├── competitionRegistration.model.js
│   │   │   ├── competition.controller.js
│   │   │   └── competition.routes.js
│   │   ├── registrations/
│   │   │   ├── registration.model.js
│   │   │   ├── categoryRegistration.model.js
│   │   │   ├── registration.controller.js      # split later into sub-handlers
│   │   │   ├── categoryRegistration.controller.js
│   │   │   ├── registration.routes.js
│   │   │   └── categoryRegistration.routes.js
│   │   ├── payments/
│   │   │   ├── paymentOrder.model.js
│   │   │   ├── payment.controller.js
│   │   │   ├── paymentWebhook.controller.js
│   │   │   ├── payment.routes.js
│   │   │   ├── paymentVerification.js
│   │   │   ├── trekPaymentVerification.js      # merge into paymentVerification later
│   │   │   └── paymentProof.js
│   │   ├── treks/
│   │   │   ├── trek.model.js
│   │   │   ├── trekBooking.model.js
│   │   │   ├── trekCommunity.model.js
│   │   │   ├── adminTrek.controller.js
│   │   │   ├── adminTrekCommunity.controller.js
│   │   │   ├── trekScannerAccess.controller.js
│   │   │   ├── trek.public.routes.js
│   │   │   └── trek.admin.routes.js
│   │   ├── sports/
│   │   │   ├── sports.model.js
│   │   │   ├── runClub.model.js
│   │   │   ├── adminSports.controller.js
│   │   │   ├── adminRunClub.controller.js
│   │   │   ├── sportScannerAccess.controller.js
│   │   │   ├── sports.public.routes.js
│   │   │   └── sports.admin.routes.js
│   │   ├── events/                       # platform events + event shows (theatre)
│   │   │   ├── platformEvent.model.js
│   │   │   ├── eventShow.model.js
│   │   │   ├── adminPlatformEvent.controller.js
│   │   │   ├── adminEventShow.controller.js
│   │   │   ├── platformEvent.public.routes.js
│   │   │   └── eventShow.public.routes.js
│   │   ├── homepage/
│   │   │   ├── homepageSection.model.js
│   │   │   ├── homepageSection.controller.js
│   │   │   ├── adminSection.controller.js
│   │   │   └── homepageSection.public.routes.js
│   │   ├── notifications/
│   │   │   ├── notification.model.js
│   │   │   ├── notification.controller.js
│   │   │   ├── notification.routes.js
│   │   │   └── notification.service.js   # extracted from controller calls
│   │   ├── scanner/
│   │   │   ├── scannerAccess.controller.js
│   │   │   ├── organizerCheckin.controller.js
│   │   │   ├── qr.controller.js
│   │   │   ├── scanner.routes.js
│   │   │   ├── qr.routes.js
│   │   │   └── qrCheckin.js
│   │   ├── analytics/
│   │   │   ├── analytics.model.js
│   │   │   ├── analytics.controller.js
│   │   │   └── analytics.routes.js
│   │   └── search/
│   │       ├── searchKeywords.controller.js
│   │       ├── searchKeywords.js
│   │       └── search.public.routes.js
│   │
│   ├── shared/
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   ├── adminAuth.middleware.js
│   │   │   ├── scannerAuth.middleware.js
│   │   │   ├── rateLimiter.middleware.js
│   │   │   └── …
│   │   ├── services/         # truly cross-cutting only
│   │   │   ├── email.service.js
│   │   │   ├── cashfree.service.js
│   │   │   ├── cloudinary.service.js
│   │   │   ├── firebaseAuth.service.js
│   │   │   ├── googleSheets.service.js
│   │   │   ├── push.service.js
│   │   │   ├── checkin.service.js
│   │   │   └── reminder.service.js
│   │   └── utils/
│   │       ├── logger.js
│   │       ├── fileUpload.js
│   │       ├── firebaseIdentity.js
│   │       └── platformFee.js
│   │
│   └── models/
│       └── index.js          # requires all *.model.js from modules/*
```

---

## 3. File Moves

### 3.1 Frontend — pages (high priority)

| Current path | Proposed path | Notes |
|--------------|---------------|-------|
| `components/pages/Dashboard.jsx` | `pages/home/DashboardPage.jsx` | Eager-loaded home |
| `components/pages/login.jsx` | `pages/auth/LoginPage.jsx` | |
| `components/pages/register.jsx` | `pages/auth/RegisterPage.jsx` | |
| `components/pages/EmailVerification.jsx` | `pages/auth/EmailVerificationPage.jsx` | |
| `components/pages/FestsPage.jsx` | `pages/fests/FestsListPage.jsx` | Public fests |
| `components/pages/view-details.jsx` | `pages/fests/FestDetailPage.jsx` | |
| `components/pages/cultural-fest.jsx` | `pages/fests/CulturalFestPage.jsx` | |
| `components/pages/tech-fest.jsx` | `pages/fests/TechFestPage.jsx` | |
| `components/pages/sports-fest.jsx` | `pages/fests/SportsFestPage.jsx` | |
| `components/pages/FestRegistration.jsx` | `pages/fests/FestRegistrationPage.jsx` | |
| `components/pages/Competitions-view-details.jsx` | `pages/competitions/CompetitionDetailPage.jsx` | Fix PascalCase |
| `components/pages/competition-list.jsx` | `pages/competitions/CompetitionListPage.jsx` | |
| `components/pages/compition-register-page/compition-register-page.jsx` | `pages/competitions/CompetitionRegisterPage.jsx` | Fix typo |
| `components/pages/CompetitionRegistration.jsx` | `pages/competitions/CompetitionRegistrationPage.jsx` | |
| `components/pages/treks-page.jsx` | `pages/treks/TreksHubPage.jsx` | |
| `components/pages/TrekDetailPage.jsx` | `pages/treks/TrekDetailPage.jsx` | |
| `components/pages/TrekBookingPage.jsx` | `pages/treks/TrekBookingPage.jsx` | |
| `components/pages/TrekCategoryPage.jsx` | `pages/treks/TrekCategoryPage.jsx` | |
| `components/pages/CommunityDetailPage.jsx` | `pages/treks/CommunityDetailPage.jsx` | |
| `components/pages/sports-category.jsx` | `pages/sports/SportsCategoryPage.jsx` | |
| `components/pages/RunClubDetailPage.jsx` | `pages/sports/RunClubDetailPage.jsx` | |
| `components/pages/RunEventDetailPage.jsx` | `pages/sports/RunEventDetailPage.jsx` | |
| `components/pages/RunEventBookingPage.jsx` | `pages/sports/RunEventBookingPage.jsx` | |
| `components/pages/events-page.jsx` | `pages/events/EventsHubPage.jsx` | |
| `components/pages/profile-page.jsx` | `pages/profile/ProfilePage.jsx` | |
| `components/pages/profile-pages/booking.jsx` | `pages/profile/BookingPage.jsx` | |
| `components/pages/favorites.jsx` | `pages/profile/FavoritesPage.jsx` | |
| `components/pages/profile-pages/edit-profile.jsx` | `pages/profile/EditProfilePage.jsx` | |
| `components/pages/profile-pages/notification-panel.jsx` | `pages/profile/NotificationsPage.jsx` | |
| `components/pages/profile-pages/help-center.jsx` | `pages/profile/HelpCenterPage.jsx` | |
| `components/pages/profile-pages/list-your-fest.jsx` | `pages/profile/ListYourFestPage.jsx` | |
| `components/pages/PaymentCheckoutPage.jsx` | `pages/payment/PaymentCheckoutPage.jsx` | |
| `components/pages/PaymentInvoicePage.jsx` | `pages/payment/PaymentInvoicePage.jsx` | |
| `components/pages/QRTicketPage.jsx` | `pages/payment/QRTicketPage.jsx` | |
| `components/pages/RegistrationDetails.jsx` | `pages/registration/RegistrationDetailsPage.jsx` | |
| `components/pages/terms-and-conditions.jsx` | `pages/legal/TermsPage.jsx` | |
| `components/pages/privacy-policy.jsx` | `pages/legal/PrivacyPage.jsx` | |
| `components/pages/contact-us.jsx` | `pages/legal/ContactPage.jsx` | |
| `components/pages/refunds-and-cancellations.jsx` | `pages/legal/RefundsPage.jsx` | |
| `components/pages/about.jsx` | `pages/legal/AboutPage.jsx` | |
| `components/pages/products-and-services.jsx` | `pages/legal/ProductsServicesPage.jsx` | |

### 3.2 Frontend — admin & organizer pages

| Current path | Proposed path |
|--------------|---------------|
| `components/admin/AdminLayout.jsx` | `pages/admin/AdminLayout.jsx` |
| `components/admin/AdminDashboardPage.jsx` | `pages/admin/AdminDashboardPage.jsx` |
| `components/admin/FestsPage.jsx` | `pages/admin/AdminFestsPage.jsx` |
| `components/admin/CompetitionsPage.jsx` | `pages/admin/AdminCompetitionsPage.jsx` |
| `components/admin/RegistrationsPage.jsx` | `pages/admin/AdminRegistrationsPage.jsx` |
| `components/admin/AnalyticsDashboardPage.jsx` | `pages/admin/AdminAnalyticsPage.jsx` |
| `components/admin/ScannerAccessPage.jsx` | `pages/admin/AdminScannerAccessPage.jsx` |
| `components/admin/SportsPage.jsx` | `pages/admin/AdminSportsPage.jsx` |
| `components/admin/TreksPage.jsx` | `pages/admin/AdminTreksPage.jsx` |
| `components/admin/AdminEventsPage.jsx` | `pages/admin/AdminEventsPage.jsx` |
| `components/admin/SectionManager.jsx` | `pages/admin/AdminSectionManagerPage.jsx` |
| `components/admin/PageSectionsPage.jsx` | `pages/admin/AdminPageSectionsPage.jsx` |
| `components/admin/AdminProtectedRoute.jsx` | `pages/admin/AdminProtectedRoute.jsx` |
| `components/organizer/*.jsx` | `pages/organizer/{SameName}.jsx` |
| `components/organizer/OrganizerProtectedRoute.jsx` | `pages/organizer/OrganizerProtectedRoute.jsx` |

### 3.3 Frontend — admin feature components (stay out of `pages/`)

| Current path | Proposed path |
|--------------|---------------|
| `components/admin/FestFormModal.jsx` | `features/admin/components/FestFormModal.jsx` |
| `components/admin/Competition_Modal.jsx` | `features/admin/components/CompetitionFormModal.jsx` |
| `components/admin/FestTable.jsx` | `features/admin/components/FestTable.jsx` |
| `components/admin/*FormModal.jsx` | `features/admin/components/` |
| `components/admin/*ScannerSetup.jsx` | `features/admin/components/scanner/` |
| `components/admin/CheckinScannerPage.jsx` | `features/checkin/CheckinScanner.jsx` |
| `components/admin/SectionLivePreview.jsx` | `features/home-sections/SectionLivePreview.jsx` |
| `components/CustomPageSectionsRenderer.jsx` | `features/home-sections/CustomPageSectionsRenderer.jsx` |

### 3.4 Frontend — shared components

| Current path | Proposed path |
|--------------|---------------|
| `components/Navbar.jsx` | `components/layout/Navbar.jsx` |
| `components/Sidebar.jsx` | `components/layout/Sidebar.jsx` |
| `components/Footer.jsx` | `components/layout/Footer.jsx` |
| `components/MobileBottomNav.jsx` | `components/layout/MobileBottomNav.jsx` |
| `components/ProfileSidebar.jsx` | `components/layout/ProfileSidebar.jsx` |
| `components/PageTransition.jsx` | `components/layout/PageTransition.jsx` |
| `components/PageTransitionSkeleton.jsx` | `components/layout/PageTransitionSkeleton.jsx` |
| `components/HomeEventCard.jsx` | `components/cards/HomeEventCard.jsx` |
| `components/HomeEventCardSkeleton.jsx` | `components/cards/HomeEventCardSkeleton.jsx` |
| `components/HeroBanner.jsx` | `components/cards/HeroBanner.jsx` |
| `components/HeroSearchBar.jsx` | `features/search/components/HeroSearchBar.jsx` |
| `components/HeroSearchDropdown.jsx` | `features/search/components/HeroSearchDropdown.jsx` |
| `components/MobileSearchOverlay.jsx` | `features/search/components/MobileSearchOverlay.jsx` |
| `components/MobileSearchHost.jsx` | `features/search/components/MobileSearchHost.jsx` |
| `hooks/useHeroSearch.js` | `features/search/hooks/useHeroSearch.js` |

### 3.5 Frontend — services & lib

| Current path | Proposed path |
|--------------|---------------|
| `services/authService.js` | `services/api/auth.api.js` |
| `services/searchService.js` | `services/api/search.api.js` |
| `services/analyticsService.js` | `services/analytics/analytics.service.js` |
| `utils/api.js` | Split → `services/api/client.js` + `services/api/auth.api.js` |
| `utils/adminApi.js` | `services/api/admin.api.js` |
| `firebase.js` | `lib/firebase/index.js` (+ split modules) |
| `utils/sentry.js` | `lib/sentry.js` |
| `utils/capacitorApp.js` + `capacitorPlatform.js` | `lib/capacitor.js` |
| `utils/cashfreeNative.js` + `bootstrapCashfreeNative.js` | `lib/cashfree.js` |

### 3.6 Frontend — utils regrouping

| Current path | Proposed path |
|--------------|---------------|
| `utils/authBootstrap.js`, `authToken.js`, `loginFlow.js`, `nativeAuth.js`, `socialAuth.js`, `firebaseIdToken.js` | `utils/auth/` |
| `utils/platformFee.js`, `paymentNavigation.js`, `useCashfree.js`, `registrationDraft.js` | `utils/payment/` |
| `utils/fallbackImageGenerator.js`, `imageOptimizer.js`, `imageImports.js` | `utils/image/` |
| `utils/searchNavigation.js`, `buildSearchKeywords.js`, `heroSearchSuggestions.js` | `utils/search/` |
| `utils/categoryHubRoutes.js`, `deepLinks.js`, `loginFlow.js` | `utils/navigation/` |
| `utils/lazyWithRetry.js`, `chunkError.js`, `storage.js`, `bootSplash.js` | `utils/app/` |

### 3.7 Frontend — delete (per audit, before moves)

Do not move — delete in Phase 0:

`EventCard`, `FestCard`, `TrendingCard`, `HappeningCard`, `ViewDetails`, `LoadingSkeleton`, `LoadingBar`, `RouteLoader`, `withPageLoading`, `AppLoadingPage`, `AuthLoadingPage`, `LogoSplash`, `BootSplashOverlay`, `BootLogoAssemble`, `animations/*`, `AdminDashboard.jsx`, `CompetitionRegistrationsAdmin.jsx`, `useBottomNavPageBoot`, `useEnv`, `useBootSplashTheme`, `apiService`, `authFetch`, `errorHandler`, `performanceUtils`, `imageUtils`, `eventsData.js`, `comingSoonEvents.js`, `lastYearHitsEvents.js`, `imagePreprocessor.js`, empty `components/common/`.

### 3.8 Backend — module moves (representative)

| Current path | Proposed path |
|--------------|---------------|
| `model/usermodel.js` | `modules/users/user.model.js` |
| `controllers/usercontroller.js` | `modules/users/user.controller.js` |
| `routers/userroute.js` | `modules/users/user.routes.js` |
| `model/student&participant.js` | `modules/students/student.model.js` |
| `controllers/studentController.js` | `modules/students/student.controller.js` |
| `routers/studentroute.js` | `modules/students/student.routes.js` |
| `model/fest_organizer_model.js` | `modules/fests/festOrganizer.model.js` |
| `controllers/festOrganizerController.js` | `modules/fests/festOrganizer.controller.js` |
| `routers/publicFestRoute.js` | `modules/fests/fest.public.routes.js` |
| `routers/festOrganizerRoute.js` | `modules/fests/festOrganizer.routes.js` |
| `controllers/registrationController.js` | `modules/registrations/registration.controller.js` |
| `routers/adminRoute.js` | Split → `modules/admin/*.routes.js` + thin handlers |
| `middleware/authmiddleware.js` | `shared/middleware/auth.middleware.js` |
| `services/emailService.js` | `shared/services/email.service.js` |
| `utils/logger.js` | `shared/utils/logger.js` |

*Full backend mapping follows the same pattern for all 19 models and 27 routers.*

---

## 4. Folder Consolidation

### Frontend consolidations

| From | To | Rationale |
|------|-----|-----------|
| `components/pages/` | `pages/{domain}/` | Pages are not components |
| `components/pages/profile-pages/` | `pages/profile/` | Flatten one level |
| `components/admin/` (pages) | `pages/admin/` | Route screens separate from modals |
| `components/admin/` (modals, tables) | `features/admin/components/` | Feature colocation |
| `components/organizer/` | `pages/organizer/` | All routable |
| `components/animations/` | **Delete** | Duplicate of `motion/` |
| `components/common/` | **Delete** | Empty |
| 50+ root `components/*.jsx` | `components/layout/`, `components/cards/`, `components/ui/`, `features/*` | Group by role |
| Flat `utils/` (49 files) | `utils/{domain}/` + `services/api/` | Separate I/O from pure helpers |
| `services/` (4 files) | `services/api/` + `services/analytics/` | API vs analytics |
| `firebase.js` at root | `lib/firebase/` | Infrastructure namespace |
| `data/real-data/` | `data/competitions/` | Clear purpose; fix typo folders |
| `index.css` monolith | `styles/` directory | Maintainability |

### Backend consolidations

| From | To | Rationale |
|------|-----|-----------|
| `model/` + `models/index.js` | `modules/*/*.model.js` + `models/index.js` | Single model location per domain |
| Flat `controllers/` (27) | `modules/{domain}/*.controller.js` | Domain boundaries |
| Flat `routers/` (27) | `modules/{domain}/*.routes.js` | Co-locate with controller |
| `routes/index.js` | Keep as mount table | Only wiring |
| Fat `adminRoute.js` | `modules/admin/`, `modules/fests/`, etc. | Split by resource |
| `middleware/` | `shared/middleware/` | Cross-cutting |
| `services/` | `shared/services/` + `modules/notifications/notification.service.js` | Move domain logic out of controllers |
| `utils/` | `shared/utils/` + domain utils in modules | e.g. `paymentVerification` → `modules/payments/` |

### Cross-cutting consolidation

| Concern | Current state | Target |
|---------|---------------|--------|
| HTTP client | 4+ patterns | `services/api/client.js` |
| Auth token fetch | Inline in 3 files + dead `authFetch.js` | `client.authenticatedFetch()` |
| Search keywords | FE builder + BE util + API | API authoritative; FE thin wrapper |
| Platform fee | FE util + BE util + inline | Single `shared` contract documented in both |
| QR check-in | FE + BE separate utils | Shared spec doc; keep split implementations |
| Scanner UI | `admin/CheckinScannerPage` used by organizer | `features/checkin/CheckinScanner` |

---

## 5. Naming Standardization

### Frontend conventions

| Artifact | Convention | Example |
|----------|------------|---------|
| Page components | PascalCase + `Page` suffix | `FestDetailPage.jsx` |
| Shared components | PascalCase | `HomeEventCard.jsx` |
| Hooks | camelCase + `use` prefix | `useHeroSearch.js` |
| Context files | PascalCase + `Context` | `AuthContext.jsx` |
| API modules | camelCase + `.api.js` | `fests.api.js` |
| Pure utils | camelCase | `buildSearchKeywords.js` |
| Constants | camelCase file, SCREAMING_SNAKE exports | `trekFilters.js` |
| Folders | kebab-case for domains | `pages/run-clubs/` optional; prefer `sports/` |
| Routes in URL | kebab-case (unchanged) | `/competition-registration/:id` |
| CSS files | kebab-case | `home-event-card.css` |

**Renames to fix existing typos**

| Current | Proposed |
|---------|----------|
| `compition-register-page/` | `competition-register/` or flat `CompetitionRegisterPage.jsx` |
| `Competition_Modal.jsx` | `CompetitionFormModal.jsx` |
| `Competitions-view-details.jsx` | `CompetitionDetailPage.jsx` |
| `admin/FestsPage.jsx` | `AdminFestsPage.jsx` |
| `treks-page.jsx` | `TreksHubPage.jsx` |
| `events-page.jsx` | `EventsHubPage.jsx` |

### Backend conventions

| Artifact | Convention | Example |
|----------|------------|---------|
| Models | camelCase + `.model.js` | `festOrganizer.model.js` |
| Controllers | camelCase + `.controller.js` | `festOrganizer.controller.js` |
| Routes | camelCase + `.routes.js` | `fest.public.routes.js` |
| Middleware | camelCase + `.middleware.js` | `auth.middleware.js` |
| Services | camelCase + `.service.js` | `email.service.js` |
| Utils | camelCase | `qrCheckin.js` |
| Mongoose model name | PascalCase singular | `FestOrganizer` |

**Renames to fix existing inconsistencies**

| Current | Proposed |
|---------|----------|
| `usercontroller.js` | `user.controller.js` |
| `userroute.js` | `user.routes.js` |
| `studentroute.js` | `student.routes.js` |
| `authmiddleware.js` | `auth.middleware.js` |
| `student&participant.js` | `student.model.js` |
| `fest_organizer_model.js` | `festOrganizer.model.js` |
| `*_model.js` suffix | `*.model.js` |

### Domain glossary (document in `docs/DOMAIN.md`)

| Term | Model | Meaning |
|------|-------|---------|
| Fest | `festOrganizer` | College fest listing |
| Fest event | `event` | Sub-event within a fest |
| Platform event | `platformEvent` | Platform-wide promoted event |
| Event show | `eventShow` | Theatre/shows (was “theatre”) |
| Competition | `competition` | Competition within a fest |
| Registration | `registration` | Fest/competition signup |
| Trek | `trek` | Trek listing |
| Sports event | `sports` | Run race / sports event |
| Run club | `runClub` | Community run club |

---

## 6. Architecture Improvements

### 6.1 Frontend routing

**Today:** All routes and lazy imports live in `App.jsx`.

**Proposed:**

```
app/router/
  index.jsx           # <Routes> wrapper
  public.routes.jsx   # /, /fests, /treks, …
  admin.routes.jsx    # /admin/*
  organizer.routes.jsx
  redirects.jsx       # legacy Navigate redirects
```

Benefits: smaller `App.jsx`, route ownership per area, easier code-splitting audits.

### 6.2 Frontend data layer

```
Page → custom hook (features/*/hooks) → services/api/*.api.js → client.js
```

- Pages do not call `fetch` directly.
- Contexts only hold UI state; server state fetched in hooks.
- `RegisteredEventsContext` / `FavoritesContext` remain; add React Query later if needed (optional).

### 6.3 Backend layering

```
routes → controller → service → model
                ↓
            shared/utils
```

**Rules:**

- Routers: HTTP wiring only (parse params, call controller, send response).
- Controllers: request validation, orchestration, status codes.
- Services: email, push, sheets, cashfree, check-in side effects.
- **No** `service → controller` imports — extract `notification.service.js` from `notificationController.js`.

### 6.4 Backend admin route split

Split `adminRoute.js` (726 lines) into:

```
modules/admin/admin.routes.js        # auth, dashboard
modules/fests/fest.admin.routes.js   # fest CRUD (from adminRoute)
modules/homepage/homepage.admin.routes.js
```

### 6.5 Registration controller split

Split `registrationController.js` (1,807 lines) into:

```
registration.controller.js       # HTTP handlers
registration.fest.service.js     # fest registration logic
registration.competition.service.js
registration.payment.service.js  # delegates to payments module
```

### 6.6 CSS architecture

```
styles/
  tokens.css        # colors, spacing, fonts
  layout.css        # app shell, grid
  components/       # card, nav, modal
  pages/            # page-specific overrides
  index.css         # @import all
```

### 6.7 Vite path aliases (add in `vite.config.js`)

```js
resolve: {
  alias: {
    '@app': '/src/app',
    '@pages': '/src/pages',
    '@components': '/src/components',
    '@features': '/src/features',
    '@services': '/src/services',
    '@lib': '/src/lib',
    '@utils': '/src/utils',
    '@hooks': '/src/hooks',
    '@context': '/src/context',
    '@assets': '/src/assets',
  },
}
```

Reduces deep `../../../` paths after restructuring.

---

## Migration Plan

### Overview

| Phase | Focus | Duration | Risk | PR strategy |
|-------|-------|----------|------|-------------|
| **0** | Dead code deletion (audit Phase 1) | 1–2 days | Low | 1 PR |
| **1** | Frontend route extraction | 2–3 days | Low | 1 PR |
| **2** | Frontend pages move | 3–5 days | Medium | 1 PR per domain |
| **3** | Frontend services/lib consolidation | 3–4 days | Medium | 1–2 PRs |
| **4** | Frontend components + utils regroup | 3–5 days | Medium | 1 PR per group |
| **5** | CSS split | 2–3 days | Medium | 1 PR |
| **6** | Backend naming normalization | 2–3 days | Medium | 1 PR per module group |
| **7** | Backend module folders | 5–8 days | High | 1 domain per PR |
| **8** | Architecture hardening | Ongoing | Medium | Per feature |

**Total estimate:** 4–6 weeks part-time, or 2–3 weeks focused.

---

### Phase 0 — Prerequisites (audit cleanup) ✅ **Complete**

**Goal:** Remove noise before moves.

- [x] Delete all dead files listed in CODEBASE_CLEANUP_AUDIT.md Phase 1–2
- [x] Remove unused npm packages (audit Phase 3)
- [x] Remove empty `components/common/` (was empty; `animations/` emptied by deletions)
- [x] Run `npm run build` + smoke test mobile nav, admin login, fest detail, competition register
- [ ] Tag release: `pre-restructure-baseline` (optional)

**Delivered:** See [DEAD_CODE_REMOVAL.md](./DEAD_CODE_REMOVAL.md) — 37 source files deleted, 8 deps removed.

---

### Phase 1 — Extract router from App.jsx ✅ **Complete**

**Goal:** Routing structure without moving pages yet.

1. [x] Create `src/app/router/publicRoutes.jsx` — public `<Route>` elements
2. [x] Create `adminRoutes.jsx`, `organizerRoutes.jsx`, `redirects.jsx`
3. [x] Slim `App.jsx` to providers + layout shell (546 → **393 lines**)
4. [x] `lazyPages.js` centralizes all lazy imports pointing at `pages/*`

**Files created:**

| File | Role |
|------|------|
| `app/router/index.jsx` | Exports `<AppRoutes />` |
| `app/router/lazyPages.js` | Eager Dashboard/Booking + lazy everything else |
| `app/router/publicRoutes.jsx` | Public + profile + payment routes |
| `app/router/adminRoutes.jsx` | Nested `/admin/*` |
| `app/router/organizerRoutes.jsx` | `/organizer/*` |
| `app/router/redirects.jsx` | `/dashboard`, `/theatre`, `/registered-fest`, admin theatre |

**Verification:** `npm run build` passes; all URLs unchanged.

---

### Phase 2 — Move pages by domain ✅ **Complete**

**Order executed:**

1. [x] `pages/legal/` — 6 static pages
2. [x] `pages/auth/` — login, register, EmailVerification
3. [x] `pages/profile/` — 7 files (was `profile-pages/`)
4. [x] `pages/payment/` — checkout, invoice, QR ticket
5. [x] `pages/events/`, `pages/treks/`, `pages/sports/`
6. [x] `pages/fests/`, `pages/competitions/`
7. [x] `pages/home/` — Dashboard
8. [x] `pages/admin/` (13 route screens), `pages/organizer/` (6 screens)
9. [x] `pages/registration/` — RegistrationDetails
10. [x] Deleted duplicate copies in `components/pages/` and `components/organizer/` (47 files)

**Still in `components/admin/`:** modals, `CheckinScannerPage`, `FestFormModal`, `Competition_Modal`, scanner setup — moved in Phase 4.

**Import fix:** `scripts/fix-page-imports.mjs` + manual fixes for nested `compition-register-page/`.

---

### Phase 3 — Services & lib layer ✅ **Complete (foundation)**

1. [x] Create `services/api/client.js` — `resolveUrl`, `publicFetch`, `publicFetchJSON`, `userFetchJSON`
2. [x] Migrate `adminApi.js` → `admin.api.js` using client
3. [x] `auth.api.js` shim re-exports `authAPI` from `utils/api.js` (full auth slice migration deferred)
4. [x] Migrate `searchService.js` → `search.api.js`
5. [ ] Move `firebase.js` → `lib/firebase/` (Phase 4)
6. [ ] Migrate all page inline `fetch` to API modules (incremental)

**Backward-compat shims (keep until consumers migrated):**

```js
// utils/adminApi.js
export * from '../services/api/admin.api.js';

// services/searchService.js
export * from './api/search.api.js';
```

**Verification:** Admin pages still import `utils/adminApi`; search still imports `services/searchService` — both resolve to new layer.

---

### Phase 4 — Components & features regroup

1. Create `components/layout/`, `components/cards/`, `components/ui/`
2. Move layout components (Navbar, Sidebar, Footer, …)
3. Create `features/search/`, `features/checkin/`, `features/admin/components/`
4. Regroup `utils/` into subfolders
5. Add Vite path aliases; migrate imports opportunistically

**Verification:** Visual regression on home, fest detail, admin dashboard.

---

### Phase 5 — CSS split

1. Create `styles/tokens.css` — extract CSS variables from `index.css`
2. Extract `styles/layout.css`, `styles/components/cards.css`, etc.
3. Replace `index.css` body with `@import` chain
4. Confirm Tailwind/vite still processes entry `styles/index.css` or keep `src/index.css` as one-line importer

**Verification:** Compare home + admin in light/dark mode.

---

### Phase 6 — Backend naming (no folder move yet)

1. Rename `usercontroller.js` → `user.controller.js` (and routes/models similarly)
2. Rename `student&participant.js` → `student.model.js`
3. Rename `*_model.js` → `*.model.js` via `git mv`
4. Update all `require()` paths
5. Add `homepage_section_model` to `models/index.js`

**Verification:** `npm run dev`; hit `/api/health`, `/api/users`, `/api/fests`.

---

### Phase 7 — Backend module folders

**Order:**

1. `modules/search/`, `modules/analytics/` (small, leaf)
2. `modules/users/`, `modules/students/`
3. `modules/notifications/` + extract `notification.service.js`
4. `modules/payments/`
5. `modules/competitions/`, `modules/registrations/`
6. `modules/fests/` (largest)
7. `modules/treks/`, `modules/sports/`, `modules/events/`
8. Split `adminRoute.js` last

**Per module PR:**

- [ ] `git mv` model, controller, routes together
- [ ] Update `routes/index.js` require paths
- [ ] Update `models/index.js` require paths
- [ ] Run server; test module endpoints

**Rollback:** One domain revert at a time.

---

### Phase 8 — Architecture hardening (ongoing)

- [ ] Consolidate trek payment verification (3 paths → 1)
- [ ] Extract inline logic from `publicFestRoute`, `publicTrekRoute`
- [ ] Split mega-modals when next edited
- [ ] Add `docs/DOMAIN.md` glossary
- [ ] Consider root `package.json` removal or workspace setup
- [ ] Re-run CODEBASE_CLEANUP_AUDIT.md; target score **75+**

---

## Migration Safety Checklist

Use before merging every restructuring PR:

```
[ ] npm run build          (frontend)
[ ] npm run dev + smoke     (backend /api/health)
[ ] Login / register flow
[ ] Home → fest detail → register
[ ] Competition register (/competition-register)
[ ] Trek book + payment return
[ ] Admin login + fest list
[ ] Organizer scanner login
[ ] Capacitor: npm run cap:sync (if aliases or assets changed)
[ ] No new circular imports (manual review)
```

---

## Success Metrics

| Metric | Baseline | After Phase 0 | **Current (Phases 1–3)** | Target |
|--------|----------|---------------|--------------------------|--------|
| Audit health score | 58/100 | ~68/100 | **76/100** | ≥ 75/100 ✅ |
| Orphan frontend files | ~30 | 0 | **0** | 0 ✅ |
| `App.jsx` line count | ~548 | ~548 | **393** | < 150 |
| Flat utils count | 49 | 43 | **43** | 0 (all subfoldered) |
| Inline `fetch` in pages | 40+ files | 40+ | **~35** | 0 |
| Backend flat controllers | 27 | 27 | **27** | 0 (all in modules) |
| `adminRoute.js` lines | 726 | 726 | **726** | < 100 (mount only) |
| `index.css` lines | 2,270 | 2,270 | **2,270** | < 200 (import hub) |
| Naming exceptions | 10+ files | 10+ | **10+** | 0 |

---

## What NOT to do in migration

1. **Do not** rename public URL paths unless adding redirects (keep `/view-details`, `/competition-register`, etc.).
2. **Do not** merge `FestFormModal` splits in the same PR as folder moves.
3. **Do not** change API response shapes during structural PRs.
4. **Do not** move and refactor logic in the same PR — moves only, then refactor.
5. **Do not** delete `backend/scripts/` — keep ops tooling in place.

---

*Phases 0–3 implemented 2026-06-15. Execute Phase 4+ when ready. Companion docs: [CODEBASE_CLEANUP_AUDIT.md](./CODEBASE_CLEANUP_AUDIT.md), [DEAD_CODE_REMOVAL.md](./DEAD_CODE_REMOVAL.md).*
