# Creates Attendify DB user + database for local PostgreSQL (no Docker).
# Requires psql and a superuser (default Windows install: user "postgres").
#
# Usage:
#   $env:PGPASSWORD = "<your-postgres-superuser-password>"
#   .\scripts\setup-local-postgres.ps1
#
# Optional env:
#   PGHOST (default 127.0.0.1), PGPORT (5432), PGUSER (postgres)
#   ATTENDIFY_DB_USER (attendify), ATTENDIFY_DB_PASSWORD (attendify_dev), ATTENDIFY_DB_NAME (attendify)

$ErrorActionPreference = "Stop"

function Find-Psql {
  $candidates = @(
    $env:PSQL_PATH,
    "C:\Program Files\PostgreSQL\18\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe"
  ) | Where-Object { $_ }
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "psql not found. Install PostgreSQL and add bin to PATH, or set PSQL_PATH."
}

$psql = Find-Psql
$pgHost = if ($env:PGHOST) { $env:PGHOST } else { "127.0.0.1" }
$pgPort = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$pgUser = if ($env:PGUSER) { $env:PGUSER } else { "postgres" }
$dbUser = if ($env:ATTENDIFY_DB_USER) { $env:ATTENDIFY_DB_USER } else { "attendify" }
$dbPass = if ($env:ATTENDIFY_DB_PASSWORD) { $env:ATTENDIFY_DB_PASSWORD } else { "attendify_dev" }
$dbName = if ($env:ATTENDIFY_DB_NAME) { $env:ATTENDIFY_DB_NAME } else { "attendify" }

$pgPassSet = $null -ne (Get-Item -Path "Env:PGPASSWORD" -ErrorAction SilentlyContinue)
$allowEmpty = $env:ATTENDIFY_PG_EMPTY_OK -eq "1"
if (-not $pgPassSet -and -not $allowEmpty) {
  Write-Host "Set PGPASSWORD to your PostgreSQL superuser password (user: $pgUser), then re-run."
  Write-Host 'Example: $env:PGPASSWORD = "your-postgres-password"'
  Write-Host "Winget installs often leave an empty postgres password:"
  Write-Host '  $env:ATTENDIFY_PG_EMPTY_OK = "1"; .\scripts\setup-local-postgres.ps1'
  exit 1
}
if (-not $pgPassSet) {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

$env:PGHOST = $pgHost
$env:PGPORT = $pgPort
$env:PGUSER = $pgUser

$sql = @"
SELECT 1 FROM pg_roles WHERE rolname = '$dbUser';
"@
$exists = & $psql -d postgres -tAc $sql
if ($exists -ne "1") {
  & $psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE USER $dbUser WITH PASSWORD '$dbPass' LOGIN CREATEDB;"
  Write-Host "Created role $dbUser"
} else {
  & $psql -d postgres -v ON_ERROR_STOP=1 -c "ALTER USER $dbUser WITH PASSWORD '$dbPass';"
  Write-Host "Updated password for $dbUser"
}

$dbExists = & $psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName';"
if ($dbExists -ne "1") {
  & $psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbName OWNER $dbUser;"
  Write-Host "Created database $dbName"
} else {
  Write-Host "Database $dbName already exists"
}

& $psql -d postgres -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;"

Write-Host ""
Write-Host "DATABASE_URL (already matches apps/api/.env.example if defaults used):"
Write-Host "postgresql://${dbUser}:${dbPass}@${pgHost}:${pgPort}/${dbName}?schema=public"
Write-Host ""
Write-Host "Next: npm run db:migrate && npm run db:seed && npm run api:dev"
