@echo off
title RailTrack Monitor Launcher
echo ===================================================
echo              RAILTRACK MONITOR SYSTEM
echo ===================================================
echo.
echo [1/2] Launching Backend Server (Port 5000)...
start "RailTrack Monitor Backend" cmd /k "cd backend && npm start"

echo [2/2] Launching Frontend Development Server (Port 5173)...
start "RailTrack Monitor Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo  Both servers have been launched in separate windows!
echo.
echo  - Frontend Web UI: http://localhost:5173
echo  - Backend API:      http://localhost:5000
echo ===================================================
echo.
echo Press any key to close this launcher shell (servers will keep running).
pause > nul
