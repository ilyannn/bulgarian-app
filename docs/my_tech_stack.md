# My Tech Stack & Project Hygiene (Template)

This document captures opinionated defaults, especially for new projects. However feel free to deviate from it to achieve the goals of **secure by default**, **fast local feedback**, and **automation first** better.

---

## Command Runner: `just`
Use [`just`](https://just.systems) as the single entrypoint for everyday commands (build, test, lint, dev, release). `just` is a lightweight command runner with a simple `justfile` and built-in `.env` support.

### Drop-in `justfile` (copy into project root and modify as necessary, especially for specific paths)
```make
#!/usr/bin/env just --justfile

# Default recipe to display help information
_default:
  @just --list

# Use bash and fail fast
set shell := ["bash", "-euo", "pipefail", "-c"]
set export := true

# Detect the default branch once; override per-repo as needed
DEFAULT_BRANCH := "main"

# ---- Python (uv + ruff) ---------------------------------------------------
# All Python commands run via uv (fast project manager)
# https://docs.astral.sh/uv/

py-sync:
	uv python install
	uv sync --locked || uv sync --dev

py-lint:
	uvx ruff check server

py-format:
	uvx ruff format server
	# Keep imports sorted (Ruff's `I` rules)
	uvx ruff check --select I --fix server

py-typecheck:
	# Use ty from Astral - extremely fast Python type checker (experimental)
	# Note: ty is still in early development, may have breaking changes
	uvx ty check .

py-build:
	# Build sdist + wheel with uv
	uv build

# ---- Web (TypeScript + Bun + Biome) --------------------------------------
# Bun as runtime & package manager; Biome for lint+format. Bun doesn't type
# check TypeScript, so we use `tsc --noEmit` for types.

web-install:
	cd client && bun install --frozen-lockfile

web-lint:
	# Biome: fast linter/formatter in one tool
	cd client && bunx @biomejs/biome ci

web-format:
	cd client && bunx @biomejs/biome format --write

web-typecheck:
	cd client && bunx tsc --noEmit

web-dev:
	cd client && bun run dev

# Auto-fix JavaScript linting issues (including unsafe fixes)
web-fix:
	cd client && bunx @biomejs/biome check --write --unsafe .

# ---- App-specific tasks ---------------------------------------------------
# Install all dependencies (Python via uv + client via bun + git hooks)
# This recipe is IDEMPOTENT - safe to run multiple times:
#   - uv: skips if Python/packages already installed
#   - bun: checks packages, skips if no changes needed
#   - git hooks: silently succeeds if already configured

install: py-sync web-install hooks-install

# Dev servers (backend FastAPI + frontend Vite) with shared lifetime
# IMPORTANT: This recipe works because `set shell` combines all lines into one command!
# The shell executes: bash -c "(cd server && ...) & BACK_PID=$! ; (cd client && ...) & ..."
# This allows:
#   - Background processes with & to run in parallel
#   - Variables (BACK_PID, FRONT_PID) to persist across lines
#   - trap to reference those variables for cleanup
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

# Tests (server only for now)
test:
	cd server && uv run pytest -q

# ---- Observability (OpenTelemetry) ------------------------------------------
# A local OTel Collector writes OTLP JSON to .otel/otel.jsonl during `just dev`.
# Collector config file expected at ./otel-collector.dev.yaml (see section below).
# Docs: Collector config + file exporter.

otel-collector-up:
	mkdir -p .otel
	# Restart collector (ignore errors if it doesn't exist)
	docker rm -f otel-collector >/dev/null 2>&1 || true
	docker run -d --name otel-collector \
	  -p 4318:4318 \
	  -v "${PWD}/otel-collector.dev.yaml:/etc/otelcol/config.yaml:ro" \
	  -v "${PWD}/.otel:/var/lib/otel" \
	  otel/opentelemetry-collector-contrib:latest

otel-collector-down:
	docker rm -f otel-collector >/dev/null 2>&1 || true

# Dev entrypoint: start collector and your app(s) with OTLP env vars set.
# SDKs read these standardized environment variables.
# NOTE: This is the template version - actual project uses simpler dev recipe

# dev-with-otel: otel-collector-up
#	# Common OTel env for local dev
#	export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
#	export OTEL_TRACES_EXPORTER="otlp"
#	export OTEL_METRICS_EXPORTER="otlp"
#	export OTEL_LOGS_EXPORTER="otlp"
#	export OTEL_SERVICE_NAME="${OTEL_SERVICE_NAME:-local-dev}"
#	# Start your dev processes (edit to suit):
#	# For Python: enable auto-instrumentation via the OTel agent.
#	# uvx opentelemetry-instrument --traces_exporter otlp --metrics_exporter otlp --logs_exporter otlp -- \
#	#   uv run -m your_package
#	# For Web: OTel JS supports Node LTS; Bun compatibility may vary.
#	bun run dev

# ---- Repo-wide tasks -------------------------------------------------------

# Lint everything: Python + Web + Shell/Docker via Super-Linter (local)
# See also the GitHub Action below.

lint: py-lint web-lint
	just --fmt --check --unstable

format: py-format web-format
	just --fmt --unstable

alias fmt := format

build: py-build

# Fast local "PR" super-lint using the official container (RUN_LOCAL)
# Lints the whole repo by default. Set VALIDATE_ALL_CODEBASE=false to only check changes.
# Docs: https://github.com/super-linter/super-linter
superlint-pr:
	docker run --rm \
	  -e RUN_LOCAL=true \
	  -e DEFAULT_BRANCH={{DEFAULT_BRANCH}} \
	  -e VALIDATE_ALL_CODEBASE=true \
	  -e IGNORE_GITIGNORED_FILES=true \
	  -v "${PWD}:/tmp/lint" \
	  ghcr.io/super-linter/super-linter:latest

# ---- Git hooks via just ----------------------------------------------------
# We commit hooks into .githooks and point Git there to keep them versioned.
# `core.hooksPath` is the supported way to use custom hook directories.

hooks-install:
	git config core.hooksPath .githooks
	chmod +x .githooks/* || true
	@echo "Installed hooks to .githooks (core.hooksPath)."

# This is the gate run locally before every commit
pre-commit: lint web-typecheck py-typecheck format-check docs-guard

# Format *check* (no writes). Fail if not formatted.
format-check:
	uvx ruff format --check server
	cd client && bunx @biomejs/biome check --reporter=summary

# Pre-push: heavy security guardrails (secrets + path leak scan)
pre-push: secrets-scan path-leak-scan

# Secret scan with Gitleaks (containerized). Fails on findings.
# Docs: https://github.com/gitleaks/gitleaks
secrets-scan:
	docker run --rm -v "${PWD}:/repo" ghcr.io/gitleaks/gitleaks:latest \
	  git --no-banner --redact --report-format sarif --report-path gitleaks.sarif /repo

# Block accidental absolute paths like /Users/<name> or ~ checked into the repo
# Skip common directories; extend as needed.
path-leak-scan:
	@echo "Scanning for path leaks (/Users/<name> or ~)"
	! git grep -nI -e '/Users/' -e '~/' -- . ':!node_modules' ':!.git' ':!*.sarif' || \
	  (echo "\nERROR: Found potential path leaks. Remove absolute user paths (/Users/<you> or ~)." && exit 1)

# Require docs/ updates when code changes (can bypass with SKIP_DOCS_CHECK=1)
# Uses staged changes; fails if non-docs changed but no docs/ changes are staged.
docs-guard:
	@non_docs="$(git diff --cached --name-only -- . ':!docs/**' || true)"; \
	docs_changed="$(git diff --cached --name-only -- 'docs/**' || true)"; \
	if [ -n "$${non_docs}" ] && [ -z "$${docs_changed}" ] && [ -z "$${SKIP_DOCS_CHECK-}" ]; then \
	  echo "\nERROR: This commit changes code but not docs/. Please update docs/ (or set SKIP_DOCS_CHECK=1 to bypass)."; \
	  exit 1; \
	fi
```

**Notes**
- `set shell := ["bash", "-euo", "pipefail", "-c"]` enables strict bash, making recipes fail-fast. See `just` shell configuration.
- `web-lint`/`web-format` use **Biome** (linter + formatter); `web-typecheck` runs `bunx tsc --noEmit` because Bun does not type-check TS.
- `superlint-pr` runs the **Super-Linter** container locally with `RUN_LOCAL=true`.
- `secrets-scan` uses **Gitleaks**. Use a `.gitleaks.toml` to customize allowlists if needed.
- `hooks-install` uses `core.hooksPath` so hooks are versioned in `.githooks`.
- Python commands target `server/` directory specifically, web commands target `client/` directory.
- `dev` recipe starts both backend (uvicorn) and frontend (bun) with proper process management.

---

## Git Hooks (versioned)
Create a `.githooks/` directory at the repo root and add the following two files. Then run `just hooks.install` once per clone.

### `.githooks/pre-commit`
```bash
#!/usr/bin/env bash
set -euo pipefail

# Enforce formatting + lint and type-check locally before committing
just pre-commit
```

### `.githooks/pre-push`
```bash
#!/usr/bin/env bash
set -euo pipefail

# Run heavy checks before pushing
just pre-push
```

> Why versioned hooks? Git officially supports pointing hooks to a committed directory via `core.hooksPath`, which is portable and keeps teams in sync.

---

## GitHub Actions (CI)

Always include permissions when using GITHUB_TOKEN.

### 1) Super-Linter on PRs (everything enabled)
```yaml
# .github/workflows/superlinter.yml
name: Super-Linter
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read  # least-privilege token
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4 # TIP: pin to a commit SHA per GitHub guidance
      - name: Super-Linter
        # TIP: pin to a specific version or commit SHA
        uses: super-linter/super-linter@v7
        env:
          DEFAULT_BRANCH: main
          VALIDATE_ALL_CODEBASE: true
          IGNORE_GITIGNORED_FILES: true
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
- Super-Linter docs + config env vars.
- Keep `GITHUB_TOKEN` to **least privilege** using workflow `permissions`. Pin actions to a version/commit SHA for supply-chain safety.

### 2) Build & lint in CI:

- create an action to install just
- run appropriate just commands for specific languages
- Example workflow installs Python, Node, and runs `just lint` and `just test`


### 3) Optional: Gitleaks in CI (defense-in-depth)
```yaml
# .github/workflows/gitleaks.yml
name: Gitleaks
on: [push, pull_request]
permissions:
  contents: read
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
-- Gitleaks docs + Action.

> **Security hardening tips for Actions**: set token permissions to the minimum required and pin actions. Consider adding a hardening step/tool to determine minimum `GITHUB_TOKEN` permissions.

---

## Containers (prefer Chainguard)
When building container images, prefer minimal, non-root, regularly-updated bases like **Chainguard**. For Python apps, start from `cgr.dev/chainguard/python`.

### Example `Dockerfile`
```dockerfile
# syntax=docker/dockerfile:1
# Build stage: install tools & deps
FROM cgr.dev/chainguard/python:latest-dev AS build
WORKDIR /app
# Install uv (fast) and build the project
RUN apk add --no-cache curl \
    && curl -LsSf https://astral.sh/uv/install.sh | sh
COPY . .
RUN /root/.cargo/bin/uv sync --locked --no-dev \
    && /root/.cargo/bin/uv build

# Runtime stage: minimal, non-root by default
FROM cgr.dev/chainguard/python:latest
WORKDIR /app
# Copy built wheel(s) and install
COPY --from=build /app/dist/*.whl /tmp/
RUN python -m pip install --no-cache-dir /tmp/*.whl \
    && rm -rf /root/.cache
# Configure default command (adjust to your app)
CMD ["python", "-m", "your_package"]
```
- Chainguard images are minimal and designed for secure-by-default runtimes.

## Observability (OpenTelemetry) for Local Dev

**Goal:** when you run `just dev`, your app exports traces/metrics/logs with **OpenTelemetry** and a local **Collector** writes them in **OTLP JSON** to `.otel/otel.jsonl` for easy tailing/grepping and future ingestion.

**How it works**
- SDKs use standard env vars like `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`. `just dev` sets these to send telemetry to `http://localhost:4318`.
- The **OpenTelemetry Collector** runs locally (Docker) and writes data using the **file exporter** (OTLP JSON).
- For **Python**, prefer auto‑instrumentation with the `opentelemetry-instrument` CLI so you get traces/metrics/logs with zero code changes.
- For **TypeScript on Bun**, the OpenTelemetry JS SDK officially supports Node LTS; Bun generally works but some features (especially logging and loaders) may lag. If you hit issues, run your dev server on Node for instrumentation or manually initialize tracing.

### `otel-collector.dev.yaml` (drop in repo root)
```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
processors:
  batch: {}
exporters:
  file:
    path: /var/lib/otel/otel.jsonl
    rotation:
      max_megabytes: 100
      max_days: 7
  logging:
    loglevel: info
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [file, logging]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [file, logging]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [file, logging]
```
*Why this format?* The **file exporter** writes OTLP‑JSON so you can re‑ingest it later and it’s lossless for OTel data. Use `logging` alongside to debug locally.

## Unstructured Data Store: Elastic

For document‑/event‑like, semi‑ or unstructured data, default to **Elasticsearch** (Elastic). It stores **JSON documents** in **indices**, supports **dynamic mapping** for evolving schemas, and offers full‑text + vector search (ELSER and embeddings).

**Notes / guards**
- Prefer explicit mappings for critical fields; dynamic mapping is convenient but can explode field counts. Set field limits and mapping rules early.
- Use ingest pipelines (and/or Unstructured.io) to parse PDFs and other complex docs into indexable JSON.
- For simple local dev, you can run Elastic locally or use Elastic Cloud; production sizing requires benchmarking with representative data.

## Documentation policy (docs/)

- Keep living docs (architecture, goals, runbooks) in `docs/`.
- The `pre-commit` hook runs `docs-guard`, which **fails** if a commit changes code but not `docs/` (set `SKIP_DOCS_CHECK=1` to bypass when appropriate). Hooks are implemented via `core.hooksPath` so they're versioned in the repo.
- Optional: wire `docs/` into a site generator (MkDocs/Docusaurus) with `just docs.build` & `docs.serve` and publish via GitHub Pages in CI.

---

## New-Project Defaults (turn everything up)
- **Formatting must pass** in `pre-commit`: we run `ruff format --check` and `biome check` and **fail** if not clean.
- **Linters on PRs**: Super-Linter with full codebase validation.
- **Type safety**: `tsc --noEmit` in hooks and CI.
- **Secret hygiene**: local **pre-push** runs Gitleaks + path-leak scan; enable GitHub **Secret Scanning + Push Protection** in the repo/org settings.
- **Actions security**: set workflow `permissions` to read-only by default; pin third‑party actions to SHAs.

---

## What else can be added depending on the project
1) **CODEOWNERS + rules** to require reviews from owners.
2) **Renovation bot** (Dependabot/Renovate) for dependency updates.
3) **Container & SBOM scanning** (e.g., Trivy/Syft) in CI.
4) **Conventional Commits** + `CHANGELOG.md` automation.

