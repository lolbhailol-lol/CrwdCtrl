# CrwdCtrl Treks

Live information platform for Maharashtra trekkers — not booking, not marketplace.

> **Know Before You Trek.** Real-time trek conditions across Maharashtra.

Open website: no login, signup, payments, or profiles. MVP uses mock JSON for iconic destinations only. Separate from main CrwdCtrl; structured for `treks.crwdctrl.in`.

```
treks/
├── frontend/   # React + Vite UI (MVP)
└── backend/    # Reserved for future Treks API (not built yet)
```

## Local setup (frontend)

```bash
cd treks/frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build

```bash
cd treks/frontend
npm run build
npm run preview
```

## Deploy on Vercel

1. Add a **new** Vercel project from this repo.
2. Set **Root Directory** to `treks/frontend`.
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Deploy.

`frontend/vercel.json` includes SPA rewrites for client-side routes.

## Connect `treks.crwdctrl.in` later

1. Vercel project → **Settings → Domains** → add `treks.crwdctrl.in`.
2. At DNS for `crwdctrl.in`, add the CNAME Vercel shows.
3. Do **not** point this domain at the main CrwdCtrl frontend.

## Backend

See `backend/README.md`. MVP has no Treks API — UI uses mock JSON. When ready, implement APIs under `treks/backend/` and switch `frontend/src/services/trekService.js`.

## Out of scope (MVP)

Auth, payments, bookings, organizer/admin dashboards, notifications, AI, forums, profiles, and live backend APIs.
