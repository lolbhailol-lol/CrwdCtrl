# CrwdCtrl — User Personas

> Understanding the people CrwdCtrl serves: students, organizers, community builders, and enthusiasts.

---

## Executive Summary

CrwdCtrl operates a **two-sided marketplace** connecting **experience seekers** (students, enthusiasts) with **experience providers** (organizers, community builders). Success depends on deeply understanding both sides, their motivations, pain points, and the value proposition that makes CrwdCtrl indispensable.

This document defines the primary user personas based on the actual categories and features supported by the platform.

---

## Current State

### User Types in the System

Based on codebase analysis, CrwdCtrl supports these user roles:

| Role | Model | Authentication | Capabilities |
|------|-------|----------------|--------------|
| **Student/Participant** | `usermodel.js`, `student&participant.js` | Email + Google OAuth | Browse, register, pay, receive notifications |
| **Fest Organizer** | `fest_organizer_model.js` | Email + JWT | Create/manage fests, events, competitions |
| **Admin** | Environment credentials | Admin JWT | Full platform management |

### Categories Served (Actual)

Organized as four hubs: **Fests, Sports, Treks, Events**.

| Hub / Category | Target Persona |
|----------------|----------------|
| College Fests (Cultural, Technical, Sports) | College students, fest organizers |
| Competitions (under fests) | Students, competition organizers |
| Treks + Trek Communities | Trek enthusiasts, trek community leaders |
| Run Clubs (under Sports) | Runners, fitness community builders |
| Sports (marathons, sport clubs incl. gymkhana) | Sports enthusiasts, event organizers |
| Events (cultural shows: plays, standup, improv, dance drama) | Arts enthusiasts, performers |

> Note: The project rule references "gym communities," but the codebase has **no dedicated gym-community type** — `gymkhana` exists as a sport-club category under Sports. "Theatre" was renamed to "Events." There is **no social feed/follow system** — community interaction is limited to favorites and sharing.

---

## Primary Personas

---

### Persona 1: **Priya — The College Student**

> "I want to have an amazing college experience, but I keep finding out about cool events after they're over."

**Demographics**
- Age: 18–22
- Location: Pune (or any college town)
- Education: Undergraduate student
- Device: Android smartphone (primary), laptop (secondary)

**Goals**
- Discover college fests, competitions, workshops happening nearby
- Not miss out on experiences her friends are attending
- Build her resume with competition wins and extracurriculars
- Meet new people outside her immediate friend circle

**Pain Points**
- Events are scattered across Instagram stories, WhatsApp groups, posters
- Registration processes are confusing (Google Forms, UPI screenshots, manual confirmation)
- Doesn't know which events are worth attending
- Feels FOMO when she sees friends' stories from events she missed

**Behavior**
- Checks Instagram daily; follows college fest pages
- In 10+ WhatsApp groups for different clubs/events
- Prefers mobile-first experiences
- Trusts peer recommendations over ads

**What CrwdCtrl Offers Her**
- Single feed of all events/fests near her
- Search and filter by category, date, location
- One-tap registration with secure payment
- QR ticket on her phone — no printing
- Push notifications for upcoming events she registered for

**Key Quote**
> "I just want one place to see everything happening this weekend."

---

### Persona 2: **Arjun — The Fest Organizer**

> "I spend more time on logistics than on making the event good. And I still can't get enough registrations."

**Demographics**
- Age: 19–23
- Role: Cultural committee head / Tech club president
- Location: College campus
- Device: Laptop (planning), phone (communication)

**Goals**
- Get maximum registrations for his college fest
- Reduce operational chaos (manual payments, spreadsheets, WhatsApp queries)
- Look good to the college administration and sponsors
- Build his leadership credentials

**Pain Points**
- Registration via Google Forms → manual payment verification → spreadsheet tracking
- Chasing participants for payment screenshots
- No centralized dashboard for registrations
- Limited reach beyond his college's immediate network
- Sponsors want numbers, but he can't prove attendance

**Behavior**
- Uses Google Sheets as the source of truth
- Manages event communication via WhatsApp broadcast lists
- Struggles to collect payments (UPI screenshots, bank transfers)
- Manually generates certificates and sends via email

**What CrwdCtrl Offers Him**
- Listing page with professional branding for his fest
- Dynamic registration forms (customize fields per event)
- Integrated Cashfree payments — money lands directly, no chasing
- Real-time dashboard: registrations, revenue, attendee data
- QR check-in to track actual attendance
- Google Sheets export for legacy workflows
- Email notifications to registrants automatically

**Key Quote**
> "If I could just post my event and have registrations come in without WhatsApp chaos, I'd be happy."

---

### Persona 3: **Rohan — The Trek Enthusiast**

> "I want to trek every weekend, but I don't know where to find legit groups."

**Demographics**
- Age: 22–30
- Occupation: Young professional or final-year student
- Location: Pune / Mumbai
- Device: Smartphone (primary)

**Goals**
- Find verified, safe trek groups near him
- Trek regularly without organizing everything himself
- Meet like-minded people who share his passion
- Try new trails without the research overhead

**Pain Points**
- Trek "organizers" on Instagram are hit-or-miss (safety concerns)
- No way to verify group reputation before booking
- Payment is often cash-on-meet or random UPI
- Last-minute cancellations with no refund
- Hard to find groups for his fitness/skill level

**Behavior**
- Follows trek pages on Instagram
- Joins trek WhatsApp groups (often too many)
- Researches trails on YouTube and blogs
- Prefers weekends, early morning starts

**What CrwdCtrl Offers Him**
- Browse verified trek communities and organizers
- See upcoming treks with difficulty level, cost, group size
- Book and pay securely (Cashfree integration)
- Community profiles with history and reviews
- Filter by difficulty, location, date

**Key Quote**
> "I just need a reliable way to find a good trek group and book without drama."

---

### Persona 4: **Ananya — The Run Club Organizer**

> "I started a run club. Now I spend more time managing WhatsApp than actually running."

**Demographics**
- Age: 24–32
- Occupation: Working professional, fitness enthusiast
- Location: Urban area (Pune, Bangalore, Mumbai)
- Device: Smartphone

**Goals**
- Grow her run club from 20 to 200 members
- Organize weekly runs with minimal admin work
- Build a real community, not just a WhatsApp group
- Eventually monetize (coaching, merchandise, premium events)

**Pain Points**
- Managing attendance via WhatsApp polls
- New members can't find her club easily
- No way to track who's active vs. who's lurking
- Collecting money for group events is awkward
- Competition from other run clubs with no differentiation

**Behavior**
- Posts run announcements on Instagram + WhatsApp
- Uses Google Forms for RSVP (rarely checked)
- Tracks members in a spreadsheet (or doesn't)
- Invests personal money for group activities

**What CrwdCtrl Offers Her**
- Dedicated run club page with bio, schedule, photos
- Recurring event support (weekly runs, monthly challenges)
- Member discovery: people can find and join her club
- Registration/RSVP tracking
- Payment collection for paid events
- Analytics: who's active, growth over time

**Key Quote**
> "I want to run a community, not a WhatsApp group."

---

### Persona 5: **Karan — The Admin**

> "I need to see everything happening on the platform and act fast when something breaks."

**Demographics**
- Role: Platform administrator (founder or ops team)
- Technical skill: Moderate to high
- Device: Laptop (primary)

**Goals**
- Manage all fests, events, communities on the platform
- Handle registrations, refunds, support queries
- Monitor platform health and growth
- Approve or moderate organizer listings

**Pain Points**
- Scaling support as platform grows
- Manual processes for edge cases
- Lack of automated monitoring/alerting
- Balancing quality control with fast onboarding

**What CrwdCtrl Offers Him**
- Admin dashboard with full CRUD for all entities
- Registration management: review, update status, diagnose issues
- QR check-in stats
- Analytics dashboard: user counts, registration trends
- Fest/competition approval and priority management
- Cloudinary image uploads
- Google Sheets diagnostics

**Key Quote**
> "Give me a dashboard where I can see everything and fix problems before users complain."

---

## Opportunities

### 1. Deepen Student Engagement

- **Push notifications** for events matching interests
- **Personalized discovery** based on past registrations
- **Social features**: see what friends are attending
- **Streaks/gamification**: reward active users

### 2. Empower Organizers

- **Self-serve listing**: reduce founder dependency
- **Analytics dashboard**: show ROI to organizers
- **Sponsorship tools**: connect organizers with brands
- **Certificate/credential generation**: post-event automation

### 3. Build Community Stickiness

- **Recurring events**: run clubs, trek groups meet regularly
- **Member management**: who's active, who's new
- **Community chat/discussion**: reduce WhatsApp dependency
- **Leaderboards/recognition**: most active trekker, fastest runner

### 4. Expand Persona Coverage

- **Parents of students**: discover safe activities for kids
- **Corporate HR**: team-building events, wellness activities
- **Brands/Sponsors**: reach youth audiences through events

---

## Risks

### Persona Risks

| Risk | Mitigation |
|------|------------|
| Students prefer Instagram/WhatsApp habit | Make CrwdCtrl the source of truth; FOMO content |
| Organizers don't want to learn new tool | Make onboarding frictionless; show immediate value |
| Trek enthusiasts distrust new platforms | Verify organizers; show community reputation |
| Run clubs don't see value vs. WhatsApp | Demonstrate discovery + growth benefits |

### Underserved Personas

| Persona | Status | Recommendation |
|---------|--------|----------------|
| Theatre performers | Admin-managed only | Add performer profiles, self-listing |
| Competition judges | Not in system | Add judge/volunteer management |
| Sponsors | Not in system | Build sponsorship marketplace |
| Parents | Not targeted | Consider campus safety angle |

---

## Recommendations

### Short-Term

1. **Interview 10 users per persona** — Validate assumptions with real conversations
2. **Optimize for Priya (student)** — She's the volume driver; her experience must be perfect
3. **Reduce friction for Arjun (organizer)** — Self-serve listing, no founder bottleneck
4. **Feature Rohan's trek communities** — Social proof drives trust

### Medium-Term

1. **Build community tools for Ananya** — Recurring events, member management
2. **Add organizer analytics** — Arjun needs to show ROI to his college/sponsors
3. **Personalization for Priya** — Recommend events based on behavior
4. **Mobile-first for all** — Every persona is smartphone-primary

### Long-Term

1. **Social layer** — See friends' activity, share attendance
2. **Reputation systems** — Verified organizers, community ratings
3. **Expand personas** — Corporate, brands, parents

---

## Persona-Feature Matrix

| Feature | Priya (Student) | Arjun (Organizer) | Rohan (Trekker) | Ananya (Run Club) | Karan (Admin) |
|---------|-----------------|-------------------|-----------------|-------------------|---------------|
| Discovery/Browse | ✅ Primary | — | ✅ Primary | — | ✅ Monitor |
| Registration | ✅ Primary | ✅ Manage | ✅ Primary | ✅ Manage | ✅ Manage |
| Payments | ✅ Pay | ✅ Receive | ✅ Pay | ✅ Receive | ✅ Monitor |
| QR Ticket | ✅ Use | ✅ Scan | ✅ Use | ✅ Scan | ✅ Manage |
| Push Notifications | ✅ Receive | ✅ Send | ✅ Receive | ✅ Send | ✅ Manage |
| Community Profiles | ✅ Join | — | ✅ Join | ✅ Manage | ✅ Manage |
| Analytics | — | ✅ Need | — | ✅ Need | ✅ Primary |

---

*All personas are derived from the actual user types, categories, and features supported by CrwdCtrl as verified in the codebase.*
