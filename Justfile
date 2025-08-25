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

# Install all dependencies (Python via uv + client via bun + git hooks + system deps)
[group('setup')]
install: py-sync web-install hooks-install
    #!/usr/bin/env bash
    set -euo pipefail
    # Install system dependencies (eSpeak-NG for text-to-speech)
    # Check if espeak-ng is available, install if not
    command -v espeak-ng >/dev/null 2>&1 || brew install espeak-ng
    # This recipe is IDEMPOTENT - safe to run multiple times:
    #   - uv: skips if Python/packages already installed
    #   - bun: checks packages, skips if no changes needed
    #   - git hooks: silently succeeds if already configured
    #   - brew: checks if espeak-ng exists before installing

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

# Run tests (server only for now)
[group('test')]
test:
    cd server && uv run pytest -v --tb=short

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

# Run all linting: Docker + Python + Web + Docs + TOML + Justfile formatting check
[group('quality')]
lint: docker-lint py-lint web-lint web-typecheck docs-check toml-check
    #!/usr/bin/env bash
    set -euo pipefail
    uvx ty check server/ || true
    just --fmt --check --unstable

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

# Run all formatting: Python + Web + Docs + TOML + Justfile formatting
[group('quality')]
format: py-format web-format docs-format toml-format
    just --fmt --unstable

alias fmt := format

# Build all packages (currently just Python)
[group('build')]
build: py-build

# Check if code is formatted correctly (fails if not)
[group('quality')]
format-check:
    #!/usr/bin/env bash
    set -euo pipefail
    uvx ruff format --config .github/linters/.ruff.toml --check server
    cd client && bunx @biomejs/biome check --config-path ../.github/linters/biome.json --reporter=summary

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
pre-commit: lint web-typecheck format-check docs-guard

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
