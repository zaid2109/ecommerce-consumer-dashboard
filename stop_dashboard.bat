@echo off
echo ========================================
echo    Stopping E-Commerce Dashboard
echo ========================================
echo.

echo Stopping backend server (port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do (
    echo Killing process %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo Stopping frontend server (ports 3000-3005)...
for /l %%p in (3000,1,3005) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| find ":%%p" ^| find "LISTENING"') do (
        echo Killing process %%a on port %%p...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo Stopping Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

echo Stopping Python processes...
taskkill /F /IM python.exe >nul 2>&1

echo.
echo ========================================
echo    Dashboard Stopped Successfully!
echo ========================================
echo.
echo All services have been stopped.
echo Press any key to close this window...
pause >nul
