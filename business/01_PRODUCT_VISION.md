# CrwdCtrl — Product Vision

> The definitive platform for discovering and connecting with real-world experiences, communities, and events in India.

---

## Executive Summary

CrwdCtrl is a **youth experience platform** built to solve the fundamental problem of discovery and connection in India's fragmented event and community ecosystem. Students and young professionals miss countless college fests, treks, run clubs, marathons, theatre shows, and community meetups — not because they don't exist, but because they're invisible, buried in WhatsApp groups, Instagram stories, or word-of-mouth networks.

CrwdCtrl aggregates, curates, and surfaces these experiences with seamless registration, payments, and community tools — becoming the single destination where young India finds "what's happening near me."

---

## Current State

### Product Reality (as of June 2026)

| Dimension | Status |
|-----------|--------|
| **Platform maturity** | MVP/Beta — launch readiness score **78/100** |
| **Core verticals live** | College fests, Treks, Run clubs, Sports, Theatre |
| **Tech stack** | React 19 + Vite (Vercel), Express 5 + MongoDB (Railway), Capacitor Android |
| **Domain** | crwdctrl.in |
| **Mobile** | Android app via Capacitor (Play Store submission pending) |
| **Payments** | Cashfree integration (live, production-ready) |
| **Authentication** | Email/password + Google OAuth via Firebase |

### Categories Supported

CrwdCtrl is organized around **four top-level hubs**: Fests, Sports, Treks, and Events.

| Hub / Category | Sub-Types | Public Discovery | Registration | Payments | Admin CRUD |
|----------------|-----------|-----------------|--------------|----------|------------|
| **Fests** | Cultural, Technical, Sports | ✅ | ✅ | ✅ | ✅ |
| **Competitions** (under fests) | 26 types (hackathon, dance, quiz, etc.) | ✅ | ✅ | ✅ | ✅ |
| **Sports** | Run clubs, Marathons, Sport clubs (football, cricket, badminton, gymkhana) | ✅ | ✅ | ✅ | ✅ |
| **Treks** | Hiking, Trail, Backpacking, Camping, Adventure, Nature | ✅ | ✅ | ✅ | ✅ |
| **Trek Communities** | Trek organizer profiles | ✅ | ✅ | — | ✅ |
| **Run Clubs** | Social/Morning/Night/Long/Trail runs | ✅ | ✅ | — | ✅ |
| **Events** (cultural shows) | Play, Musical, Standup, Improv, Dance Drama | ✅ | ✅ | ✅ | ✅ |

> Note: "Theatre" was renamed to "Events" in the codebase (legacy `/theatre` redirects to `/events`). There is **no dedicated "gym community" entity** — the closest match is the `gymkhana` sport-club type under the Sports hub.

### Core User Flows (Implemented)

1. **Discovery** → Browse fests/treks/events by category, location, search
2. **Registration** → Dynamic forms, fee calculation, Cashfree payment
3. **Confirmation** → QR ticket generation, email receipt, push notification
4. **Check-in** → Admin QR scanner for on-ground verification
5. **Community** → Trek community profiles, run club listings

---

## Product Vision

### The 3-Year North Star

**"Every young person in India opens CrwdCtrl to answer: What's happening near me this weekend?"**

CrwdCtrl becomes the **default layer** between:
- **Students** and the experiences they're missing
- **Organizers** and the audiences they can't reach
- **Communities** and the members they're trying to grow

### Mission Statement

> To make real-world experiences — fests, treks, run clubs, meetups, shows — as discoverable and accessible as streaming a movie or ordering food.

### Vision Principles

1. **Discovery over curation** — Surface everything, let users filter. Don't gatekeep.
2. **IRL over feed** — Every interaction should lead to someone showing up somewhere.
3. **Tools for organizers** — If organizers win, users win. Build for supply first.
4. **Community as moat** — Recurring communities (run clubs, trek groups) are stickier than one-off events.
5. **Mobile-first, student-first** — Design for 20-year-olds on phones, not 35-year-olds on laptops.

---

## Opportunities

### 1. Massive Underserved Market

| Segment | Scale | Current Solutions |
|---------|-------|-------------------|
| College students in India | 40M+ enrolled | Instagram, WhatsApp, posters |
| Running/fitness communities | Fastest-growing hobby segment | Strava (solo), local groups (fragmented) |
| Trek enthusiasts | 10M+ estimated | Individual organizers, no aggregation |
| Live events (theatre, open mics) | Growing urban segment | BookMyShow (tickets, not discovery) |

### 2. No Dominant Platform

- **BookMyShow** = ticketing for concerts/movies, not community events
- **Meetup.com** = Western, dead in India for youth
- **Insider.in** = Metro events, not campus/community-native
- **WhatsApp** = Unstructured, unsearchable, no payments

CrwdCtrl can own the **long-tail**: campus fests, local treks, neighborhood run clubs, college theatre.

### 3. Network Effects at Local Scale

Each city/campus is a mini-network:
- More events listed → more users discover → more organizers list → flywheel
- Communities that grow on CrwdCtrl become locked in (members, history, payments)

### 4. Platform Fee Model Works

3% platform fee on paid registrations is:
- Low enough organizers accept it
- High enough to sustain at scale (see Revenue Model doc)

---

## Risks

### Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Organizers prefer WhatsApp/free tools | High | High | Make CrwdCtrl's reach + tools irresistible |
| Users browse but don't convert | Medium | High | FOMO content, push notifications, reminders |
| Payment failures lose trust | Medium | High | Cashfree webhooks (in progress), error handling |
| Mobile app rejected by Play Store | Low | Medium | Compliance checklist in place |

### Technical Risks

| Risk | Status | Mitigation |
|------|--------|------------|
| No automated tests | ⚠️ Open | Prioritize API integration tests |
| JWT in localStorage (XSS risk) | ⚠️ Open | Move to httpOnly cookies |
| In-memory cache won't scale | ⚠️ Open | Redis/distributed cache |
| Single admin credential | ⚠️ Open | Multi-admin support |

### Market Risks

- **Low-frequency usage**: Events happen weekly/monthly, not daily
- **Regional fragmentation**: Different cities have different event cultures
- **Competitor entry**: BookMyShow or Paytm could enter with distribution advantage

---

## Recommendations

### Short-Term (0–90 Days)

1. **Complete Android Play Store launch** — Mobile is where students live
2. **Add Cashfree webhooks** — Never lose a paid registration to client-side failures
3. **Onboard 50–100 organizers** — Supply drives discovery
4. **Launch 3–5 campus pilot programs** — Deep penetration beats wide reach
5. **Ship automated tests** — Foundation for velocity

### Medium-Term (90–180 Days)

1. **City expansion playbook** — Replicate MIT-WPU success in 3 new campuses/cities
2. **Organizer self-serve dashboard** — Reduce founder dependency
3. **Community recurring events** — Run club weekly meetups, trek monthly schedules
4. **Referral system** — Users invite friends, organizers invite organizers
5. **Analytics for organizers** — Show them why CrwdCtrl is better than a Google Form

### Long-Term (180+ Days)

1. **iOS app** — Capture the other half of mobile users
2. **Sponsorship marketplace** — Connect brands with event organizers
3. **Creator tools** — Let community builders monetize (courses, memberships)
4. **Data moat** — Proprietary insights on youth event preferences, pricing, attendance patterns

---

## Success Metrics

### North Star Metric

**Monthly Active Registrations** — Users who register for at least one event/community per month.

### Supporting Metrics

| Metric | Current | 90-Day Target | Why It Matters |
|--------|---------|---------------|----------------|
| Active organizers | ~10–20 | 75–100 | Supply drives everything |
| Monthly registrations | — | 1,000+ | Core conversion |
| Repeat users (2+ events) | — | 20%+ | Stickiness signal |
| Mobile app installs | 0 | 500+ | Primary surface |
| Avg. registration completion | — | 70%+ | Funnel health |

---

## Product Roadmap Evidence

Based on codebase analysis, the following features are built or in progress:

| Feature | Status | Evidence |
|---------|--------|----------|
| Public discovery (fests, treks, sports, theatre) | ✅ Live | Routes, controllers, frontend pages |
| Registration + payments | ✅ Live | Cashfree integration, registration controller |
| QR check-in | ✅ Live | QR routes, admin scanner |
| Push notifications | ✅ Live (conditional) | FCM integration, service worker |
| Event reminders | ✅ Wired | Reminder cron initialized |
| Android app | 🔄 Pending Play Store | Capacitor config, build scripts |
| Theatre public browse | ✅ Live | Route + page added in production hardening |
| Admin dashboard | ✅ Live | 10+ admin routes, full CRUD |

---

*This document reflects the actual state of CrwdCtrl as of June 2026. All features and capabilities cited are verified against the codebase.*
