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
- This repo includes environment presets:
  - `frontend/.env.development`
  - `frontend/.env.production`
  - `frontend/.env.domain`
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
- `npm run build:domain`: Windows-only helper that copies `.env.domain` → `.env` then builds

## Deployment notes
- **Vercel (frontend)**: set `VITE_API_BASE_URL` to your deployed backend base (ending in `/api`).
- **Railway / Cloud Run (backend)**: ensure `PORT` is provided by the platform (defaults to `8080` locally).

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

