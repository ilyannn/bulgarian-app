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
py-sync:
    uv python install
    uv sync --locked || uv sync --dev

# Check Python code with ruff linter
py-lint:
    uvx ruff check server

# Format Python code with ruff (includes import sorting)
py-format:
    uvx ruff format server
    # Keep imports sorted (Ruff's `I` rules)
    uvx ruff check --select I --fix server

# Type checking with ty from Astral (experimental - fast Python type checker)
py-typecheck:
    # Note: ty is still in early development, may have breaking changes
    # Allow ty to fail without stopping the build (experimental tool)
    uvx ty check server || echo "ty type checking completed with issues (experimental tool)"

# Build Python package (sdist + wheel) with uv
py-build:
    uv build

# ---- Web (TypeScript + Bun + Biome) --------------------------------------
# Bun as runtime & package manager; Biome for lint+format. Bun doesn't type
# check TypeScript, so we use `tsc --noEmit` for types.

# Install JavaScript dependencies with bun (frozen lockfile)
web-install:
    cd client && bun install --frozen-lockfile

# Lint JavaScript/TypeScript code with Biome
web-lint:
    cd client && bunx @biomejs/biome ci

# Format JavaScript/TypeScript code with Biome
web-format:
    cd client && bunx @biomejs/biome format --write

# Auto-fix JavaScript linting issues (including unsafe fixes)
web-fix:
    # Applies both safe and unsafe Biome fixes - use when lint errors can be automatically resolved
    cd client && bunx @biomejs/biome check --write --unsafe .

# Type check TypeScript with tsc (no emit)
web-typecheck:
    cd client && bunx tsc --noEmit

# Start frontend development server only
web-dev:
    cd client && bun run dev

# ---- App-specific tasks ---------------------------------------------------
# Install all dependencies (Python via uv + client via bun + git hooks)
# This recipe is IDEMPOTENT - safe to run multiple times:
#   - uv: skips if Python/packages already installed
#   - bun: checks packages, skips if no changes needed

# - git hooks: silently succeeds if already configured
install: py-sync web-install hooks-install

# Dev servers (backend FastAPI + frontend Vite) with shared lifetime
# IMPORTANT: This recipe works because `set shell` combines all lines into one command!
# The shell executes: bash -c "(cd server && ...) & BACK_PID=$! ; (cd client && ...) & ..."
# This allows:
#   - Background processes with & to run in parallel
#   - Variables (BACK_PID, FRONT_PID) to persist across lines

# - trap to reference those variables for cleanup
dev:
    (cd server && uv run uvicorn app:app --reload) &
    BACK_PID=$!
    (cd client && bun run dev) &
    FRONT_PID=$!
    trap 'kill $BACK_PID $FRONT_PID' INT TERM
    wait

# Production-ish serve (api + built frontend)

# NOTE: Background processes (&) work because all lines run in the same shell session
serve:
    (cd server && uv run uvicorn app:app --host 0.0.0.0 --port 8000) &
    (cd client && bun run build && bun run preview -- --host) &
    wait

# Run tests (server only for now)
test:
    cd server && uv run pytest -q

# ---- Repo-wide tasks -------------------------------------------------------
# Lint everything: Python + Web + Shell/Docker via Super-Linter (local)
# See also the GitHub Action below.

# Run all linting: Python + Web + Justfile formatting check
lint: py-lint web-lint
    just --fmt --check --unstable

# Run all formatting: Python + Web + Justfile formatting
format: py-format web-format
    just --fmt --unstable

# Alias for `format`

alias fmt := format

# Build all packages (currently just Python)
build: py-build

# Check if code is formatted correctly (fails if not)
format-check:
    uvx ruff format --check server
    cd client && bunx @biomejs/biome check --reporter=summary

# ---- Git hooks via just ----------------------------------------------------
# We commit hooks into .githooks and point Git there to keep them versioned.
# `core.hooksPath` is the supported way to use custom hook directories.

# Install git hooks from .githooks directory
hooks-install:
    git config core.hooksPath .githooks
    chmod +x .githooks/* || true
    @echo "Installed hooks to .githooks (core.hooksPath)."

# Gate run before every commit (lint + typecheck + format-check + docs-guard)
pre-commit: lint web-typecheck py-typecheck format-check docs-guard

# Heavy security guardrails (secrets + path leak scan)
pre-push: secrets-scan path-leak-scan

# Scan for secrets using Gitleaks (containerized)
# Docs: https://github.com/gitleaks/gitleaks

# NOTE: Backslash (\) continuation keeps this as one logical line
secrets-scan:
    docker run --rm -v "${PWD}:/repo" ghcr.io/gitleaks/gitleaks:latest \
      git --no-banner --redact --report-format sarif --report-path gitleaks.sarif /repo

# Block accidental absolute paths like /Users/<name> in commits
# Skip common directories; extend as needed.

# NOTE: @ prefix only affects the first line; continuation is part of that line
path-leak-scan:
    @echo "Scanning for path leaks (/Users/<name> or ~)"
    ! git grep -nI -e '/Users/' -e '~/' -- . ':!node_modules' ':!.git' ':!*.sarif' || \
      (echo "\nERROR: Found potential path leaks. Remove absolute user paths (/Users/<you> or ~)." && exit 1)

# Require docs/ updates when code changes (bypass with SKIP_DOCS_CHECK=1)
# Uses staged changes; fails if non-docs changed but no docs/ changes are staged.
# IMPORTANT: Backslash continuation (\) keeps this as ONE command

# The $${var} syntax passes ${var} to bash (just uses $$ to escape $)
docs-guard:
    @non_docs="$(git diff --cached --name-only -- . ':!docs/**' || true)"; \
    docs_changed="$(git diff --cached --name-only -- 'docs/**' || true)"; \
    if [ -n "$${non_docs}" ] && [ -z "$${docs_changed}" ] && [ -z "$${SKIP_DOCS_CHECK-}" ]; then \
      echo "\nERROR: This commit changes code but not docs/. Please update docs/ (or set SKIP_DOCS_CHECK=1 to bypass)."; \
      exit 1; \
    fi

# Run Super-Linter container for comprehensive code quality checks
# Lints the whole repo by default. Set VALIDATE_ALL_CODEBASE=false to only check changes.
# Docs: https://github.com/super-linter/super-linter

# NOTE: {{ DEFAULT_BRANCH }} is just's variable interpolation (happens before shell execution)
superlint-pr:
    docker run --rm \
      -e RUN_LOCAL=true \
      -e DEFAULT_BRANCH={{ DEFAULT_BRANCH }} \
      -e VALIDATE_ALL_CODEBASE=true \
      -e IGNORE_GITIGNORED_FILES=true \
      -v "${PWD}:/tmp/lint" \
      ghcr.io/super-linter/super-linter:latest
