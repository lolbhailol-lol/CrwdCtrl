# CrwdCtrl — Operations Runbook

Companion to [DEPLOYMENT.md](DEPLOYMENT.md). Focuses on event-day operations,
incident response, and pre/post-deploy smoke checks. Owners: on-call engineer +
event lead.

---

## 0. Golden rules

- **Never** hot-edit the database from the shell during an active event.
- **Never** rotate `JWT_SECRET` while users are actively booking — you invalidate every session.
- **Never** disable rate limits without a documented incident reason.
- All destructive actions must be logged in `#ops` before and after.

---

## 1. Pre-deploy smoke (5 minutes)

Run before every production deploy.

```bash
cd backend
npm run lint:env                                                # fails fast on missing env
npm run verify-deploy -- https://crwdctrl-production-9c58.up.railway.app
```

Manual checks in a browser:

- [ ] Home loads without console errors.
- [ ] User can log in (email + Google).
- [ ] `/api/health` returns 200 with only `{ ok, status, timestamp }`.
- [ ] Cashfree sandbox order → verify → registration created.
- [ ] Admin can log in → `/admin` loads.

---

## 2. Post-deploy smoke (10 minutes)

- [ ] `/api/ready` returns `{ ready: true, checks: { database, env, firebaseAdmin } }`.
- [ ] Cashfree webhook dashboard shows `2xx` for the "Send Test" event.
- [ ] Push notification: send test via admin → arrives on web + Android.
- [ ] `admin/scanner/*` login for a live fest, scan a real ticket.
- [ ] Sentry receives a fresh release marker (if `SENTRY_DSN` set).

---

## 3. Environment-day (event running)

### Standing dashboards

| What | Where |
|------|-------|
| Backend logs | Railway → `crwdctrl-production-*` → Logs |
| Frontend errors | Sentry `crwdctrl-web` |
| Backend errors | Sentry `crwdctrl-api` |
| Payment status | Cashfree merchant dashboard |
| MongoDB slow queries | Atlas → Performance Advisor |

### Sentry flow tags (added in Wave 3)

Filter for these in Sentry to see event-day pain points:

- `flow:payment_verify outcome:not_verified` — user paid but Cashfree returned pending; expect a small volume from webhook lag.
- `flow:payment_verify outcome:error` — real failures; investigate immediately.
- `flow:payment_webhook outcome:signature_invalid` — always worth a look; confirms webhook secret rotation is not needed.
- `flow:qr_checkin outcome:miss` — scanner scanned a QR not in any of the four collections; usually a fest mismatch or expired ticket.

### Rate-limit tuning

Peak scanner check-in windows are already tuned in
[backend/src/middleware/rateLimiter.js](backend/src/middleware/rateLimiter.js).
Do **not** disable during an event without a documented reason.

If you must temporarily raise the scanner limit:

```
SCANNER_RATE_LIMIT_MAX=  # env var
```

restart the Railway service, and revert after the event.

---

## 4. Common incidents

### "Users can't log in"

1. Check `/api/health` on Railway — DB connected?
2. Check `/api/ready` — Firebase admin configured?
3. Confirm `RECAPTCHA_SECRET_KEY` matches `VITE_RECAPTCHA_SITE_KEY`. Mismatch causes `CAPTCHA_TOKEN_REQUIRED` in production only.
4. Check Sentry for a spike in `AuthError` or `Firebase authentication failed`.

### "Payments succeed but registrations don't appear"

1. Check Cashfree webhook history → signature valid?
2. Sentry filter `flow:payment_webhook outcome:signature_invalid` — recent hits?
3. Verify `CASHFREE_WEBHOOK_SECRET` matches Cashfree dashboard secret.
4. Cross-check `PaymentOrder` collection in Atlas: `status: 'PAID'` but no matching Registration → run fulfillment manually via `backend/scripts/reprocess-payment.js <orderId>` (safe: idempotent).

### "QR scanner not finding tickets"

1. Sentry filter `flow:qr_checkin outcome:miss` for the misses.
2. Confirm scanner is logged into the right fest (scanner JWT is fest-scoped).
3. If the ticket was issued from a legacy path with no `qrCodeData` on the record, the check-in fallback path (`registrationId` lookup) still resolves it — the miss should populate `qrCodeData` and succeed on second try.

### "Campus Hunt offline bundle rejected"

1. Confirm `OFFLINE_BUNDLE_KEY` is set on Railway and matches the value used at bundle generation time.
2. Do **not** rotate mid-event — teams already downloaded packs signed with the previous key.

---

## 5. Emergency procedures

### Freeze a compromised admin account

```
# Atlas Data Explorer
db.users.updateOne(
  { email: 'compromised@example.com' },
  { $set: { isDeleted: true, deletedAt: new Date() } }
)
```

The next login attempt will hit the `isDeleted` guard in
[usercontroller.js](backend/src/controllers/usercontroller.js) and return 403.

### Rotate JWT_SECRET (only outside event windows)

1. Announce a 5-minute maintenance window on the status page.
2. Update `JWT_SECRET` in Railway → wait for deploy → confirm boot.
3. All active sessions are invalidated. Users must log in again.
4. If Campus Hunt is enabled, `OFFLINE_BUNDLE_KEY` is independent; you do
   **not** need to rotate it here (see Wave 1.3 fix).

### Roll back a bad backend deploy

Follow section 6 of [DEPLOYMENT.md](DEPLOYMENT.md). Railway keeps the previous
deployment for one-click rollback.

---

## 6. Monthly hygiene

- [ ] Review Cashfree webhook secret rotation calendar.
- [ ] Verify Atlas indexes match schema (Atlas → Performance Advisor → Indexes).
- [ ] Sample Sentry for silent 5xx (`flow:*:error`) that never paged.
- [ ] Confirm Firebase service account key still valid (no expiry warnings).
- [ ] Confirm `google-services.json` is present in CI but **not** in the repo.

---

*End of runbook.*
