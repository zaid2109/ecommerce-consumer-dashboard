@echo off
setlocal

cd /d "%~dp0"

if not exist "package.json" (
  echo [ERROR] package.json not found. Run this file from the project root.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Installing dependencies...
  call npm install --legacy-peer-deps
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Starting dashboard...
start "EcoDash Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev"

timeout /t 4 /nobreak >nul
start "" "http://localhost:3000/dashboard"

echo [INFO] Dashboard launched.
exit /b 0
