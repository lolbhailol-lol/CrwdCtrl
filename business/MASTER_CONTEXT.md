# CrwdCtrl — Master Context

> The complete company knowledge base for AI agents, strategic planning, and stakeholder communication.

---

## Document Purpose

This document serves as the **single source of truth** for understanding CrwdCtrl. It synthesizes all business strategy documents, technical documentation, and product capabilities into one comprehensive reference.

**Use this document for:**
- AI agent context (Claude Projects, GPT assistants)
- Investor conversations
- Team onboarding
- Strategic planning sessions
- Content creation reference

---

## Company Overview

### What is CrwdCtrl?

**CrwdCtrl** is a **community and event discovery platform** where users discover college fests, running clubs, gym communities, meetups, treks, theatre shows, and student events in India.

**One-liner**: "Where young India finds what's happening."

**Mission**: To make real-world experiences as discoverable and accessible as streaming a movie or ordering food.

### Company Details

| Attribute | Value |
|-----------|-------|
| **Name** | CrwdCtrl |
| **Domain** | crwdctrl.in |
| **Stage** | Pre-seed / MVP |
| **Founded** | 2025–2026 |
| **Founder** | Student at MIT-WPU, Pune |
| **Funding** | Bootstrapped |
| **Location** | Pune, India |

---

## Product

### Platform Status

| Dimension | Status |
|-----------|--------|
| **Web app** | Live at https://www.crwdctrl.in |
| **Android app** | Built via Capacitor; Play Store pending |
| **iOS app** | Not built |
| **Launch readiness score** | 78/100 |

### Tech Stack

**Frontend:**
- React 19 + Vite 7
- Tailwind CSS 4
- React Router 7
- Firebase client SDK (auth, FCM)
- Capacitor (Android)
- PWA support

**Backend:**
- Node.js 18+ / Express 5
- MongoDB + Mongoose 8
- JWT authentication
- Firebase Admin (push notifications)

**Infrastructure:**
- Frontend: Vercel
- Backend: Railway
- Database: MongoDB Atlas
- Payments: Cashfree
- Email: Resend + SMTP fallback
- Media: Cloudinary
- Monitoring: Sentry (optional)

### Categories Supported

Four top-level hubs: **Fests, Sports, Treks, Events**.

| Hub / Category | Sub-Types | Discovery | Registration | Payments | Admin |
|----------------|-----------|-----------|--------------|----------|-------|
| **Fests** | Cultural, Technical, Sports | ✅ | ✅ | ✅ | ✅ |
| **Competitions** (under fests) | 26 types (hackathon, dance, quiz...) | ✅ | ✅ | ✅ | ✅ |
| **Sports** | Run clubs, Marathons, Sport clubs (football, cricket, badminton, gymkhana) | ✅ | ✅ | ✅ | ✅ |
| **Treks** | Hiking, Trail, Backpacking, Camping, Adventure, Nature | ✅ | ✅ | ✅ | ✅ |
| **Trek Communities** | Organizer profiles | ✅ | ✅ | — | ✅ |
| **Run Clubs** | Social/Morning/Night/Long/Trail | ✅ | ✅ | — | ✅ |
| **Events** (cultural shows) | Play, Musical, Standup, Improv, Dance Drama | ✅ | ✅ | ✅ | ✅ |

> Codebase notes: "Theatre" renamed to "Events" (`/theatre` → `/events`). No dedicated "gym community" type (gymkhana = sport club). No social feed/follow — only favorites + sharing. Payment `entityType` supports: fest, competition, trek, event.

### Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| Public discovery | ✅ | Browse events by category, search, filters |
| User authentication | ✅ | Email/password + Google OAuth |
| Registration forms | ✅ | Dynamic forms with custom fields |
| Payment integration | ✅ | Cashfree with 3% platform fee |
| QR tickets | ✅ | Generation + admin check-in scanner |
| Push notifications | ✅ | FCM for reminders and updates |
| Email notifications | ✅ | Registration confirmations, reminders |
| Event reminders | ✅ | Cron-based 24hr reminders |
| Admin dashboard | ✅ | Full CRUD for all entities |
| Community profiles | ✅ | Trek communities, run clubs |
| Dark mode | ✅ | Theme toggle |
| PWA | ✅ | Offline support, installable |

---

## Business Model

### Revenue Model

**Primary**: Platform fee (3%) on paid registrations

| Component | Rate |
|-----------|------|
| Platform fee | 3% of ticket price |
| Added to | User's total (ticket + fee) |
| Payment processor | Cashfree (~2.3% + ₹3) |

**Example transaction:**
- Ticket: ₹500
- Platform fee: ₹15 (3%)
- User pays: ₹515
- Organizer receives: ~₹488 (after Cashfree)
- CrwdCtrl revenue: ₹15

### Future Revenue Streams

- Premium organizer tools
- Featured/priority listings
- Sponsorship marketplace
- Community subscriptions
- Data insights products

---

## Target Users

### Primary Personas

| Persona | Description | Needs |
|---------|-------------|-------|
| **College Student** | 18–22, wants to discover events | Discovery, FOMO, easy registration |
| **Fest Organizer** | Club head managing events | Registrations, payments, less chaos |
| **Trek Enthusiast** | 22–30, seeks verified trek groups | Trust, booking, community |
| **Run Club Organizer** | Building fitness community | Member growth, event management |
| **Admin** | Platform operator | Dashboard, monitoring, control |

### User Roles in System

| Role | Capabilities |
|------|--------------|
| Student/Participant | Browse, register, pay, notifications |
| Fest Organizer | Create/manage fests, events, competitions |
| Admin | Full platform management |

---

## Market

### Opportunity

- **40M+ college students** in India
- **Thousands of events** weekly (fests, treks, meetups)
- **No dominant platform** for youth event discovery
- **Fragmented alternatives**: WhatsApp, Instagram, Google Forms

### Competitive Landscape

| Competitor | Focus | CrwdCtrl Advantage |
|------------|-------|-------------------|
| BookMyShow | Large concerts, movies | Campus/community long-tail |
| Insider.in | Metro experiences | Youth/campus native |
| Meetup.com | Global, professional | India-native, modern UX |
| WhatsApp | Communication | Discovery + payments + tools |
| Instagram | Social media | Transactions + search |

### Positioning

**For students**: "The one app to see everything happening near you."
**For organizers**: "Stop managing spreadsheets. Focus on your event."
**For communities**: "Grow your tribe. We handle the rest."

---

## Growth Strategy

### GTM Approach

**Wedge**: College campuses (concentrated, repeatable markets)

**Playbook**:
1. Dominate one campus (MIT-WPU)
2. Document and learn the playbook
3. Replicate to adjacent campuses
4. Expand to communities (run clubs, treks)
5. City-by-city scaling

### The Flywheel

```
Organizers list events
        ↓
Users discover events
        ↓
Users register + pay
        ↓
Events happen (proof)
        ↓
Recap content (FOMO)
        ↓
More users discover
        ↓
[Repeat, accelerating]
```

### Growth Channels

| Channel | Status | Priority |
|---------|--------|----------|
| Founder-led sales | Active | Primary |
| Campus ambassadors | Pilot | High |
| Content marketing | Starting | High |
| Product-led growth | Partial | Medium |
| Referrals | Not built | Medium |
| Partnerships | Future | Low |

---

## Content Strategy

### The Approach

"Document, don't perform" — build in public, show the real journey.

### 10 Content Pillars

1. Founder Journey (20%)
2. Building CrwdCtrl (15%)
3. College Fest Ecosystem (12%)
4. Community Building (10%)
5. Trek Culture (8%)
6. Run Club Culture (8%)
7. Organizer Playbook (10%)
8. User Stories (8%)
9. Startup Lessons (5%)
10. Behind the Scenes (4%)

### Platforms

| Platform | Use |
|----------|-----|
| Instagram | FOMO, discovery, Reels |
| LinkedIn | Founder journey, investors |
| X/Threads | Real-time, engagement |
| YouTube | Documentary, education |

### Key Metrics

- Saves & shares (not likes)
- Profile → link clicks
- DMs from organizers
- Sign-ups attributed to content

---

## 90-Day Plan Summary

### Phase 1 (Days 1–30): Foundation

- Launch Android app to Play Store
- Onboard 15+ organizers at MIT-WPU
- Process 200–300 registrations
- Publish 20+ videos
- Recruit 3 ambassadors
- Establish daily content rhythm

### Phase 2 (Days 31–60): Momentum

- Expand to 3 campuses
- Reach 30–40 organizers
- Process 1,000+ registrations
- Identify winning content formats
- Grow ambassador program to 10–12

### Phase 3 (Days 61–90): Scale

- 5+ campuses with presence
- 75–100 organizers
- 2,000–3,000 registrations
- Documentary series (~12 episodes)
- Investor narrative ready

---

## Key Metrics

### North Star

**Monthly Active Registrations** — Users who register for at least one event per month.

### Supporting Metrics

| Metric | 90-Day Target |
|--------|---------------|
| Organizers | 75–100 |
| Registrations | 2,000–3,000 |
| Campuses | 5+ |
| Active communities | 20+ |
| Android installs | 500+ |
| Content pieces | 90+ |

---

## Technical Documentation

### Key Documentation Files

| Document | Location | Purpose |
|----------|----------|---------|
| README.md | `/README.md` | Project overview, setup |
| ARCHITECTURE.md | `/ARCHITECTURE.md` | System diagram |
| DEPLOYMENT.md | `/DEPLOYMENT.md` | Deployment guide |
| PROJECT_AUDIT.md | `/PROJECT_AUDIT.md` | Comprehensive audit |
| PRODUCTION_HARDENING.md | `/PRODUCTION_HARDENING.md` | Security improvements |

### API Overview

| Domain | Prefix | Auth | Examples |
|--------|--------|------|----------|
| Users | `/api/users` | Mixed | Register, login, profile |
| Fests | `/api/fests` | Public | Browse, search, details |
| Registrations | `/api/registrations` | Auth | Register, manage |
| Payments | `/api/payment` | Mixed | Quote, order, verify |
| Admin | `/api/admin` | Admin | All CRUD operations |

### Database Models

| Model | Purpose |
|-------|---------|
| User | Auth, roles, FCM tokens |
| Student | Extended profile |
| FestOrganizer | Fest listings |
| Competition | Competitions under fests |
| Registration | Event registrations |
| Trek | Trek listings |
| TrekCommunity | Trek organizer profiles |
| RunClub | Run club profiles |
| SportsEvent | Sports listings |
| Theatre | Theatre shows |

---

## Risks & Mitigations

### Business Risks

| Risk | Mitigation |
|------|------------|
| Organizers prefer WhatsApp | Show clear ROI, easy onboarding |
| Students don't adopt | FOMO content, ambassadors |
| Low transaction volume | Campus penetration first |
| Competitors enter | Move fast, community moat |

### Technical Risks (from audit)

| Risk | Status | Priority |
|------|--------|----------|
| No automated tests | ⚠️ Open | High |
| JWT in localStorage | ⚠️ Open | High |
| In-memory cache won't scale | ⚠️ Open | Medium |
| Single admin credential | ⚠️ Open | Medium |

---

## Investor Quick Facts

**The Hook**: "40 million college students. Thousands of events every week. No way to find any of them."

**Traction**:
- Product live at crwdctrl.in
- Payments working (Cashfree)
- First campus (MIT-WPU) as design partner
- Android app ready
- 78/100 launch readiness

**Business Model**: 3% platform fee on paid registrations

**Market**: Youth experience economy in India — college fests, treks, run clubs, communities

**Moat**: Community lock-in, campus network effects, India-native

**Ask**: Pre-seed to expand team, scale ambassador program, accelerate campus expansion

---

## Brand Guidelines

**Brand essence**: "Where young India finds what's happening."

**Voice**: Energetic, inclusive, real, helpful, confident

**Tagline**: "Never miss out again."

**Values**:
- Real over curated
- IRL over feed
- Community over audience
- Accessible over exclusive
- Building in public

---

## Content Strategy Files

| File | Contents |
|------|----------|
| `01-content-pillars.md` | 10 content themes |
| `02-viral-content-ideas.md` | 100 short-form ideas |
| `03-founder-story-content.md` | 50 founder narrative hooks |
| `04-community-content.md` | FOMO + discovery content |
| `05-educational-content.md` | Organizer value content |
| `06-documentary-content.md` | Founder vlog series |
| `07-platform-strategies.md` | Platform playbooks |
| `08-growth-strategy.md` | 30/60/90 execution |
| `09-content-calendar.md` | 90-day calendar |

---

## Business Strategy Files

| File | Contents |
|------|----------|
| `01_PRODUCT_VISION.md` | Product strategy |
| `02_STARTUP_STORY.md` | Founder/company narrative |
| `03_USER_PERSONAS.md` | Target user profiles |
| `04_COMMUNITY_STRATEGY.md` | Community moat strategy |
| `05_GTM_STRATEGY.md` | Go-to-market playbook |
| `06_REVENUE_MODEL.md` | Monetization strategy |
| `07_CONTENT_STRATEGY.md` | Content summary |
| `08_COMPETITOR_ANALYSIS.md` | Competitive landscape |
| `09_INVESTOR_NARRATIVE.md` | Investor pitch |
| `10_GROWTH_STRATEGY.md` | Growth playbook |
| `11_BRAND_POSITIONING.md` | Brand strategy |
| `12_30_60_90_DAY_PLAN.md` | Execution roadmap |

---

## Quick Reference

### URLs

| Resource | URL |
|----------|-----|
| Website | https://www.crwdctrl.in |
| Backend API | https://crwdctrl-production-9c58.up.railway.app |
| Health check | `/api/health` |
| Readiness check | `/api/ready` |

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend | React + Vite | Modern, fast, large ecosystem |
| Backend | Express + MongoDB | Flexible, rapid development |
| Mobile | Capacitor | Share web codebase |
| Payments | Cashfree | India-native, good UX |
| Hosting | Vercel + Railway | Developer-friendly, affordable |

### Launch Readiness Journey

| Phase | Score |
|-------|-------|
| Initial audit | 54/100 |
| After security fixes | 62/100 |
| After production hardening | 78/100 |

---

## For AI Agents

When working with CrwdCtrl context:

1. **Product capabilities**: Only reference features documented in the codebase (see PROJECT_AUDIT.md)
2. **Categories**: Four hubs — Fests (cultural/technical/sports), Sports (run clubs, marathons, sport clubs incl. gymkhana), Treks (+ trek communities), Events (cultural shows: plays, standup, improv, dance drama). Plus Competitions under fests.
3. **Target users**: College students, organizers, trek/run communities
4. **Tech stack**: React 19, Express 5, MongoDB, Cashfree, Firebase, Capacitor (Android)
5. **Business model**: 3% platform fee on paid registrations
6. **Stage**: Pre-seed/MVP, founder-led, campus-focused
7. **Geography**: India, starting with Pune (MIT-WPU)

**Critical accuracy notes:**
- "Theatre" was renamed to "Events" — do not refer to a separate Theatre product.
- There is **no gym-community type** (gymkhana is a sport club). Don't claim "gym communities" as a feature.
- There is **no social feed/follow/comments/DM system** — only favorites and sharing.
- **Don't invent features not in the codebase. Don't claim metrics not documented. Don't exaggerate capabilities.**

---

*Last updated: June 2026*
*This document should be updated when significant product, business, or strategic changes occur.*
