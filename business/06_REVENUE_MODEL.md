# CrwdCtrl — Revenue Model

> From platform fees to multiple revenue streams: the path to sustainable unit economics.

---

## Executive Summary

CrwdCtrl's primary revenue model is a **platform fee on paid registrations** — currently 3% of transaction value. This model is proven in similar marketplaces (EventBrite, BookMyShow) and aligns incentives: CrwdCtrl only makes money when organizers make money.

The long-term opportunity is layering additional revenue streams: sponsorship marketplace, premium organizer tools, community subscriptions, and data/insights products.

---

## Current State

### Revenue Model Implemented

Based on codebase analysis:

| Revenue Stream | Status | Implementation |
|----------------|--------|----------------|
| **Platform fee (3%)** | ✅ Live | `paymentController.js` — fee calculated on order |
| **Payment processing** | ✅ Live | Cashfree integration; fees included |
| **Premium features** | ⏸️ Not built | — |
| **Sponsorships** | ⏸️ Not built | — |
| **Subscriptions** | ⏸️ Not built | — |

### How Platform Fee Works

From the codebase (`paymentController.js`):

1. Organizer sets ticket price (e.g., ₹500)
2. CrwdCtrl adds 3% platform fee (₹15)
3. User pays total (₹515)
4. Cashfree processes payment
5. Organizer receives ticket price (minus Cashfree fee)
6. CrwdCtrl retains platform fee

### Current Fee Structure

| Component | Rate | Paid By |
|-----------|------|---------|
| **Platform fee** | 3% | User (added to ticket price) |
| **Cashfree fee** | ~2% + ₹3 | Deducted from organizer payout |
| **GST on platform fee** | 18% | Included in fee |

**Example Transaction:**
- Ticket price: ₹500
- Platform fee (3%): ₹15
- User pays: ₹515
- Cashfree fee (~2.3%): ~₹12
- Organizer receives: ~₹488
- CrwdCtrl revenue: ~₹15 (before GST)

---

## Opportunities

### 1. Volume-Based Revenue Scaling

The platform fee model scales with:
- More organizers listing events
- More users registering
- Higher-value events (fests vs. free meetups)
- More cities/campuses

| Metric | Scenario | Monthly Revenue |
|--------|----------|-----------------|
| 500 registrations × ₹300 avg | Baseline | ₹4,500 |
| 2,000 registrations × ₹400 avg | 6-month | ₹24,000 |
| 10,000 registrations × ₹500 avg | 18-month | ₹1,50,000 |

### 2. Premium Organizer Tools

Upsell to high-volume organizers:

| Feature | Price Model | Value Prop |
|---------|-------------|------------|
| **Advanced analytics** | ₹500–2,000/month | Deeper insights on registrations |
| **Priority listing** | ₹1,000–5,000/event | Top placement in discovery |
| **Custom branding** | ₹2,000–10,000/year | Remove CrwdCtrl branding |
| **API access** | ₹5,000–20,000/year | Integrate with own systems |
| **Bulk registration tools** | ₹1,000–5,000/event | Group registrations |

### 3. Sponsorship Marketplace

Connect brands with events:

| Model | Revenue |
|-------|---------|
| **Commission on sponsorship deals** | 10–15% of deal value |
| **Sponsored placements** | CPM on discovery pages |
| **Brand-sponsored events** | Revenue share |

**Market size**: College fest sponsorships range from ₹50K to ₹50L depending on scale.

### 4. Community Subscriptions

Monetize recurring communities:

| Model | Revenue |
|-------|---------|
| **Premium community features** | ₹500–2,000/month |
| **Member subscriptions** | CrwdCtrl takes 10–20% |
| **Training/course hosting** | 15–20% of course fees |

### 5. Data & Insights

Proprietary data becomes valuable:

| Product | Customer | Revenue |
|---------|----------|---------|
| **Event pricing insights** | Organizers | ₹1,000–10,000/report |
| **Attendance patterns** | Sponsors, brands | ₹10,000–50,000/report |
| **Youth interest data** | Research, brands | ₹50,000–5,00,000/year |

---

## Risks

### Revenue Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low transaction volume | High (early stage) | High | Focus on campus penetration; increase event density |
| Organizers reject fee | Medium | High | Show clear ROI; keep fee competitive |
| Free events dominate | Medium | Medium | Build value in community tools (not just payments) |
| Payment failures lose revenue | Medium | Medium | Implement Cashfree webhooks; error handling |

### Competitive Risks

| Risk | Mitigation |
|------|------------|
| Competitors undercut on fees | Focus on value, not price; community moat |
| Organizers build own systems | Make CrwdCtrl too convenient to leave |
| WhatsApp/UPI remain dominant | Win on discovery + analytics, not just payments |

### Financial Risks

| Risk | Mitigation |
|------|------------|
| CAC > LTV at current volume | Keep CAC low (organic, ambassador-led) |
| Revenue can't cover costs | Stay lean; milestone-based expenses |
| Payment processor changes terms | Diversify (consider Razorpay backup) |

---

## Recommendations

### Short-Term (0–90 Days)

**Goal**: Maximize transaction volume on current model.

1. **Increase registration volume**
   - More organizers → more events → more registrations
   - Target: 500+ registrations/month

2. **Optimize payment flow**
   - Add Cashfree webhooks (protect against client failures)
   - Reduce registration abandonment
   - Clear fee transparency

3. **Track unit economics**
   - Revenue per registration
   - CAC per organizer/user
   - Payment success rate

### Medium-Term (90–180 Days)

**Goal**: Introduce premium revenue streams.

1. **Priority/featured listings**
   - Paid promotion for events
   - Test pricing with 2–3 organizers

2. **Organizer analytics dashboard**
   - Free tier: basic metrics
   - Paid tier: advanced insights

3. **Sponsorship pilot**
   - Manual matchmaking for 3–5 events
   - Learn sponsorship dynamics

### Long-Term (180+ Days)

**Goal**: Diversify revenue; reduce platform fee dependency.

1. **Sponsorship marketplace**
   - Self-serve brand connections
   - Commission model

2. **Community subscriptions**
   - Premium community features
   - Member-paid subscriptions

3. **Data products**
   - Aggregate insights (anonymized)
   - Industry reports

---

## Unit Economics

### Current Model (Per Paid Registration)

| Metric | Value | Notes |
|--------|-------|-------|
| **Avg. ticket price** | ₹300–500 | Varies by event type |
| **Platform fee** | 3% | ₹9–15 per registration |
| **Cashfree fee** | ~2.3% | Paid by organizer |
| **Gross margin on fee** | ~85% | After GST |
| **Net revenue/registration** | ₹7–12 | Approximate |

### CAC (Current)

| Channel | Estimated CAC |
|---------|---------------|
| Organic/word-of-mouth | ~₹0 |
| Content-driven | ~₹5–20 |
| Ambassadors | ~₹20–50 |
| Paid (future) | ~₹50–200 |

### LTV (Projected)

| User Type | Events/Year | Avg. Spend | LTV |
|-----------|-------------|------------|-----|
| Casual student | 2–3 | ₹400 | ₹1,000 |
| Active student | 5–8 | ₹500 | ₹3,000 |
| Trek enthusiast | 10–12 | ₹800 | ₹8,000 |
| Run club member | 20–30 | ₹300 | ₹7,500 |

**Target LTV:CAC ratio**: > 3:1

---

## Revenue Projections

### Conservative Scenario

| Month | Registrations | Avg. Price | Revenue |
|-------|---------------|------------|---------|
| 1–3 | 200 | ₹300 | ₹1,800 |
| 4–6 | 500 | ₹350 | ₹5,250 |
| 7–9 | 1,000 | ₹400 | ₹12,000 |
| 10–12 | 2,000 | ₹450 | ₹27,000 |
| **Year 1 Total** | — | — | **₹46,050** |

### Moderate Scenario

| Month | Registrations | Avg. Price | Revenue |
|-------|---------------|------------|---------|
| 1–3 | 300 | ₹350 | ₹3,150 |
| 4–6 | 1,000 | ₹400 | ₹12,000 |
| 7–9 | 2,500 | ₹450 | ₹33,750 |
| 10–12 | 5,000 | ₹500 | ₹75,000 |
| **Year 1 Total** | — | — | **₹1,23,900** |

### Aggressive Scenario (with premium)

| Month | Registrations | Platform Fee | Premium | Total |
|-------|---------------|--------------|---------|-------|
| 1–3 | 500 | ₹5,250 | ₹0 | ₹5,250 |
| 4–6 | 2,000 | ₹24,000 | ₹5,000 | ₹29,000 |
| 7–9 | 5,000 | ₹67,500 | ₹15,000 | ₹82,500 |
| 10–12 | 10,000 | ₹1,50,000 | ₹30,000 | ₹1,80,000 |
| **Year 1 Total** | — | — | — | **₹2,96,750** |

---

## Pricing Strategy

### Platform Fee Rationale (3%)

| Factor | Consideration |
|--------|---------------|
| **Competitor benchmarks** | EventBrite: 2–5%; Insider.in: similar |
| **Organizer tolerance** | Low enough to not lose deals |
| **Sustainability** | High enough to build business |
| **Simplicity** | Easy to explain, transparent |

### Potential Adjustments

| Scenario | Adjustment |
|----------|------------|
| **High-value events (>₹2,000)** | Consider capping fee at ₹75–100 |
| **Low-value events (<₹100)** | Minimum fee of ₹5–10 |
| **Free events** | No fee; monetize via premium |
| **Volume organizers** | Negotiated rates |

---

## Financial Milestones

### Break-Even Analysis

| Expense | Monthly |
|---------|---------|
| Hosting (Vercel + Railway) | ₹0–5,000 |
| Domain + services | ₹500–1,000 |
| Ambassador stipends | ₹10,000–20,000 |
| **Total fixed costs** | **₹15,000–25,000** |

**Break-even registrations** (at ₹400 avg, ₹12 net revenue):
- ₹15,000 ÷ ₹12 = **1,250 registrations/month**

### Investment Milestones

| Stage | Revenue Target | What It Unlocks |
|-------|----------------|-----------------|
| Pre-seed | ₹10K/month | Proof of model |
| Seed | ₹50K–1L/month | Team expansion |
| Series A | ₹5–10L/month | City expansion |

---

*This revenue model is based on the actual payment implementation in the CrwdCtrl codebase (3% platform fee via Cashfree). All projections are estimates based on market assumptions and should be validated with real data.*
