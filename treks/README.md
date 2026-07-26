# CrwdCtrl Treks

Live trek information vertical under **CrwdCtrl** — not booking, not marketplace.

> **Know Before You Trek.** What is today's situation at my trek?

```
treks/
├── frontend/          # React 19 + Vite + Tailwind (MVP UI)
├── backend/           # Express API + Mongo live overlays
├── _reference/        # Stitch exports (gitignored)
├── VISION.md
└── README.md
```

## Env (keep separate)

Treks has its **own** env. Borrowed from main CrwdCtrl:

- `OPENROUTER_API_KEY` (+ optional `OPENROUTER_MODEL`) — future AI bot only  
  Read from `backend/.env` **only those keys** (no Mongo/JWT/Resend/Cloudinary).

| App | Env file |
|-----|----------|
| `treks/backend` | `treks/backend/.env` |
| `treks/frontend` | `treks/frontend/.env` (`VITE_TREKS_API_URL`) |

### Backend `.env` keys

| Key | Purpose |
|-----|---------|
| `PORT` | Default `5055` |
| `CORS_ORIGIN` | Allowed frontend origins |
| `TREKS_MONGODB_URI` | Atlas/local Mongo URI for check-ins + status |
| `TREKS_MONGODB_DB` | Database name (default `crwdctrl_treks`) |
| `SCOUT_TOKEN` | Bearer token for scout status editor |

Without `TREKS_MONGODB_URI`, the API still serves the JS trek catalog; check-in / status writes return `503`.

## Run live (frontend + backend)

Terminal 1 — API:
```bash
cd treks/backend
cp .env.example .env   # once — set TREKS_MONGODB_URI + SCOUT_TOKEN
npm install
npm run dev
```
→ `http://localhost:5055`

Terminal 2 — UI:
```bash
cd treks/frontend
cp .env.example .env   # once (VITE_TREKS_API_URL=http://localhost:5055)
npm install
npm run dev
```

UI loads treks/alerts from the API. If the API is down, it falls back to local mock and shows a banner.

## Live presence (day-wise)

Home board:

1. Pick a day (Today → +6 days IST).
2. Filter All / Waterfalls / Jungles.
3. **Mark me in** for that day (solo / group / community + headcount).

People counts and crowd rollup are **per selected date**. Scout trail/weather overlays still apply.

Scout editor (no main nav chrome):

- Open `/scout/:slug`
- Enter `SCOUT_TOKEN` (stored in `sessionStorage` for the session)
- Patch crowd / weather / trail / parking / entry / alert

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Health (+ mongo/scout flags) |
| `GET /api/treks?date=YYYY-MM-DD` | All treks enriched for that day (today…+6) |
| `GET /api/treks/:slug?date=` | Trek detail for that day |
| `GET /api/alerts` | Alerts |
| `POST /api/treks/:slug/check-ins` | Mark in (`date` optional, today…+6) |
| `GET /api/treks/:slug/check-ins?date=` | Check-ins for a day |
| `GET /api/treks/:slug/check-ins/today` | Alias for today |
| `PATCH /api/treks/:slug/status` | Scout status (`Authorization: Bearer <SCOUT_TOKEN>`) |

Vercel root: `treks/frontend` · set `VITE_TREKS_API_URL` to your Railway/API URL in production.

## Domain

Deploy frontend separately → connect `treks.crwdctrl.in` on that Vercel project.

## Out of scope (this pass)

Login, bookings, payments, friend invite links, OTP, weather auto-fill, full admin dashboard.
