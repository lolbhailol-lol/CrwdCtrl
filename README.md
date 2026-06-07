# CrwdCtrl

A full-stack festival management platform connecting organizers and participants for seamless event discovery, registration, and management across educational institutions.

## Tech Stack

### Frontend
- **React** + **Vite**
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **Firebase** for Google authentication (client)
- **PWA** support (`vite-plugin-pwa`)

### Backend
- **Node.js** + **Express**
- **MongoDB** + **Mongoose**
- **JWT** + **bcryptjs** for authentication
- **Firebase Admin SDK** for social auth verification (server)
- **Cloudinary** for media uploads
- **Nodemailer** / **Resend** for email delivery

### Deployment
- **Backend**: [Railway](https://railway.app) (Nixpacks)
- **Frontend**: [Vercel](https://vercel.com)
- **Database**: MongoDB Atlas

## Project Structure

```
CrwdCtrl/
├── railway.json                    # Railway deployment config
├── backend/
│   ├── package.json
│   ├── scripts/
│   │   └── cleanup-duplicate-registrations.js
│   └── src/
│       ├── server.js               # Entry point & Express setup
│       ├── config/
│       │   └── db.js               # MongoDB connection
│       ├── controllers/
│       │   ├── usercontroller.js          # Auth & profile
│       │   ├── studentController.js       # Student operations
│       │   ├── festOrganizerController.js # Festival CRUD
│       │   ├── competitionController.js   # Competition management
│       │   ├── registrationController.js  # Registration handling
│       │   ├── adminAuthController.js     # Admin authentication
│       │   ├── adminFestController.js     # Admin fest management
│       │   └── uploadController.js        # File uploads
│       ├── model/
│       │   ├── usermodel.js                    # Base user schema
│       │   ├── student&participant.js           # Student profile
│       │   ├── fest_organizer_model.js          # Festival data
│       │   ├── event_model.js                   # Event schema
│       │   ├── competition_model.js             # Competition schema
│       │   ├── competition_registration_model.js
│       │   └── registration_model.js            # Registration schema
│       ├── routers/
│       │   ├── userroute.js            # Auth routes
│       │   ├── studentroute.js         # Student routes
│       │   ├── festOrganizerRoute.js   # Organizer routes
│       │   ├── publicFestRoute.js      # Public discovery
│       │   ├── competitionRoute.js     # Competition routes
│       │   ├── registrationRoute.js    # Registration routes
│       │   └── adminRoute.js           # Admin routes
│       ├── middleware/
│       │   ├── authmiddleware.js       # JWT auth
│       │   └── adminAuth.js            # Admin auth
│       ├── services/
│       │   ├── emailService.js         # Email delivery
│       │   ├── cloudinaryService.js    # Image uploads
│       │   └── googleSheetsService.js  # Sheets integration
│       └── utils/
│           └── fileUpload.js           # Multer config
└── frontend/
    ├── package.json
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── vercel.json                 # Vercel deployment config
    └── src/
        ├── main.jsx                # App entry point
        ├── App.jsx / App.tsx       # Root component & routing
        ├── firebase.js             # Firebase client config
        ├── config/
        │   ├── env.js              # Environment helpers
        │   └── firebaseConfig.ts   # Firebase config
        ├── context/
        │   ├── AuthContext.jsx          # Auth state
        │   ├── DarkModeContext.jsx      # Theme toggle
        │   ├── FavoritesContext.jsx     # Saved events
        │   ├── NotificationsContext.jsx # Notifications
        │   └── RegisteredEventsContext.jsx
        ├── services/
        │   ├── apiService.js       # API client
        │   ├── authService.js/.ts  # Auth API calls
        │   ├── googleAuthService.ts
        │   └── searchService.js    # Search API
        ├── hooks/
        │   └── useEnv.js           # Env variable hook
        ├── components/
        │   ├── Navbar.jsx
        │   ├── Footer.jsx
        │   ├── EventCard.jsx/.tsx
        │   ├── FestCard.jsx
        │   ├── ProtectedRoute.tsx
        │   ├── ErrorBoundary.jsx
        │   ├── admin/              # Admin dashboard components
        │   └── pages/              # Page-level components
        ├── pages/
        │   ├── LoginPage.js/.tsx
        │   ├── DashboardPage.tsx
        │   ├── EventsPage.tsx
        │   ├── EventDetailsPage.tsx
        │   └── EventRegistrationPage.tsx
        ├── data/                   # Static data
        ├── assets/                 # Images & static files
        └── utils/                  # Utility functions
```

## Features

- **Multi-role auth** — Students, Organizers, Admins (JWT + Firebase Google sign-in)
- **Festival CRUD** — Create, manage, and publish festivals with events & competitions
- **Public discovery** — Browse, search, and filter fests by category (Cultural, Tech, Sports)
- **Registration system** — Register for fests, events, and competitions with capacity tracking
- **Admin dashboard** — Manage all fests, registrations, and competitions
- **Media uploads** — Cloudinary-powered image uploads for festivals
- **Email notifications** — Registration confirmations via Nodemailer/Resend
- **Dark mode** — Theme toggle across the app
- **Responsive UI** — Mobile-first with Tailwind CSS

## Setup

### Prerequisites
- Node.js >= 18
- MongoDB (local or Atlas)

### Backend
```bash
cd backend
npm install
cp .env.example .env       # create your local env file
npm run dev                # Development (nodemon)
npm start                  # Production
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # Vite dev server
npm run build           # Production build
```

### Environment Variables

**Backend**:
- Use `backend/.env.example` as the template.
- Create `backend/.env` locally (do **not** commit it).
- Default port is `8080` (see `backend/src/server.js`).

**Frontend**:
- Use `frontend/.env.example` as the template.
- Create `frontend/.env` locally (do **not** commit it).
- The frontend expects an API base like:
  - `VITE_API_BASE_URL=http://localhost:8080/api` (local)

### Useful URLs (local)
- **Frontend**: `http://localhost:5173`
- **Backend health**: `http://localhost:8080/api/health`

## Scripts

### Backend (`backend/package.json`)
- `npm run dev`: start with nodemon
- `npm start`: start with node
- `npm run health`: checks `GET /api/health`

### Frontend (`frontend/package.json`)
- `npm run dev`: Vite dev server
- `npm run build`: production build
- `npm run preview`: preview build locally

## Deployment

**Stack:** Frontend on [Vercel](https://vercel.com), backend on [Railway](https://railway.app), database on MongoDB Atlas.

### 1. Backend (Railway)

1. Create a Railway service with **Root Directory** = `backend` (or use repo `railway.json`).
2. Set these variables in the Railway dashboard (see `backend/.env.example`):

| Variable | Required | Notes |
|----------|----------|-------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Long random string |
| `NODE_ENV` | Yes | `production` |
| `CASHFREE_CLIENT_ID` | Yes | Payment Gateway API key |
| `CASHFREE_CLIENT_SECRET` | Yes | Payment Gateway secret |
| `CASHFREE_ENV` | Yes | `production` for live payments |
| `ADMIN_EMAIL` | Yes | Admin dashboard login |
| `ADMIN_PASSWORD` | Yes | Admin dashboard login |
| `FRONTEND_URL` | Recommended | e.g. `https://www.crwdctrl.in` |
| `RESEND_API_KEY` | Optional | Transactional email |
| `CLOUDINARY_*` | Optional | Image uploads |

3. Deploy — health check: `GET /api/health`

Verify Cashfree locally before deploy:
```bash
cd backend && node scripts/test-cashfree.js
```

### 2. Frontend (Vercel)

1. Set **Root Directory** to `frontend`.
2. Build uses `frontend/vercel.json` — env vars are baked in at build time.
3. **Critical:** `VITE_CASHFREE_MODE` must match backend `CASHFREE_ENV` (both `production` for live).
4. Production API URL: `VITE_API_BASE_URL=https://crwdctrl-production-9c58.up.railway.app/api`

For local dev, copy `frontend/.env.example` → `frontend/.env`.

### 3. Cashfree checklist

- Use **Payment Gateway** API keys (not Payouts).
- Whitelist your domains in Cashfree Dashboard: `https://www.crwdctrl.in`, `https://crwdctrl.in`, Vercel preview URLs if needed.
- Sandbox keys → set both `CASHFREE_ENV=sandbox` and `VITE_CASHFREE_MODE=sandbox`.

### 4. Post-deploy smoke test

- `GET https://<backend>/api/health` → 200
- Open site → register/login
- Test a paid fest/competition/trek booking → Cashfree checkout opens → payment verifies

## Deployment notes (legacy)
- **Vercel (frontend)**: set `VITE_API_BASE_URL` to your deployed backend base (ending in `/api`).
- **Railway (backend)**: `PORT` is injected automatically by the platform.

## API Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users/register` | — | Register user |
| POST | `/api/users/login` | — | Login |
| GET | `/api/users/profile` | JWT | Get profile |
| GET | `/api/public/fests` | — | Browse festivals |
| GET | `/api/public/fests/search` | — | Search festivals |
| GET | `/api/public/fests/:festId` | — | Festival details |
| POST | `/api/students/profile` | JWT | Create student profile |
| GET | `/api/students/registered-fests` | JWT | My registrations |
| POST | `/api/fest-organizer/create` | JWT | Create festival |
| PUT | `/api/fest-organizer/update/:festId` | JWT | Update festival |
| DELETE | `/api/fest-organizer/delete/:festId` | JWT | Delete festival |
| POST | `/api/registrations/register` | JWT | Register for event |
| GET | `/api/competitions/:festId` | — | List competitions |
| GET | `/api/admin/*` | Admin | Admin endpoints |

## License

All rights reserved.

