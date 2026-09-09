# CrwdCtrl audit backlog (living)

Last updated: 2026-09-09  
Sources: production screenshots, live probes, browser smoke, code review (product + UI/load audits).

Severity: **P0** money/access · **P1** conversion · **P2** glitch · **P3** polish

## Product / access (D-series)

| ID | Sev | Surface | Issue | Status | Files / notes |
|----|-----|---------|-------|--------|---------------|
| D1 | P0 | Infra | Apex `crwdctrl.in` returns Railway edge fallback (`x-railway-fallback: true`) | **Ops open** | Attach apex to frontend or redirect to www |
| D2 | P0 | IAB | Instagram Open in Chrome → `intent://` stuck loading | **Fixed in code** | `openInExternalBrowser.js`, gates |
| D3 | P1 | IAB | iOS Instagram cannot force Safari 100% | **Mitigated** | Copy + ⋯ instructions |
| D4 | P1 | Portals | Login links used apex / wrong origin | **Fixed in code** | `siteUrl.js`, `publicWebOrigin.js` |
| D5–D17 | — | — | See prior product audit rows (IAB gates, DEBUG, portals) | Mostly **fixed** | Prior waves |

## UI / load / glitch (U-series)

| ID | Sev | Surface | Issue | Status | Files / notes |
|----|-----|---------|-------|--------|---------------|
| U1 | P1 | Sports | Run detail always cleared seed/cache → forced full 3D loader (felt late) | **Fixed** | `RunEventDetailPage.jsx` paints seed/cache first |
| U2 | P1 | Router | Event show `/events/:id` not skipped by PageTransition → double skeleton risk | **Fixed** | `PageTransition.jsx` skips `/events/*` |
| U3 | P1 | Loaders | Missing failsafe / ready signal on run club, event register, competition list, QR ticket, etc. | **Fixed** | `useDetailLoaderFailsafe` + `signalDetailPageReady` |
| U4 | P1 | Deploy | Stale chunk → ErrorBoundary “Update available” traps users | **Fixed** | Auto `forceRecoverFromStaleDeploy` in `ErrorBoundary.jsx` |
| U5 | P2 | Fests | Artificial `COMPETITION_DEMO_LOAD_MS` (80ms+) felt like lag | **Fixed** | Set to `0` in `skeletonLoading.js` |
| U6 | P2 | Book | Login overlay stacked under booking DetailPageLoader | **Fixed** | Run + event-community booking: loader alone while loading |
| U7 | P2 | Layout | Competition register `pb-24` weak vs safe-area + bottom nav | **Fixed** | Safer bottom padding |
| U8 | P2 | Portals | Full 3D loader on organizer session check could stick | **Fixed** | Inline loader + failsafe → guest login |
| U9 | P2 | Sports | Run club showPageLoader ignored seeded club when `loading` true | **Fixed** | `(loading && !club)` pattern |
| U10 | P3 | Hubs | Image CLS on cards | **Monitor** | `HomeEventCard` already uses placeholder-until-load |
| U11 | P3 | Home | Cold open can hit SW/chunk boundary after deploy | **Mitigated** | U4 auto-recover; re-smoke after deploy |

## UI/load smoke (2026-09-09)

| Check | Result |
|-------|--------|
| `/` www | Sometimes chunk “Update available” (U4 fix local) |
| `/sports` | Hub content loads |
| `/sports/run/miles-before-music` | Detail loads after API (~few s cold); seed/cache paint fixed locally |
| `/fests`, `/events`, `/treks`, `/booking`, `/profile` | HTTP 200 SPA |
| Instagram cold deep link | Re-verify after frontend deploy |

## Portal URL matrix (canonical)

| Role | Login |
|------|-------|
| Event community | https://www.crwdctrl.in/event-community-organizer/login |
| Theatre / shows | https://www.crwdctrl.in/event-organizer/login |
| Fest | https://www.crwdctrl.in/fest-organizer/login |
| Run club | https://www.crwdctrl.in/run-club-organizer/login |
| Trek | https://www.crwdctrl.in/trek-organizer/login |
| Scanner | https://www.crwdctrl.in/organizer/login |

## Remaining ops

1. Railway apex → frontend (not API) — still blocks D1.  
2. Deploy frontend so U-series + IAB fixes hit production.  
3. Re-smoke Instagram Open in Chrome + run/fest/event book after deploy.
