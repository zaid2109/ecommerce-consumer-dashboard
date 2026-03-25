@echo off
echo Starting Dashboard Aggregator System...
echo.
echo ========================================
echo 🚀 E-Commerce Analytics Dashboard v2.0
echo ========================================
echo ✅ Features:
echo    • Dynamic dashboard aggregator
echo    • Independent module execution
echo    • Fault-tolerant design
echo    • Real-time data processing
echo    • SaaS-level UI/UX
echo.
echo 🌐 Backend: http://localhost:8000
echo 📱 Frontend: http://localhost:3000/en/dashboard-aggregator
echo.
echo Starting backend server...
cd /d "%~dp0"backend"
python main_dashboard.py
echo.
echo Backend started! Opening dashboard...
timeout /t 3
start http://localhost:3000/en/dashboard-aggregator
echo.
echo Dashboard aggregator is running!
echo Press Ctrl+C to stop
pause
