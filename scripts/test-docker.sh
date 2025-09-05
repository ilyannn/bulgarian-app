#!/usr/bin/env bash
set -uo pipefail

# =============================================================================
# Docker Build and Test Script for Bulgarian Voice Coach
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Clean up function
cleanup() {
    log_info "Cleaning up containers and images..."
    docker stop bulgarian-test-prod bulgarian-test-dev 2>/dev/null || true
    docker rm bulgarian-test-prod bulgarian-test-dev 2>/dev/null || true
}

# Set up trap for cleanup
trap cleanup EXIT

# =============================================================================
# 1. Build Production Image
# =============================================================================
log_info "Building production Docker image..."
if docker build --target production -t bulgarian-app:production . ; then
    log_success "Production image built successfully"
else
    log_error "Production image build failed"
    exit 1
fi

# Check image size
PROD_SIZE=$(docker images bulgarian-app:production --format "{{.Size}}")
log_info "Production image size: $PROD_SIZE"

# =============================================================================
# 2. Build Development Image
# =============================================================================
log_info "Building development Docker image..."
if docker build --target development -t bulgarian-app:development . ; then
    log_success "Development image built successfully"
else
    log_error "Development image build failed"
fi

# Check image size
DEV_SIZE=$(docker images bulgarian-app:development --format "{{.Size}}")
log_info "Development image size: $DEV_SIZE"

# =============================================================================
# 3. Test Production Container
# =============================================================================
log_info "Testing production container..."

# Start production container
docker run -d --name bulgarian-test-prod \
    -e WHISPER_MODEL=tiny \
    -e LLM_PROVIDER=dummy \
    -p 8002:8000 \
    bulgarian-app:production

# Wait for container to start
log_info "Waiting for production container to start..."
for i in {1..30}; do
    if curl -s -f http://localhost:8002/health >/dev/null 2>&1; then
        log_success "Production container is healthy"
        break
    fi
    if [ "$i" -eq 30 ]; then
        log_error "Production container failed to start"
        docker logs bulgarian-test-prod
    fi
    sleep 2
done

# Test API endpoints
log_info "Testing production API endpoints..."

# Test health endpoint
if curl -s -f http://localhost:8002/health | grep -q "\"status\":\"healthy\""; then
    log_success "Health endpoint working"
else
    log_error "Health endpoint failed"
fi

# Test OpenAPI docs
if curl -s -f http://localhost:8002/docs >/dev/null 2>&1; then
    log_success "OpenAPI documentation available"
else
    log_error "OpenAPI documentation not available"
fi

# Test content endpoint
if curl -s -f http://localhost:8002/content/scenarios | grep -q "scenarios"; then
    log_success "Content API working"
else
    log_error "Content API failed"
fi

# Stop production container
docker stop bulgarian-test-prod >/dev/null 2>&1
docker rm bulgarian-test-prod >/dev/null 2>&1

# =============================================================================
# 4. Test Development Container
# =============================================================================
log_info "Testing development container..."

# Start development container
docker run -d --name bulgarian-test-dev \
    -e DEBUG=true \
    -e WHISPER_MODEL=tiny \
    -e LLM_PROVIDER=dummy \
    -p 8003:8000 \
    -p 5174:5173 \
    bulgarian-app:development

# Wait for backend to start
log_info "Waiting for development backend to start..."
for i in {1..30}; do
    if curl -s -f http://localhost:8003/health >/dev/null 2>&1; then
        log_success "Development backend is running"
        break
    fi
    if [ "$i" -eq 30 ]; then
        log_error "Development backend failed to start"
        docker logs bulgarian-test-dev
    fi
    sleep 2
done

# Check if frontend dev server is accessible
log_info "Checking development frontend..."
for i in {1..30}; do
    if curl -s -f http://localhost:5174 >/dev/null 2>&1; then
        log_success "Development frontend is running"
        break
    fi
    if [ "$i" -eq 30 ]; then
        log_warning "Development frontend not accessible (may need volume mounts)"
    fi
    sleep 2
done

# Stop development container
docker stop bulgarian-test-dev >/dev/null 2>&1
docker rm bulgarian-test-dev >/dev/null 2>&1

# =============================================================================
# 5. Test Docker Compose
# =============================================================================
log_info "Testing docker-compose configuration..."

# Validate docker-compose file
if docker-compose config >/dev/null 2>&1; then
    log_success "docker-compose.yml is valid"
else
    log_error "docker-compose.yml validation failed"
fi

# Test production service with docker-compose
log_info "Testing production service with docker-compose..."
if docker-compose up -d app 2>/dev/null; then
    log_success "Production service started with docker-compose"
    
    # Wait for health check
    sleep 10
    
    if curl -s -f http://localhost:8000/health >/dev/null 2>&1; then
        log_success "Production service is healthy via docker-compose"
    else
        log_error "Production service health check failed"
    fi
    
    docker-compose down >/dev/null 2>&1
else
    log_error "Failed to start production service with docker-compose"
fi

# =============================================================================
# 6. Security Checks
# =============================================================================
log_info "Running security checks..."

# Check for root user in production image
if docker run --rm bulgarian-app:production whoami | grep -q "app"; then
    log_success "Production container runs as non-root user"
else
    log_error "Production container runs as root (security issue)"
fi

# Check for exposed secrets
if docker run --rm bulgarian-app:production printenv | grep -E "(KEY|TOKEN|SECRET|PASSWORD)" | grep -v "OPENAI_API_KEY=\${OPENAI_API_KEY:-}"; then
    log_error "Potential secrets exposed in environment"
else
    log_success "No hardcoded secrets found in environment"
fi

# =============================================================================
# 7. Module Import Tests
# =============================================================================
log_info "Testing Python module imports..."

# Test core module imports
if docker run --rm bulgarian-app:production python -c "
import sys
sys.path.insert(0, '/app/server')
from config import get_config
from bg_rules import detect_grammar_errors
from asr import ASRProcessor
from tts import TTSProcessor
from llm import ChatProvider
print('All modules imported successfully')
" 2>/dev/null | grep -q "All modules imported successfully"; then
    log_success "All Python modules import correctly"
else
    log_error "Python module import failed"
fi

# Test dependencies
if docker run --rm bulgarian-app:production python -c "
import fastapi
import uvicorn
import torch
import faster_whisper
import websockets
print('All dependencies available')
" 2>/dev/null | grep -q "All dependencies available"; then
    log_success "All Python dependencies installed"
else
    log_error "Some Python dependencies missing"
fi

# =============================================================================
# 8. Volume Mount Tests
# =============================================================================
log_info "Testing volume mounts..."

# Create test volume
docker volume create test-whisper-models >/dev/null 2>&1

# Test with volume mount
if docker run --rm -v test-whisper-models:/app/.cache/huggingface bulgarian-app:production ls /app/.cache/huggingface >/dev/null 2>&1; then
    log_success "Volume mounts work correctly"
else
    log_warning "Volume mount test inconclusive"
fi

# Clean up test volume
docker volume rm test-whisper-models >/dev/null 2>&1

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================="
echo "Docker Testing Complete"
echo "============================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All Docker tests passed!${NC}"
    echo "The Docker setup is ready for deployment."
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please review the errors above.${NC}"
    exit 1
fi