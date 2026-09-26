# =============================================================================
# Smart Building Cloud Platform - 1-Click Demo Launcher
# =============================================================================
param(
    [switch]$ResetData
)

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  SMART BUILDING CLOUD PLATFORM - LIVE DEMO LAUNCHER  " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$RootPath = $PSScriptRoot
$BackendPath = Join-Path $RootPath "backend"
$FrontendPath = Join-Path $RootPath "frontend"

# 1. Check PostgreSQL connection & seed data
Write-Host ""
Write-Host "[1/3] Checking demo data in PostgreSQL..." -ForegroundColor Yellow
$PythonExe = Join-Path $BackendPath ".venv\Scripts\python.exe"
$SeedScript = Join-Path $BackendPath "scripts\seed_demo_data.py"

$SeedArgs = @()
$BackendEnv = Join-Path $BackendPath ".env"
$UsesIam = (Test-Path $BackendEnv) -and [bool](Select-String -Path $BackendEnv -Pattern '^POSTGRES_AUTH_MODE=iam\s*$' -Quiet)
if ($UsesIam -and $ResetData) {
    throw "-ResetData is disabled while the backend is configured for RDS IAM authentication."
}
if ($ResetData) {
    Write-Host ">>> Flag -ResetData detected: Wiping and re-seeding database..." -ForegroundColor Magenta
    $SeedArgs += "--force"
}

if ($UsesIam) {
    Write-Host "RDS IAM mode: using the migrated data without reseeding." -ForegroundColor Green
} elseif (Test-Path $PythonExe) {
    & $PythonExe $SeedScript $SeedArgs
} else {
    Write-Host "Warning: Virtual environment not found at $PythonExe. Using global python." -ForegroundColor Red
    python $SeedScript $SeedArgs
}

# 2. Start Backend in new window
Write-Host ""
Write-Host "[2/3] Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
$BackendCmd = "cd `"$BackendPath`"; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCmd

Start-Sleep -Seconds 2

# 3. Start Frontend in new window
Write-Host ""
Write-Host "[3/3] Starting React Vite Frontend on http://localhost:5173..." -ForegroundColor Yellow
$FrontendCmd = "cd `"$FrontendPath`"; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCmd

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  DEMO IS READY!" -ForegroundColor Green
Write-Host "  - React Dashboard: http://localhost:5173" -ForegroundColor White
Write-Host "  - FastAPI Swagger: http://localhost:8000/docs" -ForegroundColor White
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""

# Open browser
Start-Process "http://localhost:5173"
