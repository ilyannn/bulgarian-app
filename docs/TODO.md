# 📋 TODO - Bulgarian Voice Coach

Items remaining to be implemented from the original build plan and additional improvements needed.

## 1) Content System (High Priority)

### Grammar Pack & Scenarios
- [ ] Create `server/content/bg_grammar_pack.json` with grammar items
  - [ ] Implement grammar items with `id`, `micro_explanation_bg`, `contrast_notes`
  - [ ] Add L1-specific contrast notes (Polish, Russian, Ukrainian, Serbian)
  - [ ] Include `examples`, `drills`, and `srs` data structures
  - [ ] Add `triggers` for error detection integration

- [ ] Create `server/content/bg_scenarios_with_grammar.json`
  - [ ] Scenarios with grammar bindings (`primary`, `secondary` grammar IDs)
  - [ ] Implement `binding_method: "auto-heuristic-v1"`
  - [ ] Add conversational scenarios for A2-B2 levels

### Content Loading & Endpoints
- [ ] Implement content loading functions in `server/content/__init__.py`
  - [ ] `load_grammar_pack()` function
  - [ ] `load_scenarios()` function  
  - [ ] `get_grammar_item(id)` function
  - [ ] `get_next_lesson(user_id)` for SRS functionality

- [ ] Add missing content endpoints in `app.py`
  - [ ] `GET /content/lesson/next` - SRS-based lesson queue
  - [ ] Integrate grammar lookup in chat responses
  - [ ] Add drill generation based on error tags

## 2) Grammar Rule Detection (Medium Priority)

### Enhanced bg_rules.py
- [ ] Implement comprehensive Bulgarian grammar detection
  - [ ] Definite article errors (missing postposed articles)
  - [ ] Clitic position errors
  - [ ] Infinitive usage (да + present tense validation)
  - [ ] Future tense with ще validation
  - [ ] Agreement errors (noun-adjective, subject-verb)

- [ ] Error tag system
  - [ ] Map detected errors to grammar pack IDs
  - [ ] Generate correction suggestions
  - [ ] Include position information for highlighting

## 3) Chat Integration & AI Responses

### Process User Input Enhancement
- [ ] Integrate grammar error detection with chat responses
- [ ] Generate contextual corrections with before/after examples
- [ ] Add contrastive notes based on user's L1 background
- [ ] Implement drill suggestions based on detected errors

### CoachResponse Enhancement
- [ ] Add `drills[]` field population
- [ ] Implement micro-drill generation
- [ ] Add grammar chip recommendations
- [ ] Integrate SRS timing for drill suggestions

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
- [ ] Fix FastAPI deprecation warnings (on_event → lifespan)
- [ ] Resolve Pydantic model.dict() deprecation
- [ ] Address WebSocket connection handling edge cases
- [ ] Fix import resolution issues in test modules

### Code Quality
- [ ] Improve error handling consistency across modules
- [ ] Add comprehensive logging throughout the system
- [ ] Implement proper configuration management
- [ ] Add API documentation with OpenAPI specs

---

## Priority Levels:
- **🔥 High Priority**: Content system, grammar detection, basic SRS
- **⚡ Medium Priority**: Frontend UX, audio optimization, environment setup  
- **🌟 Low Priority**: Advanced features, production deployment, analytics