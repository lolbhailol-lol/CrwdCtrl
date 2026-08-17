# CrwdCtrl — Deployment Guide

**Last updated:** June 9, 2026  
**Covers:** Web (Vercel + Railway), Android (Capacitor), verification, and launch checklist.

---

## Architecture overview

| Layer | Platform | URL / ID |
|-------|----------|----------|
| Frontend (web) | Vercel | https://www.crwdctrl.in |
| Frontend (Android) | Capacitor | `in.crwdctrl.app` |
| Backend API | Railway | https://crwdctrl-production-9c58.up.railway.app |
| Database | MongoDB Atlas | via `MONGODB_URI` |
| Payments | Cashfree | webhook + JS SDK |
| Auth | JWT + Firebase | social + email |
| Push | FCM | web SW + native Android |

---

## 1. Backend deployment (Railway)

### Required environment variables

```env
NODE_ENV=production
MONGODB_URI=
JWT_SECRET=                    # min 32 chars — validated on boot
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
CASHFREE_CLIENT_ID=
CASHFREE_CLIENT_SECRET=
CASHFREE_ENV=production        # must be "production" or "sandbox"
CASHFREE_WEBHOOK_SECRET=       # required for HMAC verification; falls back to CLIENT_SECRET when unset (warned)
FRONTEND_URL=https://www.crwdctrl.in
FIREBASE_SERVICE_ACCOUNT_KEY=  # JSON string
```

### Required when Campus Hunt is enabled

```env
CAMPUS_HUNT_ENABLED=true
OFFLINE_BUNDLE_KEY=            # rotate independently of JWT_SECRET; boot fails if equal
CAMPUS_HUNT_CREDENTIAL_KEY=    # used by credentialCipher for team access packs
```

### Required for bot protection

```env
RECAPTCHA_SECRET_KEY=          # reCAPTCHA v3 backend key — pairs with VITE_RECAPTCHA_SITE_KEY
RECAPTCHA_MIN_SCORE=0.5        # optional; anything below returns 429
```

Note: `verifyRecaptcha` fails closed in production when `RECAPTCHA_SECRET_KEY`
is set and the client sends no token. Set `VITE_RECAPTCHA_SITE_KEY` on the
frontend before enabling the backend secret, otherwise real users start seeing
`CAPTCHA_TOKEN_REQUIRED`.

### Recommended

```env
SENTRY_DSN=
RESEND_API_KEY=
CORS_EXTRA_ORIGINS=            # preview URLs if needed
```

### Deploy steps

1. Push to `master` (Railway auto-deploys from GitHub).
2. Confirm health:
   ```bash
   cd backend
   npm run verify-deploy -- https://crwdctrl-production-9c58.up.railway.app
   ```
3. Expected responses:
   - `GET /api/health` → 200, `{ ok: true, status: 'OK', timestamp }` (public-safe)
   - `GET /api/ready` → 200, `checks: { database, env, firebaseAdmin }` all `true`
4. Cashfree webhook URL:
   ```
   https://crwdctrl-production-9c58.up.railway.app/api/payment/webhook
   ```
5. Pre-deploy sanity: `npm run lint:env` (fails fast on missing production env vars).

### Post-deploy logs to confirm

- `MongoDB connection successful`
- `Event reminder cron initialized`

---

## 2. Frontend web deployment (Vercel)

### Environment variables (Vercel dashboard)

Set in **Project → Settings → Environment Variables** (not only `vercel.json`):

```env
VITE_API_BASE_URL=https://crwdctrl-production-9c58.up.railway.app/api
VITE_CASHFREE_MODE=production
VITE_APP_ENVIRONMENT=production
VITE_SENTRY_DSN=                 # optional
VITE_FIREBASE_*=                 # all Firebase client keys
VITE_FIREBASE_VAPID_KEY=
```

### Deploy steps

1. Connect GitHub repo to Vercel.
2. Root directory: `frontend`
3. Build command: `npm run build`
4. Output: `dist`
5. Deploy and verify:
   - https://www.crwdctrl.in loads
   - Login / fest browse works
   - `/privacy-policy` accessible (Play Store requirement)

### SPA routing

`vercel.json` rewrites all paths to `index.html` — required for React Router.

---

## 3. Android deployment (Capacitor)

### Prerequisites

- Node.js 18+
- Android Studio (latest)
- JDK 17+
- Firebase project with **Android app** registered (`in.crwdctrl.app`)

### One-time setup

```bash
cd frontend
npm install
npm run build
npx cap sync android
```

### Firebase Android (required for push)

1. Firebase Console → Project Settings → Add Android app  
   Package name: `in.crwdctrl.app`
2. Download `google-services.json`
3. Place at: `frontend/android/app/google-services.json`  
   (See `google-services.json.example` for structure)
4. Add SHA-1 and SHA-256 fingerprints (debug + release) in Firebase Console.

```bash
# Debug keystore fingerprint (default Android debug)
cd frontend/android
./gradlew signingReport
```

### Google Sign-In (Android)

1. Firebase → Authentication → Sign-in method → Google → enabled
2. Add SHA-1/SHA-256 to Firebase Android app
3. Add authorized domain: `crwdctrl.in`
4. In Capacitor WebView, OAuth uses **redirect flow** (configured in `firebase.js` when native)

### Cashfree (Android)

1. Cashfree Dashboard → Developers → Domain / package whitelisting
2. Whitelist:
   - `https://www.crwdctrl.in`
   - `in.crwdctrl.app` (if required)
3. Mobile checkout uses **redirect mode** (`_self`) on native — see `useCashfree.js`

### App Links (deep links)

1. Host `/.well-known/assetlinks.json` on `https://www.crwdctrl.in`  
   Template: `frontend/public/.well-known/assetlinks.json`
2. Replace `REPLACE_WITH_YOUR_RELEASE_SHA256_FINGERPRINT` with release cert SHA-256
3. Verify: [Google Digital Asset Links tool](https://developers.google.com/digital-asset-links/tools/generator)

### Build debug APK (local testing)

```bash
cd frontend
npm run cap:sync
npx cap open android
```

In Android Studio: **Run** on device/emulator.

### Build release AAB (Play Store)

Signing is wired in `android/app/build.gradle`, which reads credentials from
`android/keystore.properties` (gitignored). One-command build:

1. Create the upload keystore once (store securely — never commit):
   ```bash
   cd frontend/android
   keytool -genkeypair -v -keystore crwdctrl-upload.keystore -alias crwdctrl -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy `keystore.properties.example` → `keystore.properties` and fill in the
   store/key passwords and alias.
3. Build the signed AAB:
   ```bash
   cd frontend
   npm run android:aab
   ```
   Output: `frontend/android/app/build/outputs/bundle/release/app-release.aab`
   (Equivalent manual path: Android Studio → **Build → Generate Signed Bundle / APK → Android App Bundle**.)
4. Upload `.aab` to Play Console → Internal testing track first.
5. After enrolling in **Play App Signing**, copy the **App signing key** SHA-1/SHA-256
   from Play Console → Setup → App signing into Firebase (Android app) and into
   `frontend/public/.well-known/assetlinks.json`, then redeploy + rebuild.

### Android scripts

| Command | Purpose |
|---------|---------|
| `npm run cap:sync` | Build web + copy to Android |
| `npm run cap:open` | Open Android Studio |
| `npm run android:build` | Alias for cap:sync |

### Android permissions (declared)

| Permission | Purpose |
|------------|---------|
| INTERNET | API, Cashfree, Firebase |
| CAMERA | Admin QR check-in scanner |
| POST_NOTIFICATIONS | Event reminders (Android 13+) |
| READ_MEDIA_IMAGES | Registration file uploads |
| VIBRATE | Notification alerts |

---

## 4. Deployment verification checklist

### Web

- [ ] `GET /api/health` → 200
- [ ] `GET /api/ready` → 200
- [ ] User login (email + Google)
- [ ] Fest registration (free + paid sandbox)
- [ ] Cashfree webhook test passes in dashboard
- [ ] Push notification on web (Chrome, permission granted)
- [ ] `/dashboard`, `/theatre` routes work

### Android (device)

- [ ] App launches from APK/AAB
- [ ] API calls succeed (CORS allows Capacitor origin)
- [ ] Google Sign-In completes (redirect return)
- [ ] Cashfree payment redirect returns to app
- [ ] Push token registers (`device: android` in backend)
- [ ] QR ticket displays (local QR, no external API)
- [ ] Admin QR scanner (native ML Kit on device)
- [ ] Android back button navigates correctly
- [ ] Deep link opens app: `https://www.crwdctrl.in/fests`

### Automated backend verify

```bash
cd backend
npm run verify-deploy -- https://crwdctrl-production-9c58.up.railway.app
```

---

## 5. Play Store submission checklist

| Item | Status / action |
|------|-----------------|
| Privacy policy URL | https://www.crwdctrl.in/privacy-policy |
| Terms URL | https://www.crwdctrl.in/terms-and-conditions |
| App package | `in.crwdctrl.app` |
| Version | `1.0.0` (versionCode 1) |
| Adaptive icon | Replace default Capacitor launcher icons |
| Feature graphic + screenshots | Create in Play Console |
| Content rating | Complete questionnaire |
| Data Safety form | Match privacy policy (email, phone, payments, FCM) |
| Target audience | Student / general audience — set appropriately |
| Internal testing | Upload AAB, invite testers, fix blockers |
| Production release | Promote after 7+ days internal testing |

---

## 6. Rollback procedures

### Backend (Railway)

1. Railway → Deployments → select previous deployment → **Rollback**

### Frontend (Vercel)

1. Vercel → Deployments → previous production → **Promote to Production**

### Android

1. Play Console → Release → rollback to previous version  
   (or upload hotfix AAB with incremented `versionCode`)

---

## 7. Monitoring

| Service | Env var | Dashboard |
|---------|---------|-----------|
| Sentry | `SENTRY_DSN`, `VITE_SENTRY_DSN` | sentry.io |
| Railway logs | — | railway.app project logs |
| Vercel analytics | — | vercel.com project |
| Cashfree | — | merchant dashboard webhooks |

---

## 8. Related documentation

| Document | Purpose |
|----------|---------|
| `PROJECT_AUDIT.md` | Initial codebase audit |
| `SECURITY_FIXES_PHASE1.md` | Payment/auth security fixes |
| `PRODUCTION_HARDENING.md` | Web production hardening |
| `MOBILE_READINESS_REPORT.md` | Android readiness analysis |
| `backend/.env.example` | Backend env template |
| `frontend/.env.example` | Frontend env template |

---

## 9. Launch readiness scores

| Platform | Score | Notes |
|----------|-------|-------|
| Web production | **78/100** | See PRODUCTION_HARDENING.md |
| Android / Capacitor | **~62/100** | After Phase A+B implementation; Play Store after assets + FCM file |
| Play Store live | **Pending** | Requires signed AAB + internal testing |

---

## 10. Common issues

| Issue | Fix |
|-------|-----|
| CORS blocked from Android | Ensure Railway has `https://localhost` in CORS; redeploy backend |
| Google Sign-In fails in app | Add SHA fingerprints to Firebase; use redirect (native path) |
| Cashfree payment blank screen | Whitelist domain in Cashfree; use redirect checkout on mobile |
| Push not working on Android | Add `google-services.json`; rebuild AAB |
| App Links not opening app | Fix `assetlinks.json` SHA-256; wait for Google verification |
| Webhook 400 signature | Use `CASHFREE_CLIENT_SECRET` as webhook secret |

---

*End of deployment guide.*
