# Keeps the Attendify UI (node server.js) on http://localhost:3000/
# Restarts automatically if the process exits. Close this window or run attendify-stop.ps1 to stop.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

# Dual-stack (::) so browsers using localhost (IPv6) reach this app — see server.js.
if (-not $env:ATTENDIFY_HOST) { Remove-Item Env:ATTENDIFY_HOST -ErrorAction SilentlyContinue }
if (-not $env:ATTENDIFY_PORT) { $env:ATTENDIFY_PORT = "3000" }

$stopFile = Join-Path $Root ".attendify-stop"

Write-Host ""
Write-Host "Attendify local server"
Write-Host "  URL:  http://localhost:$($env:ATTENDIFY_PORT)/"
Write-Host "  Stop: run scripts\attendify-stop.ps1 or close this window"
Write-Host ""

while ($true) {
  if (Test-Path $stopFile) {
    Remove-Item $stopFile -Force
    Write-Host "[Attendify] Stop signal received. Exiting."
    break
  }

  $started = Get-Date
  Write-Host "[$($started.ToString('HH:mm:ss'))] Starting node server.js ..."
  & node server.js
  $exit = $LASTEXITCODE

  if (Test-Path $stopFile) {
    Remove-Item $stopFile -Force
    Write-Host "[Attendify] Stopped."
    break
  }

  Write-Host "[Attendify] Server ended (exit $exit). Restarting in 3 seconds..."
  Start-Sleep -Seconds 3
}
