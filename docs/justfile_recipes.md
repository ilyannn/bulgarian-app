# Justfile Recipes Documentation

This document explains the available recipes in the Justfile and their purpose.

## Core Development Recipes

### `install`
Install all dependencies (Python via uv + client via bun + git hooks)
- **Idempotent**: Safe to run multiple times
- uv: skips if Python/packages already installed
- bun: checks packages, skips if no changes needed  
- git hooks: silently succeeds if already configured

### `dev`
Start both backend (FastAPI) and frontend (Vite) development servers with shared lifetime
- Runs backend on port 8000 (uvicorn with reload)
- Runs frontend on port 3000 (Vite dev server)
- Handles graceful shutdown of both processes

## Python Recipes

### `py-sync`
Install Python and sync dependencies using uv

### `py-lint`
Check Python code with ruff linter

### `py-format`
Format Python code with ruff (includes import sorting)

### `py-typecheck`
Type checking (placeholder - add mypy/pyright if needed)

### `py-build`
Build Python package (sdist + wheel) with uv

## Web/JavaScript Recipes

### `web-install`
Install JavaScript dependencies with bun (frozen lockfile)

### `web-lint`
Lint JavaScript/TypeScript code with Biome

### `web-format`
Format JavaScript/TypeScript code with Biome

### `web-fix`
**NEW**: Auto-fix JavaScript linting issues (including unsafe fixes)
- Applies both safe and unsafe Biome fixes
- Use when lint errors can be automatically resolved

### `web-typecheck`
Type check TypeScript with tsc (no emit)

### `web-dev`
Start frontend development server only

## Repository-wide Tasks

### `lint`
Run all linting: Python + Web + Justfile formatting check

### `format`
Run all formatting: Python + Web + Justfile formatting

### `fmt`
Alias for `format`

### `build`
Build all packages (currently just Python)

### `format-check`
Check if code is formatted correctly (fails if not)

### `test`
Run tests (server only for now)

## Git Hooks

### `hooks-install`
Install git hooks from .githooks directory

### `pre-commit`
Gate run before every commit (lint + typecheck + format-check + docs-guard)

### `pre-push`
Heavy security guardrails (secrets + path leak scan)

## Security Scanning

### `secrets-scan`
Scan for secrets using Gitleaks (containerized)

### `path-leak-scan`
Block accidental absolute paths like /Users/<name> in commits

### `docs-guard`
Require docs/ updates when code changes (bypass with SKIP_DOCS_CHECK=1)

### `superlint-pr`
Run Super-Linter container for comprehensive code quality checks

## Recent Changes

- **2024-08-24**: Added `web-fix` recipe for auto-fixing JavaScript linting issues
- **2024-08-24**: Enhanced Justfile comments explaining differences from Make
- **2024-08-24**: Fixed Biome configuration deprecation warnings
- **2024-08-24**: Fixed Python linting issues (type hints, exception chaining)