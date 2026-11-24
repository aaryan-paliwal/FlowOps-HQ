#!/usr/bin/env pwsh
# benchmarks/run_benchmark.ps1
# Full end-to-end benchmark: boots infra, seeds, runs measure_latency.js
# Usage: .\benchmarks\run_benchmark.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== FlowOps Latency Benchmark Runner ===" -ForegroundColor Cyan

# 1. Start only Postgres + Redis (no backend container, we run it locally for low overhead)
Write-Host "`n[1/6] Starting Postgres + Redis via docker compose..." -ForegroundColor Yellow
docker compose up -d postgres redis
Write-Host "Waiting for services to be healthy..."
Start-Sleep -Seconds 10

# Verify health
docker compose ps

# 2. Push schema to Postgres
Write-Host "`n[2/6] Pushing Drizzle schema..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://flowops:flowops_secret@localhost:5432/flowops_db"
$env:JWT_SECRET   = "benchmark-jwt-secret-do-not-use-in-prod"
$env:REDIS_URL    = "redis://localhost:6379"
$env:NODE_ENV     = "development"

Set-Location backend
npx drizzle-kit push --force 2>&1
Set-Location ..

# 3. Seed benchmark API key
Write-Host "`n[3/6] Seeding benchmark API key..." -ForegroundColor Yellow
$benchKey = (node benchmarks/seed_bench_key.js 2>&1) | Select-Object -Last 1
Write-Host "Key: $($benchKey.Substring(0, 20))..."

# 4. Start backend locally
Write-Host "`n[4/6] Starting FlowOps backend on :5000..." -ForegroundColor Yellow
$env:GEMINI_API_KEY   = $env:GEMINI_API_KEY   # Must be set in your shell
$env:OPENAI_API_KEY   = $env:OPENAI_API_KEY   # Optional
$env:ANTHROPIC_API_KEY = $env:ANTHROPIC_API_KEY # Optional

$backend = Start-Process -FilePath "node" -ArgumentList "backend/src/server.js" -PassThru -NoNewWindow
Start-Sleep -Seconds 5

# 5. Run benchmark
Write-Host "`n[5/6] Running latency benchmark (N=30)..." -ForegroundColor Yellow
$env:FLOWOPS_URL = "http://localhost:5000/v1/chat/completions"
$env:FLOWOPS_KEY = $benchKey
$env:MODEL       = "gemini-1.5-flash"
$env:N           = "30"

node benchmarks/measure_latency.js | Tee-Object -FilePath benchmarks/latency_run.txt

# 6. Cleanup
Write-Host "`n[6/6] Cleaning up..." -ForegroundColor Yellow
Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
docker compose down

Write-Host "`n=== Benchmark complete! Results saved to benchmarks/latency_run.txt ===" -ForegroundColor Green

