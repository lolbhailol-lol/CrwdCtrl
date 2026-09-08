# Backend

Express + MongoDB API for CrwdCtrl.

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

Fill `MONGODB_URI`, `JWT_SECRET`, and other values from `.env.example`. Default listen port is typically `8080`.

## Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Nodemon API server |
| `npm start` | Production start |
| `npm test` | API / module tests |

See the [root README](../README.md) for architecture and frontend pairing.
