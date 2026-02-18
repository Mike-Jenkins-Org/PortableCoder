@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%..\..\.."
set "STATE_DIR=%REPO_ROOT%\state\vm"
set "VM_PID=%STATE_DIR%\qemu.pid"
set "VM_MODE=%STATE_DIR%\qemu-mode.txt"
set "VM_SSH_PORT=%STATE_DIR%\ssh-port.txt"

if not exist "%VM_PID%" (
  echo No pid file found. If VM is running, stop it manually from Task Manager.
  del /f /q "%VM_MODE%" >nul 2>nul
  del /f /q "%VM_SSH_PORT%" >nul 2>nul
  exit /b 0
)

for /f "usebackq delims=" %%p in ("%VM_PID%") do (
  taskkill /PID %%p /T /F >nul 2>nul
  echo VM stop requested for PID %%p.
)

del /f /q "%VM_PID%" >nul 2>nul
del /f /q "%VM_MODE%" >nul 2>nul
del /f /q "%VM_SSH_PORT%" >nul 2>nul
exit /b 0
