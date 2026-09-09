# CrwdCtrl audit backlog (living)

Last updated: 2026-09-09  
Sources: production screenshots, live probes, browser smoke, code review (Wave 0–3).

Severity: **P0** money/access · **P1** conversion · **P2** glitch · **P3** polish

| ID | Sev | Surface | Issue | Status | Files / notes |
|----|-----|---------|-------|--------|---------------|
| D1 | P0 | Infra | Apex `crwdctrl.in` returns Railway edge fallback (`x-railway-fallback: true`) — train Not Found; never reaches Express/Caddy | **Ops open** | Attach apex to **frontend** service or redirect-only. Code: `errorHandler` HTML→www, Caddy `@apex` redir, `vercel.json` host redirect, docs in DEPLOYMENT.md. Workaround: always **www**. |
| D2 | P0 | IAB | Instagram Open in Chrome navigated WebView to `intent://` → stuck loading | **Fixed in code** | `openInExternalBrowser.js`, `InAppOpenChromeGate`, `/open-browser` helper |
| D3 | P1 | IAB | iOS Instagram cannot force Safari 100% | **Mitigated** | Best-effort schemes + copy + ⋯ instructions |
| D4 | P1 | Portals | Login emails/admin copy used apex or `window.location.origin` | **Fixed in code** | `siteUrl.js`, `publicWebOrigin.js`, admin organizer pages, scanner setup |
| D5 | P1 | Events | Booking loader under Chrome gate | **Fixed** | `EventCommunityBookingPage` prefers gate over loader |
| D6 | P1 | Sports | Run booking lacked Instagram Chrome gate / pay gate | **Fixed** | `RunEventBookingPage.jsx` |
| D7 | P2 | Campus Hunt | Offline install used `location.href = intent://` | **Fixed** | `OfflineHuntInstallHelp.jsx` → `launchExternalBrowserFromTap` |
| D8 | P2 | Admin | No portal URL matrix; easy to mix event-community vs event-show | **Fixed** | Admin dashboard matrix + `ORGANIZER_LOGIN_MATRIX` |
| D9 | P2 | Noise | DEBUG `console.log` in fest/public/search/registration | **Fixed** | Navbar, publicFestRoute, CompetitionRegistration, FestFormModal |
| D10 | P2 | Analytics | Fest/competition view tracking was unused; scoped admin activity thin | **Earlier fix** | `trackFestView` / `trackCompetitionView` + `/admin/user-activity/scoped` |
| D11 | P1 | Fests | Coupon apply + Cashfree amount mismatch edge cases | **Monitor** | Smoke paid fest after deploy; validate coupon consume in payment webhook |
| D12 | P1 | Payments | Dual Cashfree (platform vs events hub) env misconfig risk | **Monitor** | `DEPLOYMENT.md` / `.env.example` Delulu keys; smoke event-community paid book |
| D13 | P2 | Loaders | Double splash / failsafe gaps on some detail pages | **Mitigated** | Failsafe on fest/event/run details; gate-before-loader on booking flows |
| D14 | P3 | Docs | DEPLOYMENT listed apex as equal peer host | **Fixed** | Canonical www + apex ops warning |
| D15 | P3 | Copy | Portal naming confusion in WhatsApp support | **Mitigated** | Admin dashboard matrix; support: send www URLs only |
| D16 | P1 | Fests | Competition registration missing IAB Chrome/pay gate | **Fixed** | `CompetitionRegistration.jsx` |
| D17 | P1 | Events | Event show registration missing IAB Chrome/pay gate | **Fixed** | `EventRegistrationPage.jsx` |

## Smoke checklist (Phase A)

| Check | Device / host | Result (2026-09-09) |
|-------|---------------|---------------------|
| `https://www.crwdctrl.in/event-community-organizer/login` | browser + curl | **200** — login form renders |
| `https://www.crwdctrl.in/event-organizer/login` | curl | **200** SPA |
| `https://www.crwdctrl.in/fest-organizer/login` | curl | **200** SPA |
| `https://crwdctrl.in/event-community-organizer/login` | curl | **404** Railway fallback (ops) |
| `https://www.crwdctrl.in/` | curl | **200** |
| `https://www.crwdctrl.in/fests` | browser | Hub loads |
| `https://www.crwdctrl.in/sports` | browser | Hub loads |
| `https://www.crwdctrl.in/events` | browser | Hub loads |
| `https://www.crwdctrl.in/open-browser?to=…` | curl | **200** SPA |
| Instagram Open in Chrome (Android) | manual post-deploy | Verify after next frontend deploy of handoff |
| Organizer login via www | browser | Use www URL now — works |
| Fest register + coupon + pay | Chrome www | Pending post-deploy of this branch |
| Event community book + pay | Chrome www | Pending post-deploy of this branch |
| Run book + pay | Chrome www | Pending post-deploy of this branch |
| Competition register pay (IAB) | Instagram | Pending post-deploy (gate added) |
| Event show register pay (IAB) | Instagram | Pending post-deploy (gate added) |

## Portal URL matrix (canonical)

| Role | Login |
|------|-------|
| Event community | https://www.crwdctrl.in/event-community-organizer/login |
| Theatre / shows | https://www.crwdctrl.in/event-organizer/login |
| Fest | https://www.crwdctrl.in/fest-organizer/login |
| Run club | https://www.crwdctrl.in/run-club-organizer/login |
| Trek | https://www.crwdctrl.in/trek-organizer/login |
| Scanner | https://www.crwdctrl.in/organizer/login |

## Wave status

| Wave | Status |
|------|--------|
| Wave 0 | Code + docs done; **Railway apex DNS still ops** |
| Phase A | www matrix smoked (curl + browser); Instagram device pass after deploy |
| Phase B / C | This backlog frozen as living punch-list |
| Wave 1 | Handoff single API, www origin, loader policy, portal matrix |
| Wave 2 | Competition + event-show + run booking IAB/pay gates |
| Wave 3 | Admin matrix, DEBUG purge, DEPLOYMENT ops note |

## Remaining ops action (blocks D1)

1. Railway → custom domains for **frontend** service: ensure `crwdctrl.in` and `www.crwdctrl.in` both attached to frontend (or apex CNAME/redirect to www).  
2. Confirm `curl -sI https://crwdctrl.in/` no longer shows `x-railway-fallback: true`.  
3. Backend `FRONTEND_URL=https://www.crwdctrl.in` on Railway.  
4. Deploy this branch’s frontend+backend so IAB/gates/siteUrl land in production.
