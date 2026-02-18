@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
set "PORTABLE_NODE=%REPO_ROOT%\runtime\node\node.exe"

if exist "%PORTABLE_NODE%" (
  "%PORTABLE_NODE%" "%SCRIPT_DIR%pcoder.cjs" %*
  exit /b %errorlevel%
)

where node >nul 2>nul
if %errorlevel% equ 0 (
  node "%SCRIPT_DIR%pcoder.cjs" %*
  exit /b %errorlevel%
)

echo Error: node not found. Bundle runtime\node or install node in PATH.
exit /b 1
