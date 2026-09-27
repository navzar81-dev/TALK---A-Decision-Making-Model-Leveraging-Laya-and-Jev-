@echo off
echo ========================================================
echo Starting Talk AI Decision Assistant (Backend + Frontend)
echo ========================================================

start "Talk - Backend (FastAPI on Port 8001)" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"
start "Talk - Frontend (Vite on Port 5190)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Dev servers launched in separate windows!
echo Backend:  http://127.0.0.1:8001
echo Frontend: http://localhost:5190
