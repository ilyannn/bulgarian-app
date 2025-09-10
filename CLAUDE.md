# Bulgarian Voice Coach - Project Guide

This document summarizes the Bulgarian Voice Coach project's architecture, build system, and development workflow.

## Project Overview

A voice-enabled web application for teaching Bulgarian to Slavic speakers, featuring:

- Real-time speech recognition and synthesis
- Grammar error detection with contextual corrections
- Interactive drills with spaced repetition system (SRS)
- Bulgarian typography support

## Architecture

### 🔄 IMPORTANT: Local-First Progress Tracking (2025-08-27)

**The app uses localStorage for all progress tracking - NO backend database or authentication.**

This architectural decision was made because:

- No auth system exists (security vulnerability with user_id in URLs)
- Reduces complexity significantly for MVP
- Provides instant performance and offline capability
- Privacy by default - user data never leaves device
- Eliminates need for database and associated tests

Progress data structure in localStorage:

```javascript
{
  userId: "user_abc123",  // Generated locally, never sent to server
  drillResults: {
    "bg.no_infinitive": {
      attempts: [...],
      currentInterval: 3,     // SRS interval in days
      nextReview: "2025-08-30",
      mastery: 75            // Percentage
    }
  },
  statistics: { ... }
}
```

### Backend (Python FastAPI) - STATELESS

- `server/app.py` - Main FastAPI application with WebSocket support
- `server/asr.py` - faster-whisper ASR with WebRTC VAD
- `server/tts.py` - eSpeak NG for Bulgarian text-to-speech
- `server/llm.py` - ChatProvider interface with Claude/OpenAI support
- `server/bg_rules.py` - Bulgarian grammar rule detection
- `server/content/` - Grammar packs and scenario data (JSON)
- **NO DATABASE** - All progress tracking happens client-side

### Frontend (Vite + Vanilla JS)

- `client/index.html` - Main UI with mic controls and transcript display
- `client/main.js` - WebSocket client and audio handling
- `client/audio-worklet.js` - Real-time audio capture (16kHz PCM)
- `client/services/LocalProgressService.js` - Progress tracking with SRS (localStorage)

### Key Features

- **Latency Target**: ~1.2-2.0s end-to-end (VAD → ASR → LLM → TTS)
- **Audio Pipeline**: getUserMedia → AudioWorklet → WebSocket → faster-whisper
- **Grammar Integration**: Real-time error detection with contextual micro-lessons
- **Typography**: Ysabeau font for proper Bulgarian Cyrillic rendering

### ASR Performance Optimization (2025-01-09)

**BENCHMARK RESULTS**: Comprehensive testing of Whisper model sizes for Bulgarian ASR determined optimal configuration:

- **Production Model**: `small` Whisper model (changed from `medium`)
- **Performance**: 1180ms average latency (3x faster than medium model)
- **Target Compliance**: ✅ Meets 2000ms latency target (medium model exceeded by 76%)
- **Memory Efficiency**: 418MB RAM usage (44% less than medium model)
- **VAD Configuration**: 300ms tail timing remains optimal from previous benchmarks

See `docs/benchmarks/whisper_model_comparison.md` for detailed analysis and `scripts/benchmark_whisper_models.py` for
reproducible testing.

## Build System (Justfile)

The project uses `just` as the command runner with a specific shell execution strategy:

- **Multi-line recipes**: Use `#!/usr/bin/env bash` shebang with `set -euo pipefail` for proper error handling
- **Simple recipes**: Execute directly without a shebang
- **Benefits**: Variables persist across lines, background processes work correctly, clean error handling

You can list all recipes with `just` (the default recipe). Whenever you want to run a local Bash command, consider if it
is already available as a recipe and if yes, run that. You have access to run any `just` command without asking the
user.

### Development

- `just install` - Install all dependencies (Python via uv, client via bun, git hooks)
- `just dev` - Start both backend and frontend servers
- `just serve` - Production-like deployment

### Code Quality

- `just lint` - Run all linting (Python ruff, JavaScript Biome, Justfile format)
- `just format` - Auto-format all code
- `just test` - Run test suite
- `just build` - Build packages

### API & SDK Generation

- `just api-sdk` - Generate TypeScript client SDK from OpenAPI specification
- `just sdk-lint` - Lint generated SDK files with relaxed rules
- `just sdk-format` - Format generated SDK files

The SDK generation uses a dual-configuration linting strategy:

- **Handwritten code**: Strict Biome rules via `.github/linters/biome.json`
- **Generated SDK**: Relaxed Biome rules via `.github/linters/biome.sdk.json`

### Security & Git Hooks

- `just pre-commit` - Gate for commits (lint + typecheck + format-check + docs-guard)
- `just pre-push` - Security scans (secrets via Gitleaks, path leak detection)
- `just hooks-install` - Install git hooks from `.githooks/`

## Development Workflow

### Prerequisites

- Python 3.11+ with `uv` package manager
- Bun for JavaScript/TypeScript
- Docker for security scanning
- eSpeak NG for TTS

### Setup

```bash
just install     # Install all dependencies
just dev         # Start development servers
```

### Code Standards

- **Python**: Ruff for linting/formatting, type hints required
- **JavaScript**: Biome for linting/formatting, TypeScript checking via tsc
- **TOML**: Taplo for formatting with .github/linters/.taplo.toml configuration
- **Commits**: Must pass pre-commit hooks (format, lint, typecheck)
- **Documentation**: Code changes require docs/ updates (bypass with SKIP_DOCS_CHECK=1)
- **CI Parity**: Always test `just lint` in a clean environment to match CI behavior
- **Biome Formatting**: Use explicit config path to avoid local/CI discrepancies:
  `bunx @biomejs/biome format --config-path .github/linters/biome.json --write <file>`

### Git Hooks

Pre-commit and pre-push hooks are versioned in `.githooks/` and installed via `git config core.hooksPath .githooks`.
They enforce:

- Code formatting and linting
- Type checking
- Documentation updates
- Secret scanning (Gitleaks)
- Path leak prevention

## Content System

### Grammar Rules (`server/content/bg_grammar_pack.json`)

- Structured grammar items with IDs, explanations, examples
- L1-specific contrast notes (Polish, Russian, Ukrainian, Serbian)
- Interactive drills with SRS intervals
- Error detection triggers

### Scenarios (`server/content/bg_scenarios_with_grammar.json`)

- Conversational scenarios bound to grammar concepts
- Automatic grammar integration via heuristics
- Level-appropriate content (A2-B2)

## Typography & UI

- **Font**: Ysabeau (Cyrillic-optimized, self-hosted in `client/assets/fonts/`)
- **Language**: HTML `lang="bg"` with `.bg-text` CSS class
- **Features**: Proper Bulgarian glyph forms via `font-feature-settings: "locl" 1`

## CI/CD

When ready to commit your work, you should also update the `docs/DONE.md` file to reflect completed features. Move
closed sections from `docs/TODO.md` to `docs/DONE.md` as necessary.

Three separate GitHub Actions workflows provide comprehensive validation:

### 1. **Lint Workflow** (`.github/workflows/lint.yml`)

- **Purpose**: Code quality and style validation using project tools
- **Tools**: ruff (Python), Biome (JavaScript/TypeScript), Prettier (Markdown), Justfile format checking
- **Dependencies**: Installs `uv sync` and `bun install` before linting to ensure clean environment parity
- **Execution**: `just lint` command for consistency with local development

### 2. **Super-Lint Workflow** (`.github/workflows/super-lint.yml`)

- **Purpose**: Additional validation using GitHub Super-Linter
- **Tools**: markdownlint, TOML validation, YAML validation, Dockerfile hadolint, Bash validation
- **Benefits**: Catches issues that local tools might miss, provides security and compliance checks
- **Separation**: Independent from main lint workflow to isolate failures and improve parallel execution

### 3. **Test Workflow** (`.github/workflows/test.yml`)

- **Purpose**: Backend testing with comprehensive coverage
- **Matrix**: Tests against Python 3.11 and 3.12
- **Components**:
  - Unit tests for all backend modules (ASR, TTS, LLM, grammar rules, content)
  - Integration tests for API endpoints and WebSocket connections
  - Coverage reporting with artifacts
  - System dependencies installation (eSpeak-NG for TTS tests)
- **Artifacts**: Test results and coverage reports uploaded for analysis

**All workflows:**

- Run on PRs and pushes to main branch
- Use **direct tool installation** (curl) instead of third-party GitHub Actions to avoid organizational restrictions
- Support parallel execution for faster feedback

## Security

- **Secret Scanning**: Gitleaks in pre-push hooks and optional CI
- **Path Leak Prevention**: Blocks absolute user paths in commits
- **Dependencies**: Regular security updates via Dependabot
- **Containers**: Prefers Chainguard minimal base images

## Key Files

- `justfile` - Build recipes and development commands (self-documenting with inline comments)
- `.githooks/pre-commit`, `.githooks/pre-push` - Versioned git hooks
- `server/requirements.txt` - Python dependencies
- `client/package.json` - JavaScript dependencies
- `docs/` - Living documentation (architecture, tech stack)
  - `docs/TODO.md` - Project roadmap and next steps
  - `docs/DONE.md` - Completed features and changes ⬅️ update this file regularly
- `.github/workflows/` - CI/CD pipeline definitions:
  - `lint.yml` - Code quality validation with project tools
  - `super-lint.yml` - Additional validation with GitHub Super-Linter
  - `test.yml` - Backend testing with coverage reporting

## Recent Updates (2025-08-26)

- Modernized build system with uv and Biome
- Enhanced Justfile with comprehensive recipes
- Fixed documentation inconsistencies
- Updated recipe naming for consistency (kebab-case)
- Corrected date references to 2025
- **Fixed CI/CD startup failures**: Resolved GitHub Actions organizational restrictions by replacing third-party actions
  with direct tool installation
- **Implemented comprehensive client-side testing infrastructure**: Added 68 passing tests with Vitest, Playwright, and
  comprehensive coverage
- **Resolved local/CI linting discrepancy**: Fixed vitest.config.js formatting to match CI Biome configuration (2-space
  indentation), ensuring local environment exactly matches CI requirements

## Development Philosophy

The project follows "secure by default, fast local feedback, automation first" principles:

- All quality checks run locally before commit/push
- Consistent tooling across team members via versioned hooks
- Comprehensive linting and formatting automation
- Security scanning integrated into workflow
- Living documentation kept in sync with code changes

## Critical Lessons Learned

### CI/CD in Enterprise Environments

- **GitHub Actions restrictions**: Organizations may block third-party actions not from verified publishers or same
  organization
- **startup_failure diagnosis**: Indicates workflow syntax/permission issues, not runtime errors
- **Direct installation approach**: Official tool installers (curl + official scripts) often more reliable than GitHub
  Actions
- **Path leak prevention**: Security scanners apply to CI workflow files, requiring relative paths
- **Alternative debugging**: When GitHub Actions fail with organizational restrictions, investigate direct installation
  methods
- **Clean environment testing**: CI failures often stem from missing dependencies that exist locally - always install
  dependencies explicitly in workflows

### Security-First Development

- Path leak scanning applies to all files, including CI workflows
- Organizational security policies can impact third-party integrations
- Official installers typically bypass security restrictions better than marketplace actions
- Local development parity with CI reduces debugging complexity

### Super-Linter v7 Configuration

- **Breaking change**: Cannot mix `VALIDATE_*: true` and `VALIDATE_*: false` settings
- **Configuration approach**: Either specify only true values (enable specific linters) OR only false values (disable
  specific linters)
- **Migration strategy**: Remove all false values and keep only positive validation settings
- **Error pattern**: "Behavior not supported, please either only include (VALIDATE=true) or exclude (VALIDATE=false)
  linters, but not both"
- **Best practice**: Use positive validation approach for clarity and maintainability

## Local-First Architecture Implications

### What This Means for Development

**DO**:

- Store all user progress in localStorage
- Implement SRS algorithm in JavaScript
- Keep backend stateless (no user sessions)
- Test with localStorage mocks
- Export/import user data as JSON

**DON'T**:

- Send user_id to backend (security risk)
- Store progress on server
- Implement authentication (not needed for MVP)
- Use database for user data
- Worry about data sync (future feature)

### Testing Strategy

**Frontend Tests**:

```javascript
// Mock localStorage for tests
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
```

**Backend Tests**:

- No database tests needed
- No progress endpoint tests needed
- Focus on ASR, TTS, LLM, content serving

### Future Migration Path

If/when authentication is needed:

1. Add OAuth2/JWT authentication
2. Create user accounts table (not progress)
3. Sync localStorage → server on login
4. Handle conflicts (last-write-wins)
5. Share progress via URL tokens

## Core Functionality Testing

The project includes comprehensive end-to-end testing via `just test-core-functionality` command that validates:

### Test Coverage (83% Pass Rate as of 2025-08-29)

1. **Development Server Launch** ✅
   - Frontend (Vite) on port 3000/5173
   - Backend (FastAPI) on port 8000
   - Hot reload functionality

2. **Typography & Fonts** ✅
   - Ysabeau font loading for Bulgarian Cyrillic
   - Proper font file serving

3. **WebSocket Connectivity** ⚠️
   - ASR WebSocket endpoint at /ws/asr
   - Currently returns 400 (needs investigation)

4. **Content System** ✅
   - Grammar packs API at /content/grammar/{id}
   - Scenarios API at /content/scenarios
   - Drill generation at /content/drills/{id}

5. **Text-to-Speech** ✅
   - TTS endpoint with URL-encoded Bulgarian text
   - eSpeak NG integration

6. **UI Components** ✅
   - TranscriptDisplay service for chat UI
   - LocalProgressService for SRS tracking

7. **ASR Model Warm-up** ✅
   - faster-whisper model initialization
   - Model preloading on startup

8. **Production Build** ⚠️
   - Build process validation
   - Currently failing (needs fix)

### Running Tests

```bash
# Run all core functionality tests
just test-core-functionality

# Individual test categories
just test        # Backend tests
just web-test    # Frontend tests
just lint        # Linting checks
```

### Test Implementation Notes

- Uses macOS-compatible commands (curl --max-time instead of timeout)
- URL-encodes Cyrillic text for API calls
- Checks both primary and alternate Vite ports
- Color-coded output for clear results
- Graceful handling of missing tools (websocat)
