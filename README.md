# Attendify

University attendance platform (QR, enrollment, dashboards). This repo contains:

| Stack | Port | How to run |
|-------|------|------------|
| **Faculty app** (HTML + SQLite) | `3000` | `npm start` or `npm run serve:bg` → [localhost:3000](http://localhost:3000/) |
| **Phase 1 API** (NestJS + PostgreSQL) | `3001` (suggested) | See [docs/PHASE1.md](docs/PHASE1.md) |

Architecture and roadmap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).  
**How attendance should work** (one QR, shared IT/CS lectures): [docs/ATTENDANCE-FLOW.md](docs/ATTENDANCE-FLOW.md).

## New stack (Phase 1) — quick start

1. Install **PostgreSQL** on Windows ([guide](docs/POSTGRES-WINDOWS.md)) — Docker is optional.
2. Create the `attendify` database (PowerShell, use your **postgres** superuser password):

```powershell
$env:PGPASSWORD = "YOUR_POSTGRES_PASSWORD"
.\scripts\setup-local-postgres.ps1
```

3. From the project root:

```bash
npm install
npm approve-scripts --allow-scripts-pending   # if npm warns about Prisma/argon2 scripts
npm run db:migrate
npm run db:seed
npm run api:dev
```

**Docker alternative:** `npm run db:up` starts Postgres + Redis from `docker-compose.yml` if you prefer containers.

3. Dev staff login: `staff@attendify.local` / `ChangeMe123!` (no separate “admin” role).

Default API env is `apps/api/.env` (copied from `.env.example` for local dev).
