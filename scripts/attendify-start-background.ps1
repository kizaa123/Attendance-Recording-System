# Starts attendify-serve.ps1 in a minimized window (keeps running after you close Cursor).
$Root = Split-Path $PSScriptRoot -Parent
$serve = Join-Path $Root "scripts\attendify-serve.ps1"

$port = if ($env:ATTENDIFY_PORT) { [int]$env:ATTENDIFY_PORT } else { 3000 }
$inUse = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($inUse) {
  Write-Host "Port $port is already in use (PID $($inUse.OwningProcess)). Attendify may already be running."
  Write-Host "Open http://localhost:$port/"
  exit 0
}

Start-Process powershell.exe -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $serve
) -WorkingDirectory $Root -WindowStyle Minimized

Start-Sleep -Seconds 2
Write-Host "Attendify started in the background on http://localhost:$port/"
Write-Host "To stop: powershell -ExecutionPolicy Bypass -File scripts\attendify-stop.ps1"
