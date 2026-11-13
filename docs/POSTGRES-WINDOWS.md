# PostgreSQL on Windows (no Docker)

Attendify’s API needs **PostgreSQL only** for Phase 1. **Redis** is optional until later phases.

## 1. Install PostgreSQL

1. Download the installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) (or use **winget**: `winget install PostgreSQL.PostgreSQL.17`).
2. During setup:
   - Port **5432** (default)
   - Remember the **postgres** superuser password
   - Install **Command Line Tools** (includes `psql`)

**Winget install:** The EDB installer often leaves the `postgres` user with an **empty password** (no prompt). You can connect with no password, or run `scripts\reset-postgres-windows-password.ps1` **as Administrator** to set one.

## 2. Create Attendify database

From the project root in PowerShell:

```powershell
$env:PGPASSWORD = "YOUR_POSTGRES_SUPERUSER_PASSWORD"
.\scripts\setup-local-postgres.ps1
```

This creates:

| Item | Default |
|------|---------|
| Database | `attendify` |
| App user | `attendify` / `attendify_dev` |

`apps/api/.env` already uses that connection string.

## 3. Migrate and run API

```bash
npm run db:migrate
npm run db:seed
npm run api:dev
```

When `prisma migrate dev` asks for a migration name, use `init`.

## Service

PostgreSQL usually runs as a Windows service (`postgresql-x64-17` or similar). Start it from **Services** or:

```powershell
Get-Service *postgres*
Start-Service postgresql-x64-17
```

## Redis

Not required for Phase 1 login/RBAC. You can ignore `REDIS_URL` until WebSockets or caching are implemented.
