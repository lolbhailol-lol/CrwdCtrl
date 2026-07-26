# CrwdCtrl Treks — Backend

Separate API service for the Treks vertical (not the main CrwdCtrl `backend/`).

## Structure

```
backend/
├── src/
│   ├── config/          # env
│   ├── controllers/     # trekController
│   ├── data/            # mock treks (sync from frontend when ready)
│   ├── middleware/      # errors
│   ├── routes/          # health, treks
│   ├── services/        # trekService (swap for DB later)
│   ├── utils/
│   ├── app.js
│   └── index.js
├── .env.example
├── package.json
└── README.md
```

## Setup

```bash
cd treks/backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:5055`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/treks` | List treks |
| GET | `/api/treks/:slug` | Trek detail |
| GET | `/api/treks/alerts` | Alerts |

## MVP note

Frontend still reads **local mock JSON** (`frontend/src/data/`).  
When you connect the API, update `frontend/src/services/trekService.js` only — pages stay unchanged.

No auth, bookings, or payments in v1.
