# Resets the local postgres superuser password (run as Administrator).
# Use when you installed via winget/installer and never got or forgot the password.
#
# Usage (PowerShell as Admin):
#   cd "C:\Users\Admin\Desktop\Attendance Recording system"
#   .\scripts\reset-postgres-windows-password.ps1
#
# Optional:
#   $env:NEW_POSTGRES_PASSWORD = "YourChosenPassword"

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$pgVer = "17"
$dataDir = "C:\Program Files\PostgreSQL\$pgVer\data"
$pgHba = Join-Path $dataDir "pg_hba.conf"
$psql = "C:\Program Files\PostgreSQL\$pgVer\bin\psql.exe"
$serviceName = "postgresql-x64-$pgVer"

if (-not (Test-Path $pgHba)) {
  throw "Not found: $pgHba — adjust `$pgVer` if you use another major version."
}

$newPass = if ($env:NEW_POSTGRES_PASSWORD) { $env:NEW_POSTGRES_PASSWORD } else { "attendify_postgres_dev" }

$backup = "$pgHba.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $pgHba $backup

$content = Get-Content $pgHba -Raw
$content = $content -replace '(?m)^(\s*local\s+all\s+all\s+)\S+(\s*)$', '${1}trust${2}'
$content = $content -replace '(?m)^(\s*host\s+all\s+all\s+127\.0\.0\.1/32\s+)\S+(\s*)$', '${1}trust${2}'
$content = $content -replace '(?m)^(\s*host\s+all\s+all\s+::1/128\s+)\S+(\s*)$', '${1}trust${2}'
Set-Content -Path $pgHba -Value $content -NoNewline

Restart-Service $serviceName -Force
Start-Sleep -Seconds 2

$escaped = $newPass -replace "'", "''"
& $psql -U postgres -d postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '$escaped';"

# Restore scram-sha-256
$restored = Get-Content $backup -Raw
Set-Content -Path $pgHba -Value $restored -NoNewline
Restart-Service $serviceName -Force

Write-Host ""
Write-Host "Postgres superuser password is now:"
Write-Host "  $newPass"
Write-Host ""
Write-Host "Next:"
Write-Host "  `$env:PGPASSWORD = `"$newPass`""
Write-Host "  .\scripts\setup-local-postgres.ps1"
Write-Host "  npm run db:migrate"
Write-Host "  npm run db:seed"
