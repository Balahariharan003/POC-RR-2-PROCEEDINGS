<#
.SYNOPSIS
    Automated All-in-One Setup Script for Tamil Nadu Revenue Recovery Proceedings System v2.0
.DESCRIPTION
    Checks prerequisites (Python, Node.js, PostgreSQL, Ollama), sets up virtual environment,
    installs Python and Node dependencies, synchronizes and migrates the database schema,
    executes seeders for accounts, official government templates, and office configurations,
    and validates Ollama LLM connectivity.
.EXAMPLE
    .\setup.ps1
#>

param(
    [switch]$SkipDbCreate = $false,
    [switch]$StartServers = $false
)

$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot
$BackendDir = Join-Path $ScriptRoot "Backend"
$FrontendDir = Join-Path $ScriptRoot "Frontend"

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host " Tamil Nadu Revenue Recovery (RR) Proceedings Drafting System - Automated Setup" -ForegroundColor Yellow
Write-Host " Erode Collectorate | Section E2" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

function Write-Step {
    param([string]$Text)
    Write-Host "[STEP] $Text" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Text)
    Write-Host "[WARN] $Text" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "[SUCCESS] $Text" -ForegroundColor Cyan
}

function Write-Fail {
    param([string]$Text)
    Write-Host "[ERROR] $Text" -ForegroundColor Red
}

# -----------------------------------------------------------------------------
# 1. PREREQUISITE CHECKS
# -----------------------------------------------------------------------------
Write-Step "1/7: Verifying System Prerequisites..."

# Check Python
$PythonCmd = $null
if (Get-Command "py" -ErrorAction SilentlyContinue) {
    $PythonCmd = "py"
}
elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
    $PythonCmd = "python"
}
else {
    Write-Fail "Python 3.10+ is required but not found in PATH. Please install Python."
    exit 1
}
$PyVersion = & $PythonCmd --version
Write-Host "  Found Python: $PyVersion ($PythonCmd)" -ForegroundColor Gray

# Check Node.js & npm
if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js (npm) is required for the Frontend but not found in PATH."
    exit 1
}
$NodeVersion = & node --version
$NpmVersion = & npm --version
Write-Host "  Found Node.js: $NodeVersion (npm: $NpmVersion)" -ForegroundColor Gray

# -----------------------------------------------------------------------------
# 2. ENVIRONMENT FILE CONFIGURATION
# -----------------------------------------------------------------------------
Write-Step "2/7: Checking Environment Configuration (.env)..."

$RootEnv = Join-Path $ScriptRoot ".env"
$RootEnvExample = Join-Path $ScriptRoot ".env.example"
$BackendEnv = Join-Path $BackendDir ".env"

if (-not (Test-Path $RootEnv)) {
    if (Test-Path $RootEnvExample) {
        Copy-Item $RootEnvExample $RootEnv
        Write-Host "  Created .env from .env.example" -ForegroundColor Gray
    }
    else {
        Write-Warn ".env.example not found in root. Using defaults."
    }
}

# Ensure Backend/.env is synchronized with root .env
if (Test-Path $RootEnv) {
    Copy-Item $RootEnv $BackendEnv -Force
    Write-Host "  Synchronized Backend/.env with root .env" -ForegroundColor Gray
}

# -----------------------------------------------------------------------------
# 3. PYTHON VIRTUAL ENVIRONMENT & DEPENDENCIES
# -----------------------------------------------------------------------------
Write-Step "3/7: Setting up Python Virtual Environment (Backend/.venv)..."

$VenvDir = Join-Path $BackendDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "  Creating virtual environment at $VenvDir..." -ForegroundColor Gray
    Set-Location $BackendDir
    & $PythonCmd -m venv .venv
    Set-Location $ScriptRoot
}

if (-not (Test-Path $VenvPython)) {
    Write-Fail "Failed to initialize virtual environment."
    exit 1
}

Write-Host "  Virtual environment ready: $VenvPython" -ForegroundColor Gray

Write-Step "4/7: Installing Python Backend Dependencies..."
Set-Location $BackendDir
& $VenvPython -m pip install --upgrade pip --quiet
& $VenvPip install -r (Join-Path $BackendDir "requirements.txt") --quiet
Set-Location $ScriptRoot
Write-Success "Python dependencies installed successfully."

# -----------------------------------------------------------------------------
# 4. DATABASE INITIALIZATION, SCHEMA MIGRATION & SEEDING
# -----------------------------------------------------------------------------
Write-Step "5/7: Synchronizing Database Schema and Seeding Official Records..."

$InitScript = @"
import asyncio
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath('Backend'))

from Backend.app.core.database import engine, Base, ensure_db_schema_migrated, AsyncSessionLocal
from Backend.app.core.seed import seed_default_accounts, seed_default_templates

async def main():
    print('  [DB] Connecting to PostgreSQL database...')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('  [DB] Base tables synchronized.')
    
    await ensure_db_schema_migrated()
    print('  [DB] Schema migrations and constraints applied.')

    async with AsyncSessionLocal() as session:
        print('  [SEED] Seeding administrator and officer accounts...')
        await seed_default_accounts(session)
        print('  [SEED] Seeding official locked templates and Erode Collectorate config...')
        await seed_default_templates(session)

    print('  [DB] Database initialization and seeding completed successfully.')

if __name__ == '__main__':
    asyncio.run(main())
"@

$InitScriptPath = Join-Path $BackendDir "scratch_db_init.py"
$InitScript | Out-File -FilePath $InitScriptPath -Encoding utf8

try {
    & $VenvPython $InitScriptPath
}
catch {
    Write-Warn "Database auto-sync encountered an issue: $_. Verify PostgreSQL is running on port 5432."
}
finally {
    if (Test-Path $InitScriptPath) {
        Remove-Item $InitScriptPath -Force -ErrorAction SilentlyContinue
    }
}

# -----------------------------------------------------------------------------
# 5. FRONTEND DEPENDENCIES
# -----------------------------------------------------------------------------
Write-Step "6/7: Installing Frontend Dependencies..."
Set-Location $FrontendDir
& npm install --loglevel=error
Set-Location $ScriptRoot
Write-Success "Frontend packages installed."

# -----------------------------------------------------------------------------
# 6. OLLAMA CONNECTIVITY & MODEL CHECK
# -----------------------------------------------------------------------------
Write-Step "7/7: Checking Local Ollama Engine & Model..."

try {
    $OllamaCheck = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($OllamaCheck -and $OllamaCheck.models) {
        $ModelNames = $OllamaCheck.models | ForEach-Object { $_.name }
        Write-Host "  Ollama is running. Available models: $($ModelNames -join ', ')" -ForegroundColor Gray
        
        if ($ModelNames -contains "qwen2.5:3b-instruct-q4_K_M" -or $ModelNames -contains "qwen2.5:3b-instruct") {
            Write-Success "Recommended model (qwen2.5:3b-instruct) is installed and ready."
        }
        else {
            Write-Warn "Model 'qwen2.5:3b-instruct-q4_K_M' not found in Ollama. Pull it using: ollama run qwen2.5:3b-instruct"
        }
    }
}
catch {
    Write-Warn "Ollama server not detected at http://127.0.0.1:11434. Make sure Ollama is started if using local LLM inference."
}

# -----------------------------------------------------------------------------
# SETUP COMPLETE SUMMARY
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host " SETUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " User Authentication & Role Management:" -ForegroundColor Yellow
Write-Host "   All users, roles, and password hashes are retrieved and authenticated" -ForegroundColor Gray
Write-Host "   strictly from the PostgreSQL Database ('users' table)." -ForegroundColor Gray
Write-Host "   Manage or create new officers dynamically via the Admin Workspace UI." -ForegroundColor Gray
Write-Host ""
Write-Host " How to run the application:" -ForegroundColor Cyan
Write-Host "   Terminal 1 (Backend API):" -ForegroundColor White
Write-Host "     cd Backend" -ForegroundColor Gray
Write-Host "     .\.venv\Scripts\uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "   Terminal 2 (Frontend UI):" -ForegroundColor White
Write-Host "     cd Frontend" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host " Access URLs:" -ForegroundColor Cyan
Write-Host "   Frontend Application: http://localhost:5173" -ForegroundColor White
Write-Host "   Swagger API Docs:     http://localhost:8000/docs" -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
