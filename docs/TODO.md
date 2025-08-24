# 📋 TODO - Bulgarian Voice Coach

Items remaining to be implemented from the original build plan and additional improvements needed.

## 🎉 Recently Completed (2025-08-24)

### Development Tooling & Code Quality ✅

- [x] **Enhanced diagnostics integration**: Added `just diagnostics` command matching Zed editor LSP behavior
- [x] **Type safety overhaul**: Fixed 40+ diagnostic errors, achieved 0 errors/0 warnings with pyright
- [x] **FastAPI modernization**: Migrated from deprecated `on_event` to modern `lifespan` context manager
- [x] **Pydantic updates**: Replaced deprecated `.dict()` with `.model_dump()` for v2 compatibility
- [x] **Test suite fixes**: Resolved parameter mismatches, None argument issues, and import symbol errors
- [x] **ty type checker integration**: Added experimental ty checker to lint workflow with proper configuration
- [x] **OpenAI/Anthropic API compatibility**: Fixed type-safe message formatting and content block access

### Development Workflow Improvements ✅

- [x] **Enhanced Justfile**: Added comprehensive diagnostics, improved recipe organization
- [x] **pyright configuration**: Strict type checking mode with comprehensive reporting rules
- [x] **Git hooks integration**: Versioned hooks in `.githooks/` with proper documentation
- [x] **Multi-checker setup**: Both pyright (reference) and ty (fast) type checkers configured

### Content System Discovery ✅

- [x] **Grammar pack exists**: Found comprehensive `content/bg_grammar_pack.json` with Bulgarian grammar rules
- [x] **Scenarios exist**: Found `content/bg_scenarios_with_grammar.json` with A2-B2 conversational scenarios
- [x] **L1 contrast notes**: All files include Polish/Russian/Ukrainian/Serbian language contrasts
- [x] **SRS structure**: Grammar pack includes drill definitions and spaced repetition data

---

## 1) Content System (High Priority)

### Grammar Pack & Scenarios ✅ **PARTIALLY COMPLETE**

- [x] ~~Create `server/content/bg_grammar_pack.json` with grammar items~~ ✅ **EXISTS** (in `content/`)
  - [x] ~~Implement grammar items with `id`, `micro_explanation_bg`, `contrast_notes`~~ ✅ **DONE**
  - [x] ~~Add L1-specific contrast notes (Polish, Russian, Ukrainian, Serbian)~~ ✅ **DONE**
  - [x] ~~Include `examples`, `drills`, and `srs` data structures~~ ✅ **DONE**
  - [x] ~~Add `triggers` for error detection integration~~ ✅ **DONE**

- [x] ~~Create `server/content/bg_scenarios_with_grammar.json`~~ ✅ **EXISTS** (in `content/`)
  - [x] ~~Scenarios with grammar bindings (`primary`, `secondary` grammar IDs)~~ ✅ **DONE**
  - [x] ~~Implement `binding_method: "auto-heuristic-v1"`~~ ✅ **DONE**
  - [x] ~~Add conversational scenarios for A2-B2 levels~~ ✅ **DONE**

### Content Integration ✅ **COMPLETED**

- [x] ~~**Move content files to correct location**: `content/*.json` → `server/content/*.json`~~ ✅ **DONE**
- [x] ~~**Fix path references**: Update content loading to handle new JSON format~~ ✅ **DONE**

### Content Loading & Endpoints ✅ **PARTIALLY COMPLETE**

- [x] ~~Implement content loading functions in `server/content/__init__.py`~~ ✅ **DONE**
  - [x] ~~`load_grammar_pack()` function~~ ✅ **DONE**
  - [x] ~~`load_scenarios()` function~~ ✅ **DONE**
  - [x] ~~`get_grammar_item(id)` function~~ ✅ **DONE**
  - [x] ~~`get_next_lesson(user_id)` for SRS functionality~~ ✅ **DONE**

- [x] ~~Add missing content endpoints in `app.py`~~ ✅ **COMPLETED**
  - [x] ~~`GET /content/lesson/next` - SRS-based lesson queue~~ ✅ **DONE** (already existed)
  - [x] ~~Integrate grammar lookup in chat responses~~ ✅ **COMPLETED**
  - [x] ~~Add drill generation based on error tags~~ ✅ **COMPLETED**
  - [x] ~~Add `GET /content/drills/{grammar_id}` for grammar-specific drills~~ ✅ **NEW**
  - [x] ~~Add `POST /content/analyze` for comprehensive text analysis~~ ✅ **NEW**

## 2) Grammar Rule Detection (Medium Priority)

### Enhanced bg_rules.py ✅ **COMPLETED**

- [x] ~~Implement comprehensive Bulgarian grammar detection~~ ✅ **COMPLETED**
  - [x] ~~Definite article errors (missing postposed articles)~~ ✅ **COMPLETED**
  - [x] ~~Clitic position errors~~ ✅ **COMPLETED**
  - [x] ~~Infinitive usage (да + present tense validation)~~ ✅ **COMPLETED**
  - [x] ~~Future tense with ще validation~~ ✅ **COMPLETED**
  - [x] ~~Agreement errors (noun-adjective, subject-verb)~~ ✅ **COMPLETED**

- [x] ~~Error tag system~~ ✅ **COMPLETED**
  - [x] ~~Map detected errors to grammar pack IDs~~ ✅ **COMPLETED**
  - [x] ~~Generate correction suggestions~~ ✅ **COMPLETED**
  - [x] ~~Include position information for highlighting~~ ✅ **COMPLETED**

## 3) Chat Integration & AI Responses

### Process User Input Enhancement ✅ **COMPLETED**

- [x] ~~Integrate grammar error detection with chat responses~~ ✅ **COMPLETED**
- [x] ~~Generate contextual corrections with before/after examples~~ ✅ **COMPLETED**
- [x] ~~Add contrastive notes based on user's L1 background~~ ✅ **COMPLETED**
- [x] ~~Implement drill suggestions based on detected errors~~ ✅ **COMPLETED**

### CoachResponse Enhancement ✅ **COMPLETED**

- [x] ~~Add `drills[]` field population~~ ✅ **COMPLETED**
- [x] ~~Implement micro-drill generation~~ ✅ **COMPLETED**
- [x] ~~Add grammar chip recommendations~~ ✅ **COMPLETED** (via contrastive_note)
- [x] ~~Integrate SRS timing for drill suggestions~~ ✅ **COMPLETED**

## 4) Spaced Repetition System (SRS)

### User Progress Tracking

- [ ] Implement user state persistence (SQLite for MVP)
- [ ] Add user mastery counters per grammar item
- [ ] Implement SRS interval progression `[1,3,7,21]` days
- [ ] Add next-due timestamp tracking

### Drill System

- [ ] Implement drill types: `transform`, `fill`, `reorder`
- [ ] Add drill correctness validation
- [ ] Update SRS intervals based on user performance
- [ ] Generate warm-up drills for app startup

## 5) Frontend UX Enhancement

### Interactive Elements

- [ ] Add grammar chips with tap-to-expand functionality
- [ ] Implement inline drill interface (10-20 seconds each)
- [ ] Add mini-lesson display (2-3 minutes) for repeated errors
- [ ] Create level meter for audio input

### Audio Playback

- [ ] Enhance MediaSource integration for progressive audio
- [ ] Add audio playback controls
- [ ] Implement latency indicator
- [ ] Add "Play reply" button functionality

### Transcript Enhancement

- [ ] Improve partial transcript display
- [ ] Add finalized transcript bubbles
- [ ] Implement error highlighting in transcripts
- [ ] Add confidence indicators

## 6) Performance & Latency Optimization

### Audio Pipeline

- [ ] Optimize for 1.2-2.0s end-to-end latency target
- [ ] Fine-tune VAD tail timing (200-400ms)
- [ ] Optimize ASR model selection and parameters
- [ ] Improve WebSocket frame handling

### ASR Configuration

- [ ] Implement environment-based model path configuration
- [ ] Add `no_speech_threshold` tuning
- [ ] Optimize beam_size and temperature parameters
- [ ] Add retry logic for no-speech scenarios

## 7) Typography & Localization

### Font Implementation

- [ ] Download and integrate Ysabeau font files
- [ ] Test Bulgarian-specific glyph rendering
- [ ] Implement fallback font stack
- [ ] Add font loading optimization

### Language Features

- [ ] Add per-L1 selector (Polish/Russian/Ukrainian/Serbian)
- [ ] Implement contrast note switching based on L1
- [ ] Add localized UI elements
- [ ] Implement proper Bulgarian text normalization

## 8) Environment & Configuration

### Environment Variables

- [ ] Add `.env.example` file with all required variables
- [ ] Document model path configuration
- [ ] Add LLM API key configuration guidance
- [ ] Implement environment validation on startup

### Installation Scripts

- [ ] Add eSpeak NG installation instructions per platform
- [ ] Create setup verification script
- [ ] Add troubleshooting guide for common issues

## 9) Advanced Features

### TTS Enhancement

- [ ] Research Piper TTS integration as eSpeak alternative
- [ ] Add voice selection options
- [ ] Implement cloud TTS fallback options
- [ ] Add prosody and emotion controls

### Data Privacy & Analytics

- [ ] Implement local transcript persistence
- [ ] Add opt-in analytics system
- [ ] Create progress export functionality
- [ ] Add GDPR-compliant data handling

### Content Management

- [ ] Add grammar pack validation tools
- [ ] Create content authoring interface
- [ ] Implement A/B testing for drill effectiveness
- [ ] Add content versioning system

## 10) Production Readiness

### Deployment

- [ ] Create Docker configuration
- [ ] Add production environment setup guide
- [ ] Implement health checks and monitoring
- [ ] Add logging and error tracking

### Scalability

- [ ] Add database migration system
- [ ] Implement user authentication
- [ ] Add multi-user support
- [ ] Create admin interface for content management

## 11) Acceptance Criteria Validation

### Core Functionality Tests

- [ ] Validate `just dev` launches with hot reload
- [ ] Test short Bulgarian utterance processing (<1s partials, ~1s final)
- [ ] Verify error detection shows chips and micro-drills
- [ ] Test SRS warm-up on app startup
- [ ] Validate `just serve` production stack
- [ ] Ensure Bulgarian text renders with Ysabeau font

### Performance Benchmarks

- [ ] Measure end-to-end latency under various conditions
- [ ] Test ASR accuracy with different Bulgarian dialects
- [ ] Validate grammar detection precision and recall
- [ ] Benchmark TTS generation speed and quality

## 12) Bug Fixes & Technical Debt

### Known Issues

- [x] ~~Fix FastAPI deprecation warnings (on_event → lifespan)~~ ✅ **COMPLETED**
- [x] ~~Resolve Pydantic model.dict() deprecation~~ ✅ **COMPLETED**
- [ ] Address WebSocket connection handling edge cases
- [x] ~~Fix import resolution issues in test modules~~ ✅ **COMPLETED**

### Code Quality

- [ ] Improve error handling consistency across modules
- [ ] Add comprehensive logging throughout the system
- [ ] Implement proper configuration management
- [ ] Add API documentation with OpenAPI specs
- [x] ~~Add comprehensive type checking with pyright/ty integration~~ ✅ **COMPLETED**
- [x] ~~Fix all diagnostic warnings and type errors~~ ✅ **COMPLETED**

---

## Priority Levels:

- **🔥 High Priority**: Content system, grammar detection, basic SRS
- **⚡ Medium Priority**: Frontend UX, audio optimization, environment setup
- **🌟 Low Priority**: Advanced features, production deployment, analytics

## 📊 Progress Summary

- **Development Infrastructure**: ✅ **COMPLETE** - Modern tooling, type safety, diagnostics
- **Core Application Structure**: ✅ **COMPLETE** - FastAPI, WebSocket, AI integration with enhanced endpoints
- **Content System**: ✅ **COMPLETE** - Grammar packs & scenarios integrated, SRS functional
- **Grammar Detection**: ✅ **COMPLETE** - Enhanced with real Bulgarian rules, content integration
- **Chat Integration**: ✅ **COMPLETE** - Grammar detection integrated with drill generation
- **Frontend UX**: 🔄 **PARTIAL** - Audio pipeline working, needs interactive elements
- **Production Ready**: ❌ **TODO** - Deployment, monitoring, scalability

## 🎯 Next Priority: Frontend UX Enhancement

With grammar detection and content integration now complete, the next logical priorities are:

1. Implement interactive frontend elements for drills and grammar chips
2. Add audio optimization and latency improvements
3. Enhance transcript display with error highlighting
4. Add user progress tracking and SRS state persistence
