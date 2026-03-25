@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    E-Commerce Dashboard Launcher
echo ========================================
echo.

REM === 1) Set project paths ===
set "PROJECT_DIR=C:\Users\mohdz\Desktop\E-Commerce Consumer  Dashboard\Ecommerce consumer behaviour dashboard"
set "FRONTEND_DIR=%PROJECT_DIR%"
set "BACKEND_DIR=%PROJECT_DIR%\backend"

REM Check if project directory exists
if not exist "%PROJECT_DIR%" (
    echo ERROR: Project directory not found: %PROJECT_DIR%
    pause
    exit /b 1
)

echo Project directory: %PROJECT_DIR%
echo.

REM === 2) Install frontend dependencies if needed ===
echo [1/4] Checking frontend dependencies...
cd /d "%FRONTEND_DIR%"
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo ERROR: Failed to install frontend dependencies
        pause
        exit /b 1
    )
) else (
    echo Frontend dependencies already installed
)

REM === 3) Install backend dependencies if needed ===
echo [2/4] Checking backend dependencies...
cd /d "%BACKEND_DIR%"
if exist ".venv\Scripts\activate.bat" (
    echo Using virtual environment...
    call .venv\Scripts\activate.bat
    echo Installing backend dependencies...
    pip install -r requirements.txt 2>nul
    if !errorlevel! neq 0 (
        echo Installing individual backend packages...
        pip install duckdb python-jose[cryptography] slowapi pydantic-settings fastapi uvicorn >nul 2>&1
    )
) else (
    echo No virtual environment found, using system Python...
    echo Installing backend dependencies...
    pip install duckdb python-jose[cryptography] slowapi pydantic-settings fastapi uvicorn >nul 2>&1
)

REM === 4) Start backend server in its own window ===
echo [3/4] Starting backend server...
set "BACKEND_CMD=python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
if exist ".venv\Scripts\activate.bat" (
    start "Backend Server" cmd /k "cd /d "%BACKEND_DIR%" && call .venv\Scripts\activate.bat && %BACKEND_CMD%"
) else (
    start "Backend Server" cmd /k "cd /d "%BACKEND_DIR%" && %BACKEND_CMD%"
)

REM === 5) Start frontend in its own window ===
echo [4/4] Starting frontend server...
cd /d "%FRONTEND_DIR%"
start "Ecommerce Frontend" cmd /k "npm run dev"

REM === 6) Wait for services to start, then open dashboard ===
echo.
echo Waiting for services to start...
timeout /t 15 /nobreak >nul

echo Opening dashboard in browser...
start "" "http://localhost:3000"

echo.
echo ========================================
echo    Dashboard Started Successfully!
echo ========================================
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo.
echo Press any key to close this window...
pause >nul

endlocal
