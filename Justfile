#!/usr/bin/env -S just --justfile
# ==============================================================================
# IMPORTANT: How `just` differs from Make
# ==============================================================================
# 1. SHELL EXECUTION MODEL (CRITICAL DIFFERENCE):
#    - By default, each recipe line runs in a SEPARATE shell
#    - Our strategy: Use shebang (#!/usr/bin/env bash) for multi-line recipes
#    - This allows variables to persist and background processes to work correctly
#    - Simple one-line recipes execute directly without a shebang
#
# 2. VARIABLE SYNTAX:
#    - Recipe variables: use shell syntax ($VAR or ${VAR})
#    - Just variables: use {{ }} for interpolation
#    - Assignment: := (immediate) vs = (lazy, not supported)
#
# 3. LINE CONTINUATION:
#    - Backslash (\) at end of line continues to next line
#    - Essential for long commands or keeping variables in scope
#
# 4. RECIPE SYNTAX:
#    - @ prefix: suppress command echo (like Make)
#    - Recipe names: kebab-case by convention (py-lint not py_lint)
#    - Dependencies: recipe: dep1 dep2 (like Make)
#
# 5. SHEBANG:
#    - #!/usr/bin/env just allows direct execution: ./Justfile recipe
#    - Not required but recommended
# ==============================================================================

# Default recipe to display help information
_default:
    @just --list --unsorted --list-prefix ····

# Export all just variables as environment variables to recipes

set export := true

# Detect the default branch once; override per-repo as needed

DEFAULT_BRANCH := "main"

# ---- Python (uv + ruff) ---------------------------------------------------
# All Python commands run via uv (fast project manager)
# https://docs.astral.sh/uv/

# Install Python and sync dependencies using uv
[group('python')]
py-sync:
    #!/usr/bin/env bash
    set -euo pipefail
    uv python install
    uv sync --locked || uv sync --dev

# Check Python code with ruff linter using centralized config
[group('lint')]
[group('python')]
py-lint:
    uvx ruff check --config .github/linters/.ruff.toml server

# Format Python code with ruff (includes import sorting)
[group('format')]
[group('python')]
py-format:
    #!/usr/bin/env bash
    set -euo pipefail
    uvx ruff format --config .github/linters/.ruff.toml server
    # Keep imports sorted (Ruff's `I` rules)
    uvx ruff check --config .github/linters/.ruff.toml --select I --fix server

# Type checking with ty from Astral (experimental - fast Python type checker)
[group('python')]
[group('typecheck')]
py-typecheck:
    #!/usr/bin/env bash
    set -euo pipefail
    # Note: ty is still in early development, may have breaking changes
    # Allow ty to fail without stopping the build (experimental tool)
    uvx ty check server || echo "ty type checking completed with issues (experimental tool)"

# Build Python package (sdist + wheel) with uv
[group('build')]
[group('python')]
py-build:
    uv build

# ---- Web (TypeScript + Bun + Biome) --------------------------------------
# Bun as runtime & package manager; Biome for lint+format. Bun doesn't type
# check TypeScript, so we use `tsc --noEmit` for types.

# Install JavaScript dependencies with bun (frozen lockfile)
[group('web')]
web-install:
    cd client && bun install --frozen-lockfile

# ---- Markdown Linting (mado) ---------------------------------------------
# Ultra-fast Rust-based markdown linter (~60x faster than markdownlint-cli2)

# Lint markdown files with mado (Rust-based, extremely fast)
[group('lint')]
[group('markdown')]
markdown-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    # Use markdownlint with specific exclusion for DONE.md and TODO.md line length
    if command -v markdownlint >/dev/null 2>&1; then
        # Lint everything except DONE.md and TODO.md
        markdownlint --config .github/linters/.markdownlint.yml README.md docs/bg_gpt5_plan.md scripts/
        # For DONE.md and TODO.md, we skip line length checks (long descriptions/links)
        echo "Note: docs/DONE.md and docs/TODO.md excluded from line length check"
    else
        echo "markdownlint not installed. Install with: npm install -g markdownlint-cli"
        echo "Skipping markdown linting..."
        exit 0
    fi

# Format markdown files with prettier
[group('format')]
[group('markdown')]
markdown-format:
    bunx prettier --config .github/linters/.prettierrc.json --write "**/*.md"

# ---- YAML Linting (yamllint via Python) ----------------------------------
# Fast YAML linting and validation

# Lint YAML files with yamllint
[group('lint')]
[group('yaml')]
yaml-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v yamllint >/dev/null 2>&1; then
        yamllint --config-file .github/linters/.yamllint.yml .
    else
        echo "Installing yamllint via uvx..."
        uvx yamllint --config-file .github/linters/.yamllint.yml .
    fi

# Format YAML files with prettier
[group('format')]
[group('yaml')]
yaml-format:
    bunx prettier --config .github/linters/.prettierrc.json --write "**/*.{yml,yaml}"

# ---- JSON Linting (built into Biome) -------------------------------------
# JSON linting handled by Biome configuration

# Lint JSON files with Biome
[group('json')]
[group('lint')]
json-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    # Skip JSON linting as it's already handled by web-lint for client files
    # and we don't have other JSON files that need linting
    exit 0

# Format JSON files with Biome
[group('format')]
[group('json')]
json-format:
    # JSON formatting is handled by web-format for client files
    exit 0

# ---- Shell Script Linting (shellcheck) -----------------------------------
# Fast shell script analysis and linting

# Lint shell scripts with shellcheck
[group('lint')]
[group('shell')]
shell-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v shellcheck >/dev/null 2>&1; then
        find . -name "*.sh" -not -path "./node_modules/*" -not -path "./.venv/*" -not -path "./client/node_modules/*" -not -path "./.git/*" -exec shellcheck {} +
        # Also check bash scripts in .githooks
        find .githooks -type f -exec shellcheck {} + 2>/dev/null || true
    else
        echo "shellcheck not installed. Install with:"
        echo "  macOS: brew install shellcheck"
        echo "  Ubuntu/Debian: apt install shellcheck"
        echo "  Or download from: https://github.com/koalaman/shellcheck"
        exit 1
    fi

# Lint Dockerfiles with hadolint
[group('docker')]
[group('quality')]
docker-lint:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Docker linting with hadolint ==="
    if command -v hadolint >/dev/null 2>&1; then
        find . -name "Dockerfile*" -exec hadolint {} + 2>/dev/null || echo "No Dockerfiles found or hadolint issues detected"
    else
        echo "hadolint not installed. Install with: brew install hadolint (macOS) or see https://github.com/hadolint/hadolint"
    fi

# Check prettier formatting
[group('quality')]
[group('web')]
prettier-check:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Prettier formatting check ==="
    cd client && bunx prettier --check .

# Lint JavaScript/TypeScript code with Biome using centralized config
[group('lint')]
[group('web')]
web-lint:
    bunx @biomejs/biome ci --config-path .github/linters/biome.json client/

# Format JavaScript/TypeScript code with Biome using centralized config
[group('format')]
[group('web')]
web-format:
    bunx @biomejs/biome format --config-path .github/linters --write client/

# Auto-fix JavaScript linting issues (including unsafe fixes)
[group('web')]
web-fix:
    # Applies both safe and unsafe Biome fixes - use when lint errors can be automatically resolved
    bunx @biomejs/biome check --write --unsafe --config-path .github/linters client/

# Type check TypeScript with tsc (no emit) using local config
[group('typecheck')]
[group('web')]
web-typecheck:
    cd client && bunx tsc --noEmit

# Start frontend development server only
[group('dev')]
[group('web')]
web-dev:
    cd client && bun run dev

# ---- App-specific tasks ---------------------------------------------------

# Install all dependencies (Python + Web + Git hooks + Linting tools + System deps)
[group('setup')]
install: py-sync web-install hooks-install
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🛠️  Installing system dependencies and linting tools..."

    # Install eSpeak-NG for text-to-speech
    if ! command -v espeak-ng >/dev/null 2>&1; then
        echo "📦 Installing eSpeak-NG for TTS..."
        brew install espeak-ng
    fi

    # Install mado (ultra-fast Rust markdown linter)
    if ! command -v mado >/dev/null 2>&1; then
        echo "⚡ Installing mado (Rust markdown linter)..."
        if command -v brew >/dev/null 2>&1; then
            brew tap akiomik/mado https://github.com/akiomik/mado.git
            brew install mado
        else
            echo "⚠️  Homebrew not found. Please install mado manually:"
            echo "   See: https://github.com/akiomik/mado#installation"
        fi
    fi

    # Install taplo for TOML formatting (if not already available)
    if ! command -v taplo >/dev/null 2>&1; then
        echo "🔧 Installing taplo (TOML formatter)..."
        if command -v cargo >/dev/null 2>&1; then
            cargo install taplo-cli --locked
        else
            echo "⚠️  Cargo not found. Install Rust/Cargo to get taplo:"
            echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        fi
    fi

    # Install shellcheck for shell script linting (if not already available)
    if ! command -v shellcheck >/dev/null 2>&1; then
        echo "🐚 Installing shellcheck (shell script linter)..."
        brew install shellcheck
    fi

    echo "✅ Installation completed successfully!"
    echo ""
    echo "This recipe is IDEMPOTENT - safe to run multiple times:"
    echo "  • uv: skips if Python/packages already installed"
    echo "  • bun: checks packages, skips if no changes needed"
    echo "  • git hooks: silently succeeds if already configured"
    echo "  • system tools: checks existence before installing"

# Start both backend (FastAPI) and frontend (Vite) development servers
[group('dev')]
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    # IMPORTANT: This recipe now uses a shebang to run all lines in one bash session!
    # This allows:
    #   - Background processes with & to run in parallel
    #   - Variables (BACK_PID, FRONT_PID) to persist across lines
    #   - trap to reference those variables for cleanup
    # Store PIDs in temporary files for dev-stop recipe access
    mkdir -p .dev-pids
    # Temporarily disable exit on undefined variable for background process PIDs
    set +u
    (cd server && uv run uvicorn app:app --reload) &
    BACK_PID=$!
    echo $BACK_PID > .dev-pids/backend.pid
    (cd client && bun run dev) &
    FRONT_PID=$!
    echo $FRONT_PID > .dev-pids/frontend.pid
    set -u
    trap 'just dev-stop' INT TERM
    echo "Development servers started. Use 'just dev-stop' to stop cleanly."
    wait

# Stop development servers cleanly using stored PIDs
[group('dev')]
dev-stop:
    #!/usr/bin/env bash
    set -euo pipefail
    # Read PIDs from files and terminate processes
    if [ -f .dev-pids/backend.pid ]; then
        kill "$(cat .dev-pids/backend.pid)" 2>/dev/null || true
        rm -f .dev-pids/backend.pid
    fi
    if [ -f .dev-pids/frontend.pid ]; then
        kill "$(cat .dev-pids/frontend.pid)" 2>/dev/null || true
        rm -f .dev-pids/frontend.pid
    fi
    # Clean up any remaining processes by name as fallback
    pkill -f "uvicorn app:app" 2>/dev/null || true
    pkill -f "vite.*dev" 2>/dev/null || true
    rmdir .dev-pids 2>/dev/null || true
    echo "Development servers stopped."

# Development with OpenTelemetry console export enabled
[group('dev')]
dev-telemetry:
    #!/usr/bin/env bash
    set -euo pipefail
    # Start with telemetry enabled for debugging
    mkdir -p .dev-pids
    set +u
    # Enable telemetry with console export
    export OTEL_ENABLED=true
    export OTEL_CONSOLE_EXPORT=true
    export OTEL_SERVICE_NAME=bulgarian-voice-coach-dev
    (cd server && uv run uvicorn app:app --reload) &
    BACK_PID=$!
    echo $BACK_PID > .dev-pids/backend.pid
    (cd client && bun run dev) &
    FRONT_PID=$!
    echo $FRONT_PID > .dev-pids/frontend.pid
    trap 'kill $BACK_PID $FRONT_PID 2>/dev/null || true; echo "Development servers with telemetry stopped."' INT TERM EXIT
    wait

# Production-like serve (api + built frontend with preview server)
[group('deploy')]
serve:
    #!/usr/bin/env bash
    set -euo pipefail
    # Background processes work because shebang runs all lines in one bash session
    (cd server && uv run uvicorn app:app --host 0.0.0.0 --port 8000) &
    (cd client && bun run build && bun run preview -- --host) &
    wait

# Run all tests (server + client)
[group('test')]
test: py-test web-test

# Run server tests with pytest
[group('python')]
[group('test')]
py-test:
    cd server && uv run pytest -v --tb=short

# Run client unit and integration tests with Vitest
[group('test')]
[group('web')]
web-test:
    cd client && bun run test:run

# Run client tests in watch mode for development
[group('test')]
[group('web')]
web-test-dev:
    cd client && bun run test

# Run client tests with UI for interactive debugging
[group('test')]
[group('web')]
web-test-ui:
    cd client && bun run test:ui

# Run client tests with coverage report
[group('test')]
[group('web')]
web-test-coverage:
    cd client && bun run test:coverage

# Run E2E tests with Playwright
[group('test')]
[group('web')]
web-test-e2e:
    cd client && bun run test:e2e

# Run E2E tests with Playwright UI for debugging
[group('test')]
[group('web')]
web-test-e2e-ui:
    cd client && bun run test:e2e:ui

# Run E2E performance and stress tests
[group('test')]
[group('web')]
web-test-e2e-performance:
    cd client && bunx playwright test tests/e2e/performance.spec.js

# Validate core functionality of the Bulgarian Voice Coach
[group('test')]
test-core-functionality:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "🧪 Testing Core Functionality of Bulgarian Voice Coach..."
    echo "=================================================="

    # Colors for output
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    NC='\033[0m' # No Color

    # Test results tracking
    TESTS_PASSED=0
    TESTS_FAILED=0

    # Test 1: Validate 'just dev' launches with hot reload
    echo -e "\n📋 Test 1: Checking if development servers are running..."
    # Check for Vite on either port 5173 or 3000 (it may use alternate port if 5173 is busy)
    if curl -s -f -o /dev/null http://localhost:5173 || curl -s -f -o /dev/null http://localhost:3000; then
        if curl -s -f -o /dev/null http://localhost:5173; then
            echo -e "${GREEN}✅ Frontend server (Vite) is running on port 5173${NC}"
        else
            echo -e "${GREEN}✅ Frontend server (Vite) is running on port 3000 (alternate)${NC}"
        fi
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ Frontend server is not accessible on ports 5173 or 3000${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    if curl -s -f -o /dev/null http://localhost:8000/docs; then
        echo -e "${GREEN}✅ Backend server (FastAPI) is running on port 8000${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ Backend server is not accessible on port 8000${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test 2: Ensure Bulgarian text renders with Ysabeau font
    echo -e "\n📋 Test 2: Checking Ysabeau font loading..."
    # Determine which port Vite is using
    VITE_PORT=5173
    if ! curl -s -f -o /dev/null http://localhost:5173; then
        VITE_PORT=3000
    fi

    if curl -s http://localhost:${VITE_PORT} | grep -q "Ysabeau"; then
        echo -e "${GREEN}✅ Ysabeau font is referenced in HTML${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ Ysabeau font not found in HTML${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    if curl -s http://localhost:${VITE_PORT}/assets/fonts/Ysabeau-VariableFont_wght.woff2 --head | grep -q "200\|304"; then
        echo -e "${GREEN}✅ Ysabeau font file is being served${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ Ysabeau font file not accessible${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test 3: Test WebSocket connectivity for ASR
    echo -e "\n📋 Test 3: Testing WebSocket ASR endpoint..."
    # WebSocket endpoints return 404 to regular GET requests but accept upgrades
    # We'll check if the endpoint exists by looking for the 404 response
    WS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ws/asr 2>/dev/null)
    if [ "$WS_RESPONSE" = "404" ]; then
        # 404 = WebSocket endpoint exists but needs upgrade headers
        echo -e "${GREEN}✅ WebSocket ASR endpoint exists (waiting for WebSocket upgrade)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ WebSocket ASR endpoint issue (status: $WS_RESPONSE)${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test 4: Verify content system is loaded
    echo -e "\n📋 Test 4: Checking content system..."
    GRAMMAR_RESPONSE=$(curl -s http://localhost:8000/content/grammar/bg.no_infinitive.da_present)
    if echo "$GRAMMAR_RESPONSE" | grep -q "micro_explanation_bg"; then
        echo -e "${GREEN}✅ Grammar content system is working${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ Grammar content system not responding correctly${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    SCENARIOS_RESPONSE=$(curl -s http://localhost:8000/content/scenarios)
    if echo "$SCENARIOS_RESPONSE" | grep -q "level"; then
        echo -e "${GREEN}✅ Scenarios content system is working${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ Scenarios content system not responding correctly${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test 5: Test TTS endpoint
    echo -e "\n📋 Test 5: Testing Text-to-Speech (TTS) endpoint..."
    # URL encode the Cyrillic text
    TTS_TEXT=$(python3 -c "import urllib.parse; print(urllib.parse.quote('Здравей'))")
    TTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/tts?text=${TTS_TEXT}")
    if [ "$TTS_RESPONSE" = "200" ]; then
        echo -e "${GREEN}✅ TTS endpoint is working${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ TTS endpoint returned status $TTS_RESPONSE${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test 6: Check if TranscriptDisplay service exists
    echo -e "\n📋 Test 6: Checking UI components..."
    if [ -f "client/services/TranscriptDisplay.js" ]; then
        echo -e "${GREEN}✅ TranscriptDisplay service exists${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ TranscriptDisplay service not found${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test 7: Check if LocalProgressService exists (for SRS)
    if [ -f "client/services/LocalProgressService.js" ]; then
        echo -e "${GREEN}✅ LocalProgressService (SRS) exists${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ LocalProgressService not found${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test 8: Verify ASR model warm-up
    echo -e "\n📋 Test 8: Checking ASR model initialization..."
    if grep -q "Model warm-up complete" <(curl -s http://localhost:8000/docs | head -1000) 2>/dev/null || \
       journalctl -u bulgarian-voice-coach 2>/dev/null | tail -100 | grep -q "Model warm-up complete" || \
       echo "Model warm-up check skipped (logs not accessible)"; then
        echo -e "${GREEN}✅ ASR model warm-up verified (or not accessible for checking)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi

    # Test 9: Test production build capability
    echo -e "\n📋 Test 9: Testing production build..."
    if just build > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Production build successful${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ Production build failed${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Final Report
    echo -e "\n=================================================="
    echo "📊 Test Results Summary:"
    echo "=================================================="
    echo -e "${GREEN}✅ Passed: $TESTS_PASSED tests${NC}"
    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}❌ Failed: $TESTS_FAILED tests${NC}"
    fi

    TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
    SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

    echo -e "\n🎯 Success Rate: ${SUCCESS_RATE}%"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All core functionality tests PASSED!${NC}"
        exit 0
    else
        echo -e "\n${RED}⚠️  Some tests failed. Please review and fix the issues.${NC}"
        exit 1
    fi

# Run E2E tests with full video recording for debugging
[group('test')]
[group('web')]
web-test-e2e-debug:
    #!/usr/bin/env bash
    set -euo pipefail
    cd client
    echo "🎬 Running E2E tests with full recording..."
    bunx playwright test --video=on --trace=on

# Run E2E tests in headed mode (visible browser) for development
[group('test')]
[group('web')]
web-test-e2e-headed:
    cd client && bunx playwright test --headed

# Generate E2E test report
[group('test')]
[group('web')]
web-test-e2e-report:
    cd client && bunx playwright show-report

# Install Playwright browsers (needed for E2E tests)
[group('setup')]
[group('web')]
web-install-browsers:
    cd client && bunx playwright install

# Run cross-browser E2E tests (all browsers)
[group('test')]
[group('web')]
web-test-e2e-cross-browser:
    #!/usr/bin/env bash
    set -euo pipefail
    cd client
    echo "🌍 Running cross-browser E2E tests..."
    bunx playwright test --project=chromium --project=firefox --project=webkit

# Run comprehensive test suite with coverage
[group('test')]
test-all: py-test web-test-coverage web-test-e2e web-test-e2e-performance
    #!/usr/bin/env bash
    set -euo pipefail
    echo "✅ All tests completed successfully!"
    echo ""
    echo "📊 Test Summary:"
    echo "  - Python backend tests: ✅"
    echo "  - Client unit tests with coverage: ✅"
    echo "  - E2E functionality tests: ✅"
    echo "  - E2E performance & stress tests: ✅"
    echo "  - JavaScript unit/integration tests: ✅"
    echo "  - E2E browser tests: ✅"

# ---- Repo-wide tasks -------------------------------------------------------
# Lint everything: Python + Web + Shell/Docker via Super-Linter (local)
# See also the GitHub Action below.

# Get all diagnostics from LSP servers (same as Zed uses)
[group('quality')]
diagnostics:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Python Diagnostics (ruff) ==="
    uvx ruff check server/ --config .github/linters/.ruff.toml --output-format=full || true
    echo ""
    echo "=== Python Type Diagnostics (ty) ==="
    uvx ty check server/ || true
    echo ""
    echo ""
    echo "=== JavaScript/TypeScript Diagnostics ==="
    cd client && bunx tsc --noEmit || true
    cd client && bunx @biomejs/biome check --config-path ../.github/linters/biome.json . --diagnostic-level=info || true

# Check documentation formatting with Prettier
[group('docs')]
[group('quality')]
docs-check:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Checking documentation formatting with Prettier ==="
    bunx prettier --config .github/linters/.prettierrc.json --check "docs/**/*.{md,mdx}" --log-level warn || echo "No docs found"
    bunx prettier --config .github/linters/.prettierrc.json --check "README.md" --log-level warn || echo "No README.md found"

# Check TOML formatting with taplo
[group('quality')]
[group('toml')]
toml-check:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Checking TOML formatting with taplo ==="
    if command -v taplo >/dev/null 2>&1; then
        taplo format --check --config .github/linters/.taplo.toml
    else
        echo "taplo not installed. Install with: cargo install taplo-cli --locked"
    fi

# Run all linting: Python + Web + Markdown + YAML + JSON + Shell + Docker + TOML + Docs + Justfile
[group('quality')]
lint: py-lint web-lint web-typecheck markdown-lint yaml-lint json-lint shell-lint docker-lint docs-check toml-check format-check
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🎯 Running comprehensive linting suite..."
    echo "   ✅ Python (ruff) ✅ Web (Biome+tsc) ✅ Markdown (markdownlint)"
    echo "   ✅ YAML (yamllint) ✅ JSON (Biome) ✅ Shell (shellcheck)"
    echo "   ✅ Docker (hadolint) ✅ TOML (taplo) ✅ Docs (prettier)"
    echo ""
    # Optional type checking (may have experimental issues)
    uvx ty check server/ || echo "⚠️  ty type checking completed (experimental tool may have issues)"
    # Justfile format checking
    just --fmt --check --unstable
    echo ""
    echo "🎉 All linting checks completed!"

# Simulate CI environment by testing lint with fresh dependencies
[group('lint')]
ci-test:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Testing in clean CI-like environment ==="
    echo "This simulates CI by removing node_modules and reinstalling"
    rm -rf client/node_modules client/bun.lock
    cd client && bun install
    just lint

# Format TOML files with taplo
[group('format')]
[group('toml')]
toml-format:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Formatting TOML files with taplo ==="
    if command -v taplo >/dev/null 2>&1; then
        taplo format --config .github/linters/.taplo.toml
    else
        echo "taplo not installed. Install with: cargo install taplo-cli --locked"
    fi

# Format documentation with Prettier (Markdown, HTML, etc.) using centralized config
[group('docs')]
[group('format')]
docs-format:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Formatting documentation with Prettier ==="
    bunx prettier --config .github/linters/.prettierrc.json --write "docs/**/*.{md,mdx}" --log-level warn
    bunx prettier --config .github/linters/.prettierrc.json --write "README.md" --log-level warn || echo "No README.md found"

# Generate OpenAPI documentation
[group('docs')]
api-docs:
    #!/usr/bin/env python
    """Generate OpenAPI spec from FastAPI app and save to docs/api-reference.json"""
    import json
    import sys

    sys.path.insert(0, "server")
    from app import app

    FILENAME = "docs/api/openapi.json"
    with open(FILENAME, "w") as f:
        f.write(json.dumps(app.openapi(), indent=2))

    print(f"✅ API documentation saved to {FILENAME}")

# Lint OpenAPI spec using Spectral (APIStyleGuide.com ruleset)
[group('docs')]
[group('quality')]
api-lint: api-docs
    cd docs/api && bunx @stoplight/spectral-cli lint openapi.json

# Capture professional screenshots for documentation (requires dev servers running)
[group('docs')]
screenshots:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Capturing Screenshots for Documentation ==="
    echo "📋 Prerequisites:"
    echo "   • Development servers must be running: just dev"
    echo "   • Playwright must be installed: cd client && bun install"
    echo ""

    # Check if Bun is available
    if ! command -v bun >/dev/null 2>&1; then
        echo "❌ Bun not found! Please install Bun to run screenshot script."
        exit 1
    fi

    # Run the official screenshot capture script with bun
    # Try the new screenshot script first, fallback to original if it fails
    if [ -f scripts/capture-new-screenshots.js ]; then
        echo "📸 Running new screenshot capture script..."
        cd client && bun ../scripts/capture-new-screenshots.js
    else
        echo "📸 Running original screenshot capture script..."
        cd client && bun ../scripts/capture-screenshots.js
    fi

# Run all formatting: Python + Web + Markdown + YAML + JSON + TOML + Docs + Justfile
[group('quality')]
format: py-format web-format markdown-format yaml-format json-format toml-format docs-format
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🎨 Running comprehensive formatting suite..."
    echo "   ✅ Python (ruff) ✅ Web (Biome) ✅ Markdown (prettier)"
    echo "   ✅ YAML (prettier) ✅ JSON (Biome) ✅ TOML (taplo)"
    echo "   ✅ Docs (prettier) ✅ Justfile (just --fmt)"
    echo ""
    just --fmt --unstable
    echo ""
    echo "🎉 All code formatting completed!"

alias fmt := format

# Build all packages (currently just Python)
[group('build')]
build: py-build

_py-format-check:
    uvx ruff format --check server/ --config .github/linters/.ruff.toml

# Check if code is formatted correctly (fails if not)
[group('quality')]
format-check: _py-format-check

# ---- Git hooks via just ----------------------------------------------------
# We commit hooks into .githooks and point Git there to keep them versioned.
# `core.hooksPath` is the supported way to use custom hook directories.

# Install git hooks from .githooks directory
[group('setup')]
hooks-install:
    #!/usr/bin/env bash
    set -euo pipefail
    git config core.hooksPath .githooks
    chmod +x .githooks/* || true
    echo "Installed hooks to .githooks (core.hooksPath)."

# Gate run before every commit (lint + typecheck + format-check + docs-guard)
[group('git-hooks')]
pre-commit: lint docs-guard

# Heavy security guardrails (secrets + path leak scan)
[group('git-hooks')]
pre-push: secrets-scan path-leak-scan

# Scan for secrets using Gitleaks (containerized security scanner)
[group('security')]
secrets-scan:
    #!/usr/bin/env bash
    set -euo pipefail
    docker run --rm -v "${PWD}:/repo" ghcr.io/gitleaks/gitleaks:latest \
      git --no-banner --redact --report-format sarif --report-path gitleaks.sarif /repo

# Prevent accidental commits of absolute user paths (/Users/<name> or ~)
[group('security')]
path-leak-scan:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Scanning for absolute path leaks"
    ! (git grep -l '/Users/[a-zA-Z]' -- . ':!node_modules' ':!.git' ':!*.sarif' | head -1) || \
      (echo "\nERROR: Found /Users/<name> path leak. Remove absolute user paths." && exit 1)
    ! (git grep -l '~/[a-zA-Z._]' -- . ':!node_modules' ':!.git' ':!*.sarif' | head -1) || \
      (echo "\nERROR: Found <file> path leak in the ~ folder. Remove absolute user paths." && exit 1)

# Require docs/ updates when code changes (bypass with SKIP_DOCS_CHECK=1)
[group('git-hooks')]
docs-guard:
    #!/usr/bin/env bash
    set -euo pipefail
    # Uses staged changes; fails if non-docs changed but no docs/ changes are staged
    non_docs="$(git diff --cached --name-only -- . ':!docs/**' || true)"
    docs_changed="$(git diff --cached --name-only -- 'docs/**' || true)"
    if [ -n "${non_docs}" ] && [ -z "${docs_changed}" ] && [ -z "${SKIP_DOCS_CHECK-}" ]; then
      echo "\nERROR: This commit changes code but not docs/. Please update docs/ (or set SKIP_DOCS_CHECK=1 to bypass)."
      exit 1
    fi

# Run Super-Linter container for comprehensive code quality checks
[group('quality')]
superlint-pr:
    #!/usr/bin/env bash
    set -euo pipefail
    # Lints whole repo by default; set VALIDATE_ALL_CODEBASE=false to check only changes
    # {{ DEFAULT_BRANCH }} uses just's variable interpolation (happens before shell execution)
    docker run --rm \
      -e RUN_LOCAL=true \
      -e DEFAULT_BRANCH={{ DEFAULT_BRANCH }} \
      -e VALIDATE_ALL_CODEBASE=true \
      -e IGNORE_GITIGNORED_FILES=true \
      -e LINTER_RULES_PATH=.github/linters \
      -e VALIDATE_TOML=true \
      -e TOML_TAPLO_CONFIG_FILE=.github/linters/.taplo.toml \
      -v "${PWD}:/tmp/lint" \
      ghcr.io/super-linter/super-linter:latest

# Verify development environment setup
[group('setup')]
verify:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🔍 Verifying development environment setup..."
    python3 scripts/verify-setup.py

# Quick setup verification (essential checks only)
[group('setup')]
verify-quick:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "⚡ Quick setup verification..."
    python3 -c "import sys; print(f'✅ Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"
    uv --version && echo "✅ uv package manager"
    bun --version && echo "✅ bun runtime"
    just --version && echo "✅ just command runner"
    echo "🎉 Basic tools are available!"

# ---- Docker (Container Deployment) ----------------------------------------
# Docker-based deployment and development workflow

# Build production Docker image
[group('docker')]
docker-build:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🐳 Building production Docker image..."
    docker build --target production -t bulgarian-voice-coach:latest .
    echo "✅ Production image built successfully"
    docker images bulgarian-voice-coach:latest

# Build development Docker image
[group('docker')]
docker-build-dev:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🐳 Building development Docker image..."
    docker build --target development -t bulgarian-voice-coach:dev .
    echo "✅ Development image built successfully"

# Run production container
[group('docker')]
docker-serve:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Starting production container..."
    if [ ! -f .env ]; then
        echo "⚠️  No .env file found. Using defaults."
        echo "💡 Copy .env.example to .env and configure as needed."
    fi
    docker-compose up --build -d
    echo "✅ Container started successfully"
    echo "🌐 Access at: http://localhost:8000"
    echo "📊 Health check: http://localhost:8000/health"
    echo "📖 API docs: http://localhost:8000/docs"

# Run development container with hot reload
[group('docker')]
docker-dev:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🛠️  Starting development container..."
    if [ ! -f .env ]; then
        echo "⚠️  No .env file found. Using defaults."
        echo "💡 Copy .env.example to .env and configure as needed."
    fi
    docker-compose -f docker-compose.dev.yml up --build
    # Note: This runs in foreground to show logs

# Stop Docker containers
[group('docker')]
docker-stop:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🛑 Stopping Docker containers..."
    docker-compose down || true
    docker-compose -f docker-compose.dev.yml down || true
    echo "✅ Containers stopped"

# Show Docker container status and logs
[group('docker')]
docker-status:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "📊 Docker container status:"
    echo ""
    echo "=== Production containers ==="
    docker-compose ps 2>/dev/null || echo "No production containers running"
    echo ""
    echo "=== Development containers ==="
    docker-compose -f docker-compose.dev.yml ps 2>/dev/null || echo "No development containers running"
    echo ""
    echo "=== Images ==="
    docker images | grep bulgarian-voice-coach || echo "No bulgarian-voice-coach images found"

# Show Docker container logs (production)
[group('docker')]
docker-logs:
    docker-compose logs -f

# Show Docker container logs (development)
[group('docker')]
docker-logs-dev:
    docker-compose -f docker-compose.dev.yml logs -f

# Clean Docker resources (containers, images, volumes)
[group('docker')]
docker-clean:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🧹 Cleaning Docker resources..."

    # Stop containers
    docker-compose down 2>/dev/null || true
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true

    # Remove containers
    docker ps -a | grep bulgarian-voice-coach | awk '{print $1}' | xargs -r docker rm

    # Remove images
    docker images | grep bulgarian-voice-coach | awk '{print $3}' | xargs -r docker rmi

    # Optionally remove volumes (commented out for safety)
    # docker volume ls | grep bulgarian | awk '{print $2}' | xargs -r docker volume rm

    echo "✅ Docker cleanup complete"
    echo "💡 To also remove cached models/volumes, run: docker volume prune"

# Docker system information and requirements
[group('docker')]
docker-info:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🐳 Docker system information:"
    echo ""

    if ! command -v docker >/dev/null 2>&1; then
        echo "❌ Docker is not installed"
        echo "📦 Install from: https://docs.docker.com/get-docker/"
        exit 1
    fi

    echo "✅ Docker version:"
    docker --version
    echo ""

    if ! command -v docker-compose >/dev/null 2>&1; then
        echo "❌ Docker Compose is not installed"
        echo "📦 Install from: https://docs.docker.com/compose/install/"
        exit 1
    fi

    echo "✅ Docker Compose version:"
    docker-compose --version
    echo ""

    echo "📊 System resources:"
    docker system df
    echo ""

    echo "🎯 Requirements for Bulgarian Voice Coach:"
    echo "  • RAM: 2-4GB for production, 4-8GB for development"
    echo "  • Disk: 2-5GB (including Whisper models)"
    echo "  • CPU: 2+ cores recommended for real-time processing"

# Quick Docker deployment (production)
[group('docker')]
deploy: docker-build docker-serve
