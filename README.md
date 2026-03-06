# Solomon Jayden Medical Center (SJMC) File System

A full-stack file registration and management system for Solomon Jayden Medical Center.

## Features

- Secure admin authentication
- Dashboard stats for all file categories
- Full CRUD for:
  - Personal Files
  - Family Files
  - Referral Files
  - Emergency Files
- Searchable/filterable data tables
- React + TypeScript frontend
- Node.js + Express + PostgreSQL backend

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL

---

## Local Setup

### Prerequisites

Install:

- Node.js 18+
- npm
- PostgreSQL (local install) **or** Docker Desktop

### 1) Clone and install dependencies

```bash
git clone <your-repository-url>
cd sjmc-file-management-system
npm install
cd backend
npm install
```

### 2) Configure backend environment

Create `backend/.env` from the sample:

```bash
cd backend
cp .env.example .env
```

Set values in `backend/.env`:

```dotenv
# Option A: single connection string
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/sjmc

# Option B: individual vars
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=sjmc
PGSSL=false

PORT=3001
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=admin@sjmc.com
ADMIN_PASSWORD=password123
```

### 3) Start PostgreSQL locally

#### Option A: Local PostgreSQL service

Create a database named `sjmc`.

#### Option B: Docker (quick start)

```bash
docker run -d --name sjmc-postgres \
  -e POSTGRES_USER=sjmc_user \
  -e POSTGRES_PASSWORD=YourStrongPassword123! \
  -e POSTGRES_DB=sjmc \
  -p 5432:5432 postgres:16-alpine
```

If using this Docker command, update `backend/.env` to:

```dotenv
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=sjmc_user
PGPASSWORD=YourStrongPassword123!
PGDATABASE=sjmc
```

### 4) Configure frontend environment (optional)

Create root `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Available frontend env vars:

- `VITE_API_BASE_URL` (defaults to `http://localhost:3001` in local dev)
- `VITE_LOGIN_EMAIL` (optional prefill)
- `VITE_LOGIN_PASSWORD` (optional prefill)

### 5) Run the project

From repo root:

```bash
npm run dev
```

Expected:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

### 6) Validate local health

- `GET http://localhost:3001/healthz`
- `GET http://localhost:3001/api/health`

If PostgreSQL is reachable, `/api/health` should return `dbConnected: true`.

### 7) One-command smoke test

With your app running (`npm run dev` from repo root), run:

```bash
npm run smoke
```

This checks:

- backend health (`/api/health`)
- login + token verification
- personal files endpoint
- frontend root page

Optional overrides:

- `SMOKE_API_BASE_URL`
- `SMOKE_FRONTEND_URL`
- `SMOKE_ADMIN_EMAIL`
- `SMOKE_ADMIN_PASSWORD`

---

## Common Local Issues

- `ECONNREFUSED 127.0.0.1:5432`: PostgreSQL is not running or env credentials are wrong.
- Port `3001` in use: stop stale Node process and restart dev servers.
- Docker daemon not running: start Docker Desktop first.

---

## Deployment

See [DEPLOY_FREE.md](DEPLOY_FREE.md) for production deployment (Supabase/Neon + Render + Cloudflare/Vercel).
