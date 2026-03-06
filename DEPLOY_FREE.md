# Deployment Guide (Free Tier)

This guide deploys the app with:

- Database: Supabase Postgres (or Neon Postgres)
- Backend: Render Web Service
- Frontend: Cloudflare Pages or Vercel

---

## Architecture

- Frontend calls backend via `VITE_API_BASE_URL`
- Backend connects to Postgres using `DATABASE_URL`
- Backend health endpoints:
  - `/healthz` (process)
  - `/api/health` (process + DB)

---

## 1) Create managed PostgreSQL

### Supabase (recommended)

1. Create a new Supabase project.
2. Open project settings and copy the Postgres connection string.
3. Keep SSL enabled (`sslmode=require` in URL or use `PGSSL=true` on backend).

### Neon (alternative)

1. Create a Neon project/database.
2. Copy the connection string.
3. Use SSL-enabled connection.

---

## 2) Deploy backend on Render

1. Push your code to GitHub.
2. In Render, create a **Web Service** from your repo.
3. Configure:
   - Root Directory: `backend`
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
4. Add environment variables:

```dotenv
DATABASE_URL=<your_supabase_or_neon_connection_string>
PGSSL=true
PORT=3001
JWT_SECRET=<strong-random-secret>
ADMIN_EMAIL=<your-admin-email>
ADMIN_PASSWORD=<strong-admin-password>
```

5. Deploy and wait for build/start to complete.

### Verify backend after deploy

- `https://<your-render-service>.onrender.com/healthz`
- `https://<your-render-service>.onrender.com/api/health`

`/api/health` should return `dbConnected: true`.

---

## 3) Deploy frontend

### Option A: Cloudflare Pages

1. Connect GitHub repo.
2. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add env var:

```dotenv
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
```

4. Deploy.

### Option B: Vercel

1. Import repo.
2. Framework preset: Vite.
3. Add env var:

```dotenv
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
```

4. Deploy.

---

## 4) Post-deploy validation checklist

1. Open frontend URL.
2. Login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from backend env.
3. Confirm dashboard loads.
4. Test create/edit/delete for at least one file record.
5. Confirm backend health endpoints are still green.

---

## 5) Security checklist

Before production usage:

- Rotate `JWT_SECRET` and `ADMIN_PASSWORD` from local defaults.
- Never commit `.env` files.
- Keep `.env.example` files as templates only.
- Limit who can access your backend dashboard/service settings.

---

## 6) Updating production

1. Push changes to `main`.
2. Render and frontend host auto-redeploy (if auto-deploy is enabled).
3. Recheck:
   - frontend app
   - `/healthz`
   - `/api/health`

If there is an issue, roll back to previous deployment from your hosting dashboard.
