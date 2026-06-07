# CrwdCtrl Frontend

This is the React + Vite frontend for **CrwdCtrl**.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

## Environment

Copy `frontend/.env.example` to `frontend/.env` and set values (especially `VITE_API_BASE_URL`).

The app expects `VITE_API_BASE_URL` to point at the backend API base (ending in `/api`), for example:
- `http://localhost:8080/api`

## Build

```bash
npm run build
npm run preview
```

## More docs

See the root `README.md` for full-stack setup, backend instructions, and deployment notes.
