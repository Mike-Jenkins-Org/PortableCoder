@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "PATCH_PS1=%SCRIPT_DIR%apply-start-vm-port-fix.ps1"

if not exist "%PATCH_PS1%" (
  echo Error: missing patch script: %PATCH_PS1%
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PATCH_PS1%"
exit /b %errorlevel%

