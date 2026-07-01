# Trek Organizer Portal (Community Organizer)

Replaces Google Sheets–based trek registration management with a dedicated organizer dashboard inside CrwdCtrl. The public user booking flow is unchanged.

Organizers are linked to a **trek community** and manage **all treks** in that community. Login uses **username + password** (assigned by super admin only).

---

## URLs

| Role | URL |
|------|-----|
| Organizer login | `/trek-organizer/login` |
| Community home (trek picker) | `/trek-organizer` |
| Trek dashboard | `/trek-organizer/treks/:trekId` |
| Participants | `/trek-organizer/treks/:trekId/participants` |
| QR scanner | `/trek-organizer/treks/:trekId/scan` |
| Notifications | `/trek-organizer/treks/:trekId/notifications` |
| Admin — manage organizers | `/admin/trek-organizers` |

The portal runs **standalone** (no main CrwdCtrl navbar, footer, or bottom nav).

---

## Quick start

### 1. Admin setup
1. Log in as Super Admin → `/admin/trek-organizers`
2. Create organizer: **name**, **username** (≥3 chars, `a-z0-9_`), **password** (≥8 chars), **trek community**
3. Click **Copy URL** and share `/trek-organizer/login` with the organizer

### 2. Ensure treks are linked
Each trek must have `communityId` matching the organizer’s community. Organizers only see treks in their assigned community.

### 3. Organizer login
1. Open `/trek-organizer/login` on phone or laptop
2. Sign in with username + password
3. **One trek** → auto-opens that trek’s dashboard  
   **Multiple treks** → community home with trek list

---

## Architecture

### Backend files

| File | Purpose |
|------|---------|
| `backend/src/routes/index.js` | Mounts `/api/trek-organizer` and `/api/admin/trek-organizers` |
| `backend/src/routers/trekOrganizerRoute.js` | Organizer API routes (login rate-limited) |
| `backend/src/routers/adminTrekOrganizerRoute.js` | Admin CRUD for organizer accounts |
| `backend/src/controllers/trekOrganizerController.js` | Login, dashboard, participants, check-in, notifications |
| `backend/src/controllers/adminTrekOrganizerController.js` | Super-admin organizer management |
| `backend/src/middleware/trekOrganizerAuth.js` | JWT auth + `requireTrekAccess` |
| `backend/src/utils/trekOrganizerAccess.js` | Community trek listing + access checks |
| `backend/src/utils/trekOrganizerFormat.js` | Participant formatting + CSV export |
| `backend/src/utils/trekParticipantOutreach.js` | In-app + push + email delivery |
| `backend/src/utils/platformFee.js` | Revenue split (organizer net vs platform fee) |
| `backend/src/model/trek_organizer_account_model.js` | Organizer account schema |
| `backend/src/models/index.js` | Registers organizer model at startup |
| `backend/src/routers/publicTrekRoute.js` | Sheets append gated by `TREK_REGISTRATION_USE_SHEETS` |

### Frontend files

| File | Purpose |
|------|---------|
| `frontend/src/app/router/trekOrganizerRoutes.jsx` | Route definitions |
| `frontend/src/app/router/lazyPages.js` | Lazy imports |
| `frontend/src/app/router/index.jsx` | Registers trek organizer routes |
| `frontend/src/App.jsx` | Standalone shell for `/trek-organizer/*` |
| `frontend/src/utils/trekOrganizerSession.js` | `localStorage` session (`trek_organizer_session`) |
| `frontend/src/services/api/trekOrganizer.api.js` | API client (401 → redirect to login) |
| `frontend/src/pages/trek-organizer/TrekOrganizerLoginPage.jsx` | Mobile-friendly login |
| `frontend/src/pages/trek-organizer/TrekOrganizerProtectedRoute.jsx` | Token guard |
| `frontend/src/pages/trek-organizer/TrekOrganizerLayout.jsx` | Sidebar + mobile menu |
| `frontend/src/pages/trek-organizer/TrekOrganizerHomePage.jsx` | Community profile + trek list |
| `frontend/src/pages/trek-organizer/TrekOrganizerDashboardPage.jsx` | Stats + quick actions |
| `frontend/src/pages/trek-organizer/TrekOrganizerParticipantsPage.jsx` | Expandable cards, search, filters, export |
| `frontend/src/pages/trek-organizer/ParticipantCard.jsx` | Participant card UI |
| `frontend/src/pages/trek-organizer/TrekOrganizerScanPage.jsx` | QR scan + manual lookup |
| `frontend/src/pages/trek-organizer/TrekOrganizerNotificationsPage.jsx` | Reminders + broadcasts |
| `frontend/src/pages/trek-organizer/TrekOrganizerParticipantModal.jsx` | Detail modal (scan page) |
| `frontend/src/pages/admin/TrekOrganizersPage.jsx` | Admin CRUD + copy login URL |
| `frontend/src/components/admin/CheckinScannerPage.jsx` | Reused QR scanner component |

---

## APIs

### Organizer (`/api/trek-organizer`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Username/password → JWT (`role: trek_organizer`). Rate-limited. |
| GET | `/me` | Profile, community, and all treks in community |
| GET | `/treks/:trekId/dashboard` | Stats (registrations, seats, check-in, **organizer revenue**) |
| GET | `/treks/:trekId/participants` | Paginated list (`search`, `paymentStatus`, `checkInStatus`, `sortBy`, `sortDir`) |
| GET | `/treks/:trekId/participants/:bookingId` | Participant detail + timeline + payment breakdown |
| GET | `/treks/:trekId/participants/lookup?q=` | Search by booking ID, name, phone, email |
| GET | `/treks/:trekId/participants/export` | CSV download (includes dynamic form fields) |
| POST | `/treks/:trekId/checkin` | QR or booking ID check-in (`logToSheets: false`) |
| GET | `/treks/:trekId/checkin/stats` | Live check-in stats for scanner |
| POST | `/treks/:trekId/participants/:bookingId/resend-confirmation` | Resend in-app + push + email |
| POST | `/treks/:trekId/notifications/reminder` | Reminder to all confirmed participants |
| POST | `/treks/:trekId/notifications/broadcast` | Broadcast announcement |

**Dashboard revenue** returns organizer net (ticket portion only), excluding CrwdCtrl platform fee:
- `organizerRevenue` / `revenue` — what the organizer receives
- `platformFees` — CrwdCtrl share
- `grossCollected` — total paid by customers

**Notification delivery** (reminder, broadcast, resend) uses triple channel:
- **In-app** — users with linked `userId`
- **Push** — FCM tokens (app or web, respects user preferences)
- **Email** — all participants with valid email (including guests without account)

Response includes `delivery: { inApp, push, email, participants, skipped }`.

### Admin (`/api/admin/trek-organizers`) — requires admin JWT

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List organizers (with community) |
| POST | `/` | Create organizer (name, username, password, communityId) |
| PUT | `/:id` | Update organizer (password, community, active flag) |
| DELETE | `/:id` | Delete organizer |

---

## Database

### Collection: `trekorganizeraccounts`

```js
{
  name: String,           // display name
  username: String,       // unique, lowercase, login identifier
  email: String,          // optional contact
  passwordHash: String,
  phone: String,
  communityId: ObjectId,  // ref TrekCommunity — primary access model
  assignedTrekIds: [ObjectId], // deprecated legacy fallback
  isActive: Boolean,
  createdBy: ObjectId,
  lastLoginAt: Date,
  timestamps
}
```

### Trek bookings (unchanged)

Organizer portal reads existing `TrekBooking` fields:
- `formData`, `bookingDetails`, `checkedIn`, `checkedInAt`, `qrCodeData`, `status`, `userId`, `userEmail`, `userName`

### Treks must have `communityId`

For community-based access, each published trek should have `communityId` set to the organizer’s community. Legacy organizers with `assignedTrekIds` only can still access those specific treks.

---

## Authentication

1. **Separate login** at `/trek-organizer/login` — not linked to user or admin accounts.
2. **No public registration** — accounts created only via Super Admin.
3. **JWT** payload: `{ organizerId, role: 'trek_organizer', username }`, **7-day TTL**.
4. **Session**: `localStorage` key `trek_organizer_session` (token, organizer, community, treks).
5. **401 handling**: API client clears session and redirects to login.
6. **Login rate-limited** via `authLimiter` (same as user auth).

---

## Security

| Control | Description |
|---------|-------------|
| `authenticateTrekOrganizer` | Validates JWT, role, active account |
| `requireTrekAccess` | Trek must belong to organizer’s community (or legacy assigned list) |
| Check-in scoped | Tickets for other treks rejected when `trekId` is set |
| Confirmed only | Non-`confirmed` bookings cannot be checked in |
| Organizer check-in | Skips Google Sheets (`logToSheets: false`) |
| CSV export | Full PII — restrict organizer access to trusted partners |
| Notification prefs | Respects `emailReminders`, `pushReminders`, `registrationAlerts` on user accounts |

---

## Mobile UX

Login and portal are optimized for phones:

- **Login**: safe-area insets, 48px touch targets, `text-base` inputs (no iOS zoom), full-width layout
- **Layout**: hamburger menu (44px), sidebar overlay, trek name in header
- **Participants**: expandable cards (not spreadsheet table), sticky pagination
- **Scan**: camera QR + manual lookup, bottom-sheet detail modal
- **Dashboard**: 2-column stat grid on mobile, large action buttons

---

## Participants UI

- **Expandable cards** with registration form fields (dynamic `formSchema` / `formData`)
- Live search (name, phone, email, booking ID)
- Filter chips: paid/free, checked in/pending
- Expand all / collapse all
- Stats bar: total, checked in, pending, organizer revenue
- Export CSV with form columns + payment breakdown (your share, platform fee, customer paid)
- Per-card actions: call, copy phone/ID, resend ticket

Sort API supports `sortBy` (`createdAt`, `name`, `payment`, `checkIn`) — UI currently defaults to `createdAt desc`.

---

## Notifications

### Organizer actions
- **Reminder** — optional custom title/message; defaults to standard trek reminder
- **Broadcast** — title + message required; presets for reporting time, meeting point, cancellation
- **Resend confirmation** — per participant from card or scan modal

### Delivery channels
| Participant type | In-app | Push | Email |
|------------------|--------|------|-------|
| Logged-in user (`userId`) | Yes | Yes* | Yes* |
| Guest (email only) | No | No | Yes |

\*Respects user notification preferences.

### Check-in notifications
Trek check-in sends in-app notification + push (with preference check) to linked users.

---

## Revenue display

Customer pays: `registrationFee × people + platformFee`.

Organizer sees **your share** (ticket portion only):
- Dashboard stat: “Your revenue”
- Participant cards: “Your share ₹X · customer paid ₹Y”
- CSV columns: Your Share, Platform Fee, Customer Paid

Uses `splitTrekOrganizerPayment()` in `backend/src/utils/platformFee.js`.

---

## Testing checklist

### Admin setup
- [ ] `/admin/trek-organizers` — create organizer with username, password, community
- [ ] Copy login URL button works
- [ ] Edit: change password, community, deactivate
- [ ] Treks in admin have correct `communityId`

### Organizer auth (test on mobile)
- [ ] `/trek-organizer/login` — no signup link, large tap targets
- [ ] Valid login → single trek goes to dashboard; multiple treks → home picker
- [ ] Invalid credentials show error
- [ ] Deactivated account cannot log in
- [ ] Expired session redirects to login

### Dashboard
- [ ] Stats: registrations, seats, check-in, **your revenue** (excludes platform fee)
- [ ] Links: participants, scanner, notify

### Participants
- [ ] Cards show all registration form fields
- [ ] Search, filters, pagination
- [ ] Expand card → full form + your share payment
- [ ] Export CSV
- [ ] Resend confirmation (in-app + push + email)

### QR scanner
- [ ] Camera scans valid trek QR
- [ ] Already checked in → friendly message
- [ ] Manual lookup by booking ID, phone, name
- [ ] Manual check-in from results
- [ ] Wrong trek ticket rejected
- [ ] Non-confirmed booking rejected

### Notifications
- [ ] Reminder → delivery toast shows in-app/push/email counts
- [ ] Broadcast with preset
- [ ] Guest with email receives email
- [ ] Website bell shows in-app notification (after refresh/open)

### Security
- [ ] Organizer cannot access other community’s treks (403)
- [ ] Organizer APIs reject user/admin tokens
- [ ] User booking flow unchanged

### Google Sheets
- [ ] `TREK_REGISTRATION_USE_SHEETS=false` (default) — no Sheets append on register
- [ ] Organizer portal reads only from MongoDB

---

## Deployment

### Required environment

```env
# Backend
JWT_SECRET=your-secret

# Email (organizer reminders, broadcasts, guest notifications)
RESEND_API_KEY=re_...

# Optional
RESEND_FROM=CrwdCtrl <onboarding@crwdctrl.in>
FRONTEND_URL=https://crwdctrl.in
TREK_REGISTRATION_USE_SHEETS=false
```

### Frontend production build

```env
VITE_API_BASE_URL=https://your-api.com/api
VITE_FIREBASE_VAPID_KEY=...   # web push notifications
```

### Pre-deploy steps

1. Commit all trek-organizer portal files to git
2. Restart backend after deploy (new model + routes)
3. Create test organizer in admin with a real community
4. Verify treks have matching `communityId`
5. Test full flow on phone: login → dashboard → participants → scan → notify
6. Verify email delivery (requires `RESEND_API_KEY`)

---

## Known limitations

- Participant sort UI not exposed (API supports it; UI uses `createdAt desc`)
- Filter chips on participants page are small on very small screens (functional but not 44px)
- Export CSV contains full PII — no audit log of downloads
- Organizers without `communityId` on treks see empty trek list (fix in admin trek setup)

---

Restart the backend after changing env vars or adding new routes/models.
