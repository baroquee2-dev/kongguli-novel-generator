# PowerShell 一鍵啟動腳本
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   🚀 KongGuLi-孔固力自動小說生成器 啟動中..." -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

# 檢查虛擬環境
$VenvPython = Join-Path $ScriptDir ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "[1/3] 建立 Python 虛擬環境..." -ForegroundColor Gray
    python -m venv (Join-Path $ScriptDir ".venv")
    Write-Host "安裝後端依賴套件..." -ForegroundColor Gray
    & (Join-Path $ScriptDir ".venv\Scripts\pip.exe") install -r (Join-Path $ScriptDir "backend\requirements.txt")
}

# 啟動後端
Write-Host "[2/3] 正在啟動後端 FastAPI (Port 8000)..." -ForegroundColor Green
$backendProcess = Start-Process -FilePath $VenvPython -ArgumentList "-m uvicorn app.main:app --app-dir `"$ScriptDir\backend`" --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory $ScriptDir -WindowStyle Minimized -PassThru

# 啟動前端
Write-Host "[3/3] 正在啟動前端 Vite (Port 5173)..." -ForegroundColor Green
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory (Join-Path $ScriptDir "frontend") -WindowStyle Minimized -PassThru

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "✅ 服務已成功啟動！" -ForegroundColor Green
Write-Host "🌐 前端介面 : http://localhost:5173" -ForegroundColor White
Write-Host "⚙️ 後端 API  : http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
