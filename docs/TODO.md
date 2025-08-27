# 📋 TODO - Bulgarian Voice Coach

Items remaining to be implemented from the original build plan and additional improvements needed.

## 🎉 Recently Completed

### Interactive Frontend Components (2025-08-26) ✅

- [x] **Grammar Chips UI**: Interactive tap-to-expand grammar error visualization with 34 comprehensive tests
- [x] **Inline Drill Interface**: 20-second timed practice drills with hint system and 41 comprehensive tests
- [x] **Integration & Testing**: Seamlessly integrated both components with comprehensive test coverage (75 total tests)
- [x] **Code Quality**: Fixed all linting issues, ensured XSS protection, and maintained performance standards
- [x] **Event-Driven Architecture**: Custom event dispatching for component communication and workflow integration

### Development Tooling & Code Quality (2025-08-24) ✅

- [x] **Enhanced diagnostics integration**: Added `just diagnostics` command matching Zed editor LSP behavior
- [x] **Type safety overhaul**: Fixed 40+ diagnostic errors, achieved 0 errors/0 warnings with pyright
- [x] **FastAPI modernization**: Migrated from deprecated `on_event` to modern `lifespan` context manager
- [x] **Pydantic updates**: Replaced deprecated `.dict()` with `.model_dump()` for v2 compatibility
- [x] **Test suite fixes**: Resolved parameter mismatches, None argument issues, and import symbol errors
- [x] **ty type checker integration**: Added experimental ty checker to lint workflow with proper configuration
- [x] **OpenAI/Anthropic API compatibility**: Fixed type-safe message formatting and content block access

### OpenTelemetry Observability Integration ✅

- [x] **Comprehensive telemetry setup**: Added OpenTelemetry SDK with traces, metrics, and automatic instrumentation
- [x] **Custom metrics for voice coaching**: Audio processing duration, WebSocket connections, LLM token usage tracking
- [x] **Production observability**: OTLP export support for Jaeger, Honeycomb, and other monitoring platforms
- [x] **Development debugging**: Console export mode with `just dev-telemetry` recipe for local observability
- [x] **Environment configuration**: Extended .env.example with OpenTelemetry settings and validation

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

### User Progress Tracking ✅ **COMPLETED (2025-08-27)**

- [x] ~~Implement user state persistence (SQLite for MVP)~~ ✅ **COMPLETED** - Full async SQLite with aiosqlite
- [x] ~~Add user mastery counters per grammar item~~ ✅ **COMPLETED** - 6-level mastery system (0-5)
- [x] ~~Implement SRS interval progression `[1,3,7,21]` days~~ ✅ **COMPLETED** - Enhanced to `[1,3,7,21,60,120]` days
- [x] ~~Add next-due timestamp tracking~~ ✅ **COMPLETED** - Full due date scheduling with timezone support

### Drill System ✅ **COMPLETED (2025-08-27)**

- [x] ~~Implement drill types: `transform`, `fill`, `reorder`~~ ✅ **COMPLETED** - All types supported in database
- [x] ~~Add drill correctness validation~~ ✅ **COMPLETED** - With hint-aware scoring
- [x] ~~Update SRS intervals based on user performance~~ ✅ **COMPLETED** - Dynamic mastery progression
- [x] ~~Generate warm-up drills for app startup~~ ✅ **COMPLETED** - Interactive warm-up interface with SRS due items

## 5) Frontend UX Enhancement ✅ **SUBSTANTIALLY COMPLETED (2025-08-27)**

### Interactive Elements ✅ **COMPLETED (2025-08-26)**

- [x] ~~Add grammar chips with tap-to-expand functionality~~ ✅ **COMPLETED** - Interactive component with severity
      color coding
- [x] ~~Implement inline drill interface (10-20 seconds each)~~ ✅ **COMPLETED** - 20-second timed drills with hints and
      progress tracking
- [ ] Add mini-lesson display (2-3 minutes) for repeated errors
- [x] ~~Create level meter for audio input~~ ✅ **COMPLETED (2025-08-27)** - Real-time visualization with dynamic
      colors, smoothing, peak detection

### Audio Playback ✅ **COMPLETED (2025-08-27)**

- [ ] Enhance MediaSource integration for progressive audio
- [x] ~~Add audio playback controls~~ ✅ **COMPLETED** - Play/pause/replay/stop with state management
- [ ] Implement latency indicator
- [x] ~~Add "Play reply" button functionality~~ ✅ **COMPLETED** - Enhanced with comprehensive controls

### Transcript Enhancement ✅ **PARTIALLY COMPLETED (2025-08-27)**

- [ ] Improve partial transcript display
- [ ] Add finalized transcript bubbles
- [x] ~~Implement error highlighting in transcripts~~ ✅ **COMPLETED** - Interactive highlighting with tooltips and
      color coding
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

### Font Implementation ✅ **COMPLETED (2025-08-24)**

- [x] ~~Download and integrate Ysabeau font files~~ ✅ **COMPLETED**
- [x] ~~Test Bulgarian-specific glyph rendering~~ ✅ **COMPLETED**
- [x] ~~Implement fallback font stack~~ ✅ **COMPLETED**
- [x] ~~Add font loading optimization~~ ✅ **COMPLETED**

### Language Features

- [ ] Add per-L1 selector (Polish/Russian/Ukrainian/Serbian)
- [ ] Implement contrast note switching based on L1
- [ ] Add localized UI elements
- [ ] Implement proper Bulgarian text normalization

## 8) Environment & Configuration ✅ **COMPLETED (2025-08-24)**

### Environment Variables ✅ **COMPLETED**

- [x] ~~Add `.env.example` file with all required variables~~ ✅ **COMPLETED**
- [x] ~~Document model path configuration~~ ✅ **COMPLETED**
- [x] ~~Add LLM API key configuration guidance~~ ✅ **COMPLETED**
- [x] ~~Implement environment validation on startup~~ ✅ **COMPLETED**

### Installation Scripts ✅ **COMPLETED**

- [x] ~~Add eSpeak NG installation instructions per platform~~ ✅ **COMPLETED** (in justfile)
- [x] ~~Create setup verification script~~ ✅ **COMPLETED**
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
- [x] ~~Add comprehensive logging throughout the system~~ ✅ **COMPLETED** (2025-08-24)
- [x] ~~Implement proper configuration management~~ ✅ **COMPLETED** (2025-08-24)
- [ ] Add API documentation with OpenAPI specs
- [x] ~~Add comprehensive type checking with pyright/ty integration~~ ✅ **COMPLETED**
- [x] ~~Fix all diagnostic warnings and type errors~~ ✅ **COMPLETED**

---

## Priority Levels

- **🔥 High Priority**: Content system, grammar detection, basic SRS
- **⚡ Medium Priority**: Frontend UX, audio optimization, environment setup
- **🌟 Low Priority**: Advanced features, production deployment, analytics

## 📊 Progress Summary

- **Development Infrastructure**: ✅ **COMPLETE** - Modern tooling, type safety, diagnostics, observability
- **Core Application Structure**: ✅ **COMPLETE** - FastAPI, WebSocket, AI integration with enhanced endpoints
- **Content System**: ✅ **COMPLETE** - Grammar packs & scenarios integrated, SRS functional
- **Grammar Detection**: ✅ **COMPLETE** - Enhanced with real Bulgarian rules, content integration
- **Chat Integration**: ✅ **COMPLETE** - Grammar detection integrated with drill generation
- **Observability & Monitoring**: ✅ **COMPLETE** - OpenTelemetry instrumentation, logging, metrics
- **Frontend UX**: 🔄 **SUBSTANTIAL** - Interactive grammar chips & drill interfaces completed, needs audio enhancements
- **Production Ready**: 🔄 **PARTIAL** - Observability done, needs deployment automation

## 🎯 Next Priority: Frontend UX Enhancement

With grammar detection, content integration, and observability now complete, the next logical priorities are:

1. Implement interactive frontend elements for drills and grammar chips
2. Add audio optimization and latency improvements
3. Enhance transcript display with error highlighting
4. Add user progress tracking and SRS state persistence
5. Leverage OpenTelemetry metrics to optimize audio processing pipeline latency
