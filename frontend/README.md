# Frontend

React + Vite app for [CrwdCtrl](https://www.crwdctrl.in).

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

Point `VITE_API_BASE_URL` at your local backend (e.g. `http://localhost:8080/api`).

## Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build + SEO prerender |
| `npm test` | Frontend tests |
| `npm run cap:sync:prod` | Capacitor Android prod sync |

See the [root README](../README.md) for monorepo overview.
