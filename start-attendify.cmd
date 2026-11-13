@echo off
cd /d "%~dp0"
if /I "%~1"=="background" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\attendify-start-background.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\attendify-serve.ps1"
)
