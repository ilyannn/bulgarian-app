# Bulgarian Voice Coach - Project Guide

This document summarizes the Bulgarian Voice Coach project's architecture, build system, and development workflow.

## Project Overview

A voice-enabled web application for teaching Bulgarian to Slavic speakers, featuring:
- Real-time speech recognition and synthesis
- Grammar error detection with contextual corrections
- Interactive drills with spaced repetition system (SRS)
- Bulgarian typography support

## Architecture

### Backend (Python FastAPI)
- `server/app.py` - Main FastAPI application with WebSocket support
- `server/asr.py` - faster-whisper ASR with WebRTC VAD
- `server/tts.py` - eSpeak NG for Bulgarian text-to-speech
- `server/llm.py` - ChatProvider interface with Claude/OpenAI support
- `server/bg_rules.py` - Bulgarian grammar rule detection
- `server/content/` - Grammar packs and scenario data (JSON)

### Frontend (Vite + Vanilla JS)
- `client/index.html` - Main UI with mic controls and transcript display
- `client/main.js` - WebSocket client and audio handling
- `client/audio-worklet.js` - Real-time audio capture (16kHz PCM)

### Key Features
- **Latency Target**: ~1.2-2.0s end-to-end (VAD → ASR → LLM → TTS)
- **Audio Pipeline**: getUserMedia → AudioWorklet → WebSocket → faster-whisper
- **Grammar Integration**: Real-time error detection with contextual micro-lessons
- **Typography**: Ysabeau font for proper Bulgarian Cyrillic rendering

## Build System (Justfile)

The project uses `just` as the command runner. Key recipes:

### Development
- `just install` - Install all dependencies (Python via uv, client via bun, git hooks)
- `just dev` - Start both backend and frontend servers
- `just serve` - Production-like deployment

### Code Quality  
- `just lint` - Run all linting (Python ruff, JavaScript Biome, Justfile format)
- `just format` - Auto-format all code
- `just test` - Run test suite
- `just build` - Build packages

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
- **Commits**: Must pass pre-commit hooks (format, lint, typecheck)
- **Documentation**: Code changes require docs/ updates (bypass with SKIP_DOCS_CHECK=1)

### Git Hooks
Pre-commit and pre-push hooks are versioned in `.githooks/` and installed via `git config core.hooksPath .githooks`. They enforce:
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

GitHub Actions workflow (`.github/workflows/lint.yml`) runs:
- Local linting tools (ruff, Biome, Prettier)
- Super-Linter for additional validation
- Runs on PRs and pushes to main branch

## Security

- **Secret Scanning**: Gitleaks in pre-push hooks and optional CI
- **Path Leak Prevention**: Blocks `/Users/` and `~/` paths in commits
- **Dependencies**: Regular security updates via Dependabot
- **Containers**: Prefers Chainguard minimal base images

## Key Files

- `justfile` - Build recipes and development commands (self-documenting with inline comments)
- `.githooks/pre-commit`, `.githooks/pre-push` - Versioned git hooks
- `server/requirements.txt` - Python dependencies
- `client/package.json` - JavaScript dependencies  
- `docs/` - Living documentation (architecture, tech stack)

## Recent Updates (2025-08-24)

- Modernized build system with uv and Biome
- Enhanced Justfile with comprehensive recipes
- Fixed documentation inconsistencies
- Updated recipe naming for consistency (kebab-case)
- Corrected date references to 2025

## Development Philosophy

The project follows "secure by default, fast local feedback, automation first" principles:
- All quality checks run locally before commit/push
- Consistent tooling across team members via versioned hooks
- Comprehensive linting and formatting automation
- Security scanning integrated into workflow
- Living documentation kept in sync with code changes