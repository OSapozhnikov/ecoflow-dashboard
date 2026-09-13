#!/bin/bash

# Script to run all tests with coverage using Docker Compose

set -e

echo "🚀 Starting test execution with coverage..."
echo ""

# Create coverage directories if they don't exist
mkdir -p server/coverage
mkdir -p client/coverage

# Run tests using docker-compose with tests profile
docker-compose -f docker-compose.dev.yml --profile tests up --build tests

echo ""
echo "✅ Tests completed!"
echo ""

# Extract coverage reports from container
echo "📊 Extracting coverage reports..."
CONTAINER_NAME="ecoflow-all-tests"

if docker ps -a --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
    # Create coverage directories
    mkdir -p server/coverage client/coverage
    
    # Copy coverage reports from container (copy contents, not directory)
    docker cp "${CONTAINER_NAME}:/app/server/coverage/." "./server/coverage/" 2>/dev/null || true
    docker cp "${CONTAINER_NAME}:/app/client/coverage/." "./client/coverage/" 2>/dev/null || true
    
    echo ""
    echo "📊 Coverage reports available at:"
    echo "   - server/coverage/index.html"
    echo "   - client/coverage/index.html"
    echo ""
    echo "To view coverage reports, open the HTML files in your browser."
else
    echo "⚠️  Container not found. Coverage reports may be in Docker volumes."
    echo "   Run: docker volume ls | grep coverage"
fi

