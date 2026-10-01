@echo off
title KongGuLi Novel Generator Launcher

cd /d "%~dp0"

echo [1/3] Checking environment...
if not exist "%~dp0.venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv "%~dp0.venv"
    echo Installing backend dependencies...
    call "%~dp0.venv\Scripts\pip.exe" install -r "%~dp0backend\requirements.txt"
)

echo [2/3] Starting backend FastAPI service...
start "KongGuLi-Backend" /min cmd /c ""%~dp0.venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir "%~dp0backend" --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Starting frontend Vite interface...
start "KongGuLi-Frontend" /min cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Waiting for services to start (approx 3 seconds)...
ping 127.0.0.1 -n 4 >nul

echo Opening browser...
start http://localhost:5173

echo.
echo ========================================================
echo   KongGuLi Novel Generator is running!
echo   Frontend : http://localhost:5173
echo   Backend  : http://127.0.0.1:8000/docs
echo ========================================================
echo You can minimize this window.
pause