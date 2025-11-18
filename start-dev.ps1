# Quick Start Script for Local Development
# Run this script to set up and start both frontend and backend

Write-Host "=== Call Center AI Insights - Quick Start ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env files exist
$backendEnv = Test-Path "backend\.env"
$frontendEnv = Test-Path "frontend\.env.local"

if (-not $backendEnv -or -not $frontendEnv) {
    Write-Host "⚠️  Environment files not found!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please create the following files from examples:" -ForegroundColor Yellow
    if (-not $backendEnv) {
        Write-Host "  - backend\.env (copy from backend\.env.example)" -ForegroundColor Yellow
    }
    if (-not $frontendEnv) {
        Write-Host "  - frontend\.env.local (copy from frontend\.env.example)" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "See SETUP-SSO.md for detailed configuration instructions." -ForegroundColor Yellow
    exit 1
}

# Backend setup
Write-Host "📦 Setting up backend..." -ForegroundColor Green
Push-Location backend

# Check if venv exists
if (-not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    python -m venv venv
}

# Activate venv and install dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

Pop-Location

# Frontend setup
Write-Host ""
Write-Host "📦 Setting up frontend..." -ForegroundColor Green
Push-Location frontend

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    npm install
}

Pop-Location

# Start services
Write-Host ""
Write-Host "🚀 Starting services..." -ForegroundColor Green
Write-Host ""
Write-Host "Backend will run on: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend will run on: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Start backend in background
$backendPath = Join-Path $PWD "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; & '.\venv\Scripts\python.exe' -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start frontend
Push-Location frontend
npm run dev
Pop-Location
