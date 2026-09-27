Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting Talk AI Decision Assistant (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "backend"
$frontendDir = Join-Path $PSScriptRoot "frontend"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; npm run dev"

Write-Host "Dev servers launched!" -ForegroundColor Green
Write-Host "Backend:  http://127.0.0.1:8001" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5190" -ForegroundColor Yellow
