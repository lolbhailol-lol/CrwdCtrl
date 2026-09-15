# Campus Hunt — Event-day runbook

## Setup

1. Enable `CAMPUS_HUNT_ENABLED=true` on the backend and
   `VITE_ENABLE_CAMPUS_HUNT=true` on the frontend.
2. Configure the staggered start topology before seeding:
   `CAMPUS_HUNT_START_COUNT`, `CAMPUS_HUNT_START_CAPACITY`,
   `CAMPUS_HUNT_RELEASE_INTERVAL_MINUTES`, and `CAMPUS_HUNT_STARTS_AT`.
3. In production, provide `CAMPUS_HUNT_STARTING_LOCATIONS` and
   `CAMPUS_HUNT_CLUE1_VARIANTS` as JSON. There must be one real, staffed
   starting location per configured start and one Clue 1 variant per
   start/route combination. Placeholders are rejected.
4. Create four progression steps per route. Checkpoint 1 may have multiple
   physical destinations, but each team must be assigned exactly one.
5. Replace every placeholder location and instruction before printing.
6. Add teams with one dedicated leader login and three scanner logins.
7. Create one unique volunteer credential per checkpoint. Never use a
   credential with an empty checkpoint list in production.
8. Keep `CAMPUS_HUNT_DEV_CHEATS` disabled in production.

## Mandatory preflight

- Every team has exactly four distinct accounts, a route, and a saved access slip.
- Event and route capacities are not exceeded.
- Starting-point capacity covers every team; no start exceeds its own capacity.
- Every active route reports exact 4/4 progression (Clues 1–4 and checkpoint
  keys 1, 2, 3, FINISH).
- Every team has `startingPointId`, `scheduledStartAt`, `clue1ChallengeId`, and
  `firstCheckpointId`; the assigned Clue 1 points to that same checkpoint.
- Clue 1 destinations are distributed across routes/starts, rather than sending
  the whole first wave to one station.
- Leader login opens Clue 1; scanner login exposes checkpoint scanning only.
- Every printed station QR scans successfully from Android and iOS.
- Every volunteer credential is tested and bound to one checkpoint.
- Shared-campus Wi-Fi and mobile-data fallback are tested.
- Admin monitoring shows a fresh timestamp and no open blocking issue.
- Export/backup operational data before any reset or deletion script.

The backend blocks Round 1 while readiness is incomplete or the staggered
schedule is not locked.

## Launch

1. Brief teams and distribute only their own printed access slip.
2. In Admin, set Round 1 start time, interval, and assignment strategy.
3. Run **Preview schedule**. Check each start's count, last release time,
   route mix, destination mix, and capacity warnings.
4. Run **Generate schedule** and spot-check team assignments. Regeneration of
   a live/locked schedule requires explicit confirmation.
5. Run **Lock schedule**. Do not proceed unless every team is READY and the
   dashboard reports no incomplete assignment.
6. Press **Start Round 1**. Only teams whose scheduled time is due are released.
7. Confirm at least one leader and one scanner can refresh successfully.

## Staggered-start acceptance test

Record team codes, timestamps, response codes, and operator initials.

- [ ] **Early rejection:** before its slot, a leader sees the waiting screen and
  a Clue 1 submit attempt returns `START_NOT_DUE`; no prompt or answer leaks.
- [ ] **Timed release:** at the scheduled server time, refresh releases the team,
  sets `actualStartAt`, and exposes Clue 1 only to the leader.
- [ ] **Manual release:** release a future READY team with a written reason;
  verify the audit action and that a second release is idempotent.
- [ ] **Pause/resume (round):** pause releases across Round 1, verify a due team
  stays waiting, resume, then verify it releases.
- [ ] **Pause/resume (start):** repeat for one starting point and verify other
  starting points continue releasing.
- [ ] **Role visibility:** leader sees/submits Clue 1; scanner sees no Clue 1
  prompt and receives `LEADER_ONLY`/403 on submit or hint.
- [ ] **Destination distribution:** compare the first wave across all starts;
  route and first-checkpoint counts match the preview.
- [ ] **Wrong checkpoint:** scan another route's station and another same-route
  CP1. Expect `WRONG_ROUTE` or `WRONG_FIRST_CHECKPOINT`, with no progress.
- [ ] **Exact 4/4:** at the assigned checkpoint, scans 1–3 show the remaining
  count and do not advance. The fourth distinct roster member completes it;
  duplicate or non-roster scans do not count.
- [ ] **Leader transfer:** transfer leadership with a reason. The former leader
  immediately loses leader-only actions; the new leader can continue without
  resetting score, stage, assignment, or scans.
- [ ] **Leaderboard:** unfinished teams remain correctly ordered/marked; finish
  locks score once, completion time uses the team run, and finalization is
  available only after the round is locked.

## Live operations

- Watch Live Teams, Checkpoints, Challenges, and Issues.
- Watch scheduled versus actual release time and queue depth per starting point.
- Use team search to locate stalled teams.
- Acknowledge issue reports when assigned; resolve them only after action.
- Do not share station codes over public chat.
- Short paste codes are camera-failure fallback only. They carry the same
  privilege as the printed QR and must be treated as secrets.
- If a checkpoint fails, use **Disable + compensate** so eligible teams can
  continue; record the reason.

## Incidents

### Leaked station QR or paste code

1. Rotate the station credential in Admin.
2. Reprint the station poster.
3. Remove the leaked image/message where possible.
4. Review checkpoint verification and audit logs.

### Lost device

Sign out the old session if available, then use the same team URL on the
replacement device. Do not move a member into another team account.

### Absent member

Escalate to the event lead. Use manual verification only after checking that
the team, route, and checkpoint match; include a written reason.

### Server or network outage

Record team code, checkpoint, member names, and time on paper. Reconcile only
after service returns. Never finalize before reconciliation is complete.

### Reopening a locked round

Reopen is destructive: challenge progress and checkpoint scans are reset,
teams return to WAITING, and the schedule returns to draft. Regenerate, review,
and lock it again before restarting. Reopen requires explicit confirmation.

## Close

1. Press **Stop + lock round** to freeze every team score.
2. Reconcile paper records and resolve open issues.
3. Review the leaderboard and audit trail.
4. Press **Finalize leaderboard** only while the round is locked.
5. Export results and retain paper records according to event policy.
6. Run the smoke check against the final event and save its output.

## Cleanup rehearsal

- [ ] Export event, team, verification, issue, and audit data.
- [ ] Confirm seed without `--reset` preserves the event and a locked schedule.
- [ ] Confirm seed reset does nothing unless both `--reset` and
  `CAMPUS_HUNT_SEED_RESET=true` are present.
- [ ] In a non-production rehearsal only, run the guarded reset/delete flow and
  verify teams, generated users, starts, challenges, checkpoints, volunteers,
  progress, verifications, issues, and audit logs are removed.
- [ ] Re-seed and repeat preview → generate → lock before admitting players.

## Safe scripts

```bash
# Seed; defaults are 4 starts × 10 teams at 2-minute intervals
node scripts/seed-campus-hunt-pilot.js \
  --start-count 4 --start-capacity 10 --release-interval 2 \
  --starts-at 2026-08-09T09:00:00+05:30

# Destructive seed reset requires both controls
CAMPUS_HUNT_SEED_RESET=true node scripts/seed-campus-hunt-pilot.js --reset

# Delete/reset scripts also require explicit flags
node scripts/delete-campus-hunt-pilot.js --confirm-delete
node scripts/reset-campus-hunt-clue1.js --confirm-reset

# Verify topology, schedule assignments, capacity, and optional role visibility
CAMPUS_HUNT_SMOKE_SLUG=pilot-campus-hunt node scripts/campus-hunt-smoke.js
```

Production destructive scripts additionally require their documented
`CAMPUS_HUNT_ALLOW_PROD_*` environment variable.
