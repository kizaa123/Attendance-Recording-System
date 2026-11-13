# Adds Attendify to Windows Startup (runs in background at sign-in). Run once; requires no admin.
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$cmd = Join-Path $Root "start-attendify.cmd"

if (-not (Test-Path $cmd)) {
  Write-Error "start-attendify.cmd not found in $Root"
  exit 1
}

$startup = [Environment]::GetFolderPath("Startup")
$lnk = Join-Path $startup "Attendify.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnk)
$shortcut.TargetPath = $cmd
$shortcut.Arguments = "background"
$shortcut.WorkingDirectory = $Root
$shortcut.WindowStyle = 7
$shortcut.Description = "Attendify on http://localhost:3000/"
$shortcut.Save()

Write-Host "Created startup shortcut: $lnk"
Write-Host "Attendify will start in the background when you sign in to Windows."
Write-Host "Remove the shortcut from Startup Apps to disable."
