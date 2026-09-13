# PowerShell script to run all tests with coverage using Docker Compose

Write-Host "🚀 Starting test execution with coverage..." -ForegroundColor Green
Write-Host ""

# Create coverage directories if they don't exist
if (-not (Test-Path "server/coverage")) {
    New-Item -ItemType Directory -Path "server/coverage" | Out-Null
}
if (-not (Test-Path "client/coverage")) {
    New-Item -ItemType Directory -Path "client/coverage" | Out-Null
}

# Run tests using docker-compose with tests profile
docker-compose -f docker-compose.dev.yml --profile tests up --build tests

Write-Host ""
Write-Host "✅ Tests completed!" -ForegroundColor Green
Write-Host ""

# Extract coverage reports from container
Write-Host "📊 Extracting coverage reports..." -ForegroundColor Cyan
$containerName = "ecoflow-all-tests"

if (docker ps -a --filter "name=$containerName" --format "{{.Names}}" | Select-String -Pattern $containerName) {
    # Create coverage directories
    New-Item -ItemType Directory -Force -Path "server/coverage" | Out-Null
    New-Item -ItemType Directory -Force -Path "client/coverage" | Out-Null
    
    # Copy coverage reports from container (copy contents, not directory)
    docker cp "${containerName}:/app/server/coverage/." "./server/coverage/" 2>$null
    docker cp "${containerName}:/app/client/coverage/." "./client/coverage/" 2>$null
    
    Write-Host ""
    Write-Host "📊 Coverage reports available at:" -ForegroundColor Cyan
    Write-Host "   - server/coverage/index.html"
    Write-Host "   - client/coverage/index.html"
    Write-Host ""
    Write-Host 'To view coverage reports, open the HTML files in your browser.' -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Container not found. Coverage reports may be in Docker volumes." -ForegroundColor Yellow
    Write-Host "   Run: docker volume ls | grep coverage" -ForegroundColor Gray
}

