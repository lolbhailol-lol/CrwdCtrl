# CrwdCtrl Frontend

This is the React + Vite frontend for **CrwdCtrl**.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

## Environment

This repo includes preset env files:
- `.env.development`
- `.env.production`
- `.env.domain`

The app expects `VITE_API_BASE_URL` to point at the backend API base (ending in `/api`), for example:
- `http://localhost:8080/api`

## Build

```bash
npm run build
npm run preview
```

For domain builds on Windows:

```bash
npm run build:domain
```

## More docs

See the root `README.md` for full-stack setup, backend instructions, and deployment notes.
