#!/usr/bin/env -S just --justfile
# ==============================================================================
# IMPORTANT: How `just` differs from Make
# ==============================================================================
# 1. SHELL EXECUTION MODEL (CRITICAL DIFFERENCE):
#    - By default, each recipe line runs in a SEPARATE shell
#    - With `set shell := ["bash", "-c"]`, all lines are combined into ONE shell
#    - This is why our multi-line recipes below work correctly
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

# Configure shell for all recipes - THIS IS CRITICAL!
# This setting wraps ALL recipe lines into a single bash command:
#   bash -euo pipefail -c "line1; line2; line3"
# Options:
#   -e: exit on any command error
#   -u: exit on undefined variable
#   -o pipefail: fail if any command in a pipe fails
# RESULT: Variables persist across lines, background processes work correctly

set shell := ["bash", "-euo", "pipefail", "-c"]

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
    uv python install
    uv sync --locked || uv sync --dev

# Check Python code with ruff linter
[group('lint')]
[group('python')]
py-lint:
    uvx ruff check server

# Format Python code with ruff (includes import sorting)
[group('format')]
[group('python')]
py-format:
    uvx ruff format server
    # Keep imports sorted (Ruff's `I` rules)
    uvx ruff check --select I --fix server

# Type checking with ty from Astral (experimental - fast Python type checker)
[group('python')]
[group('typecheck')]
py-typecheck:
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

# Lint JavaScript/TypeScript code with Biome
[group('lint')]
[group('web')]
web-lint:
    cd client && bunx @biomejs/biome ci

# Format JavaScript/TypeScript code with Biome
[group('format')]
[group('web')]
web-format:
    cd client && bunx @biomejs/biome format --write

# Auto-fix JavaScript linting issues (including unsafe fixes)
[group('web')]
web-fix:
    # Applies both safe and unsafe Biome fixes - use when lint errors can be automatically resolved
    cd client && bunx @biomejs/biome check --write --unsafe .

# Type check TypeScript with tsc (no emit)
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
    # IMPORTANT: This recipe works because `set shell` combines all lines into one command!
    # The shell executes: bash -c "(cd server && ...) & BACK_PID=$! ; (cd client && ...) & ..."
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
    # Read PIDs from files and terminate processes
    if [ -f .dev-pids/backend.pid ]; then \
        kill "$(cat .dev-pids/backend.pid)" 2>/dev/null || true; \
        rm -f .dev-pids/backend.pid; \
    fi
    if [ -f .dev-pids/frontend.pid ]; then \
        kill "$(cat .dev-pids/frontend.pid)" 2>/dev/null || true; \
        rm -f .dev-pids/frontend.pid; \
    fi
    # Clean up any remaining processes by name as fallback
    pkill -f "uvicorn app:app" 2>/dev/null || true
    pkill -f "vite.*dev" 2>/dev/null || true
    rmdir .dev-pids 2>/dev/null || true
    @echo "Development servers stopped."

# Production-like serve (api + built frontend with preview server)
[group('deploy')]
serve:
    # Background processes work because `set shell` combines all lines into one shell session
    (cd server && uv run uvicorn app:app --host 0.0.0.0 --port 8000) &
    (cd client && bun run build && bun run preview -- --host) &
    wait

# Run tests (server only for now)
[group('test')]
test:
    cd server && uv run pytest -q

# ---- Repo-wide tasks -------------------------------------------------------
# Lint everything: Python + Web + Shell/Docker via Super-Linter (local)
# See also the GitHub Action below.

# Run all linting: Python + Web + Justfile formatting check
[group('quality')]
lint: py-lint web-lint
    just --fmt --check --unstable

# Run all formatting: Python + Web + Justfile formatting
[group('quality')]
format: py-format web-format
    just --fmt --unstable

# Alias for `format`

alias fmt := format

# Build all packages (currently just Python)
[group('build')]
build: py-build

# Check if code is formatted correctly (fails if not)
[group('quality')]
format-check:
    uvx ruff format --check server
    cd client && bunx @biomejs/biome check --reporter=summary

# ---- Git hooks via just ----------------------------------------------------
# We commit hooks into .githooks and point Git there to keep them versioned.
# `core.hooksPath` is the supported way to use custom hook directories.

# Install git hooks from .githooks directory
[group('setup')]
hooks-install:
    git config core.hooksPath .githooks
    chmod +x .githooks/* || true
    @echo "Installed hooks to .githooks (core.hooksPath)."

# Gate run before every commit (lint + typecheck + format-check + docs-guard)
[group('git-hooks')]
pre-commit: lint web-typecheck py-typecheck format-check docs-guard

# Heavy security guardrails (secrets + path leak scan)
[group('git-hooks')]
pre-push: secrets-scan path-leak-scan

# Scan for secrets using Gitleaks (containerized security scanner)
[group('security')]
secrets-scan:
    # Backslash continuation keeps this as one logical command across multiple lines
    docker run --rm -v "${PWD}:/repo" ghcr.io/gitleaks/gitleaks:latest \
      git --no-banner --redact --report-format sarif --report-path gitleaks.sarif /repo

# Prevent accidental commits of absolute user paths (/Users/<name> or ~)
[group('security')]
path-leak-scan:
    # @ prefix suppresses echo only for the first line; continuation lines are part of that command
    @echo "Scanning for path leaks (/Users/<name> or ~)"
    ! git grep -nI -e '/Users/' -e '~/' -- . ':!node_modules' ':!.git' ':!*.sarif' || \
      (echo "\nERROR: Found potential path leaks. Remove absolute user paths (/Users/<you> or ~)." && exit 1)

# Require docs/ updates when code changes (bypass with SKIP_DOCS_CHECK=1)
[group('git-hooks')]
docs-guard:
    # Uses staged changes; fails if non-docs changed but no docs/ changes are staged
    # Backslash continuation keeps this as ONE shell command; $${var} passes ${var} to bash
    @non_docs="$(git diff --cached --name-only -- . ':!docs/**' || true)"; \
    docs_changed="$(git diff --cached --name-only -- 'docs/**' || true)"; \
    if [ -n "$${non_docs}" ] && [ -z "$${docs_changed}" ] && [ -z "$${SKIP_DOCS_CHECK-}" ]; then \
      echo "\nERROR: This commit changes code but not docs/. Please update docs/ (or set SKIP_DOCS_CHECK=1 to bypass)."; \
      exit 1; \
    fi

# Run Super-Linter container for comprehensive code quality checks
[group('quality')]
superlint-pr:
    # Lints whole repo by default; set VALIDATE_ALL_CODEBASE=false to check only changes
    # {{ DEFAULT_BRANCH }} uses just's variable interpolation (happens before shell execution)
    docker run --rm \
      -e RUN_LOCAL=true \
      -e DEFAULT_BRANCH={{ DEFAULT_BRANCH }} \
      -e VALIDATE_ALL_CODEBASE=true \
      -e IGNORE_GITIGNORED_FILES=true \
      -v "${PWD}:/tmp/lint" \
      ghcr.io/super-linter/super-linter:latest
