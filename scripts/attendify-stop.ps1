# Stops the background Attendify server on the configured port (default 3000).
$Root = Split-Path $PSScriptRoot -Parent
$port = if ($env:ATTENDIFY_PORT) { [int]$env:ATTENDIFY_PORT } else { 3000 }

New-Item -Path (Join-Path $Root ".attendify-stop") -ItemType File -Force | Out-Null

$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
$pids = $connections | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique
foreach ($procId in $pids) {
  if (-not $procId) { continue }
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq "node") {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped node process $procId (port $port)."
  }
}

Write-Host "Attendify stop requested. If a serve window is open, it will exit on the next restart cycle."
