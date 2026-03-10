# CrwdCtrl

A full-stack festival management platform connecting organizers and participants for seamless event discovery, registration, and management across educational institutions.

## Tech Stack

### Frontend
- **React 19** with Vite
- **Tailwind CSS 4** for styling
- **React Router 7** for navigation
- **Firebase** for Google authentication
- **TypeScript** support

### Backend
- **Node.js** with **Express 5**
- **MongoDB** with **Mongoose 8**
- **JWT** + **bcryptjs** for authentication
- **Firebase Admin SDK** for social auth verification
- **Cloudinary** for media uploads
- **Nodemailer** / **Brevo** for email delivery

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
- **Email notifications** — Registration confirmations via Nodemailer/Brevo
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
cp .env.example .env   # Edit with your credentials
npm run dev             # Development (nodemon)
npm start               # Production
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # Vite dev server
npm run build           # Production build
```

### Environment Variables

**Backend** (`.env`):
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret
PORT=8080
NODE_ENV=development
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

**Frontend** (`.env`):
```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

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

