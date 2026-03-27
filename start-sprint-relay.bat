@echo off
setlocal enabledelayedexpansion
echo ==========================================
echo Starting Sprint Relay Debugger (Enhanced)
echo ==========================================
echo.

cd /d "%~dp0"

echo 1. Cleaning up existing environment...
REM Kill any process using port 3000 more aggressively
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo    - Terminating process PID %%a on port 3000...
    taskkill /F /PID %%a /T >nul 2>&1
)

REM Remove common cache directories
if exist ".next" (
    echo    - Clearing Next.js build cache...
    rmdir /s /q ".next" >nul 2>&1
)

if exist "node_modules\.cache" (
    echo    - Clearing node_modules component cache...
    rmdir /s /q "node_modules\.cache" >nul 2>&1
)

REM Optional: Flush DNS for clean local networking
ipconfig /flushdns >nul

echo.
echo 2. Starting Next.js dev server...
start "Sprint Relay Dev Server" cmd /k "npm run dev"

echo.
echo 3. Booting browser (Bypassing cache)...
echo    Waiting for server to initialize...
:wait_loop
timeout /t 2 /nobreak >nul
netstat -an | findstr :3000 | findstr LISTENING >nul
if errorlevel 1 (
    echo    - Still waiting for port 3000...
    goto wait_loop
)

echo    - Server is UP! Launching browser...
REM Launching in normal mode as requested (make sure to clear cache manually if issues persist!)
start chrome "http://localhost:3000"

echo.
echo ==========================================
echo System Operational.
echo ==========================================
timeout /t 5 >nul
exit
