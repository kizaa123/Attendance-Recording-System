# Run this in PowerShell as Administrator to allow phone/TA access to Attendify on your Wi-Fi network.
# Right-click PowerShell -> "Run as Administrator", then run:
# powershell -ExecutionPolicy Bypass -File .\scripts\allow-firewall-port.ps1

Write-Host "Opening TCP ports 3000 and 3443 in Windows Firewall for Attendify..." -ForegroundColor Cyan

try {
    netsh advfirewall firewall add rule name="Attendify Server (Port 3000)" dir=in action=allow protocol=TCP localport=3000
    netsh advfirewall firewall add rule name="Attendify HTTPS (Port 3443)" dir=in action=allow protocol=TCP localport=3443
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" | Where-Object { $_.IPAddress -notlike "192.168.56.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -ExpandProperty IPAddress -First 1)
    if (-not $lanIp) { $lanIp = "localhost" }
    Write-Host "`n[SUCCESS] Ports 3000 and 3443 are now open! Phones on your Wi-Fi can connect." -ForegroundColor Green
    Write-Host "HTTP URL:   http://$($lanIp):3000/" -ForegroundColor Yellow
    Write-Host "HTTPS URL:  https://$($lanIp):3443/ (Required for mobile camera)`n" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Could not add firewall rule. Please make sure you right-clicked PowerShell and selected 'Run as Administrator'." -ForegroundColor Red
}

Pause

