# Campus Hunt Finale — Test flow & test management

How to run automated tests, manually QA the Finale round, and manage test state during development.

---

## Quick commands

From the `backend/` folder:

```bash
# All backend tests (CI runs this)
npm test

# Finale unit tests only
npm run test:finale

# All Campus Hunt tests (Round 1 + Finale)
npm run test:campus-hunt

# Re-run finale tests on file changes (local dev)
npm run test:finale:watch
```

Finale test files live in:

```
backend/tests/campus-hunt/finale/
  finaleMissions.test.js   # Intel Hunt, Field Terminal, timer lock
  finaleRegistry.test.js   # Mission registry + placeholders
  finalePromotion.test.js  # Promotion caps & defaults
```

---

## What automated tests cover

| Area | File | Checks |
|------|------|--------|
| Intel Hunt steps | `finaleMissions.test.js` | loc2 hidden until loc1; combine awards +50 |
| Field Terminal | `finaleMissions.test.js` | Wrong code fails; correct code +75 |
| Timer | `finaleMissions.test.js` | `isRoundClosed` at 0:00 and when locked |
| Registry | `finaleRegistry.test.js` | Handlers exist; missions 3–5 coming soon |
| Promotion math | `finalePromotion.test.js` | 5 direct + 7 manual = 12 max |

These are **pure logic tests** (no MongoDB). Full end-to-end promotion and API flows require manual QA below.

---

## Admin manual test flow

Use **Admin → Event → All rounds → Finale** and follow this order:

### Phase A — Setup (before any player testing)

1. **Round 1 complete** — Stop & lock → Finalize leaderboard.
2. **Bootstrap** — Finale → Setup → *Bootstrap Finale round*.
3. **Configure missions** — Set known test values, e.g.:
   - Intel loc1 answer: `THUN`
   - Intel loc2 answer: `DER`
   - Combined: `THUNDER`
   - Device code: `1234`
4. **Save mission config**.

### Phase B — Finalists

5. **Auto-promote top 5** — must succeed after R1 finalize.
6. **Manual pick 7** — select from Survival pool; total = 12.
7. Verify **Finalists table** shows 12 rows with `direct_r1` / `manual_pick`.

### Phase C — Live playtest

8. **Start 45-min Finale** — Live tab (requires 12 entries).
9. Open a **finalist team link** on two devices:
   - Device A: Leader login
   - Device B: Player login
10. Confirm **Mission Board** (not Round 1 clues).
11. **Intel Hunt** — leader completes all 3 steps; score → 550.
12. **Field Terminal** — wrong code first, then correct GRID code → leader submits → score applied.
13. **Player submit** — attempt submit on player device → expect 403.
14. **Abandon** — start a mission, return to board; mission still available.
15. **Leaderboard** — Profile → Campus Hunt → **Finale** tab shows scores.

### Phase D — Close

16. **Force lock** — Live tab.
17. **Finalize results** — Results tab.
18. **Public board** — toggle “Show public finale board”; verify Finale tab on profile leaderboard.

---

## Dev seed shortcut

Pilot seed bootstraps the Finale round automatically:

```bash
cd backend
node scripts/seed-campus-hunt-pilot.js
```

You still need to finalize R1, promote teams, and start the timer manually in Admin.

---

## Managing test state

### Reset finale progress (keep teams)

There is no dedicated “reset finale” button in v1. Options:

- **Before start:** remove finale entries in Mongo (dev only) and re-promote.
- **After lock:** finalize; do not restart without admin intervention.

### Full dev reset

```bash
CAMPUS_HUNT_SEED_RESET=true node scripts/seed-campus-hunt-pilot.js --reset
```

Requires both `--reset` and `CAMPUS_HUNT_SEED_RESET=true`. Backs up Mongo first in production.

### QA checklist in Admin

Finale → **Test** tab includes a persistent checklist (stored in browser localStorage per event slug).

---

## CI / PR workflow

- `.github/workflows/backend-tests.yml` runs `npm test` on backend changes.
- Add or update tests under `backend/tests/campus-hunt/finale/` when changing mission handlers or promotion rules.
- Run `npm run test:finale` before pushing Finale changes.

---

## Adding new tests

1. Create `backend/tests/campus-hunt/finale/yourFeature.test.js`.
2. Use Node’s built-in test runner:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('my behaviour', () => {
  assert.equal(1 + 1, 2);
});
```

3. Import from `../../../src/modules/campus-hunt/...` (three levels up from `finale/`).
4. Run `npm run test:finale` to verify.

Prefer **pure function tests** for mission handlers. Use integration tests with Mongo only when necessary.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Finale hub “NOT OPENED” | R1 not finalized | Finalize Round 1 |
| Auto-promote error | Finale not bootstrapped | Setup → Bootstrap |
| Start button disabled | &lt; 12 finalists | Complete promotion |
| Player sees Round 1 | Team not promoted | Check Finalists tab |
| 403 on finale API | Wrong team session | Open own team link |
| Public finale board 403 | Not enabled / not live | Results → show public board |
