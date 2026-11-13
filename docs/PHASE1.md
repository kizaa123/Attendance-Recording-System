# Phase 1 — Runbook

## Prerequisites

- Node.js 20+
- **PostgreSQL** (local install — see [POSTGRES-WINDOWS.md](POSTGRES-WINDOWS.md)), *or* Docker Desktop for `docker compose`

## Database setup (recommended: local PostgreSQL)

```powershell
$env:PGPASSWORD = "YOUR_POSTGRES_SUPERUSER_PASSWORD"
.\scripts\setup-local-postgres.ps1
```

**Optional (Docker):**

```bash
npm run db:up
```

## Install & migrate

From the project root:

```bash
npm install
```

If npm reports pending **allowScripts** (Prisma, argon2, esbuild), approve them:

```bash
npm approve-scripts --allow-scripts-pending
npm rebuild
```

Then:

```bash
npm run db:migrate
npm run db:seed
```

When prompted for a migration name, use: `init`

## Run API

```bash
npm run api:dev
```

Health: `GET http://127.0.0.1:3000/api/v1/health`

## Smoke test

```bash
# Login
curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"staff@attendify.local\",\"password\":\"ChangeMe123!\"}"

# Use accessToken from response:
curl -s http://127.0.0.1:3000/api/v1/auth/me -H "Authorization: Bearer <accessToken>"
```

## Legacy prototype

The HTML faculty app runs on port **3000** by default (`npm start`). Use `$env:PORT = "3001"` for this Nest API so both can run together.
