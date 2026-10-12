@echo off
echo Stopping any existing backend processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo Starting ContriGraph backend...
cd /d "%~dp0backend"
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --reload-dir app
