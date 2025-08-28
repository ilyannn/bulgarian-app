# 📋 TODO - Bulgarian Voice Coach

Items remaining to be implemented from the original build plan and additional improvements needed.

## 🎯 Current Status

The Bulgarian Voice Coach has achieved major milestones:

- ✅ **Core Architecture Complete**: localStorage-based progress tracking, stateless backend
- ✅ **Content System Integrated**: Bulgarian grammar detection, SRS scheduling, interactive drills  
- ✅ **Frontend UX Enhanced**: Grammar chips, inline drills, audio visualization
- ✅ **Testing Infrastructure Solid**: 79+ frontend tests, comprehensive backend coverage

Most recently completed items have been moved to [DONE.md](./DONE.md)

## 1) Performance & Latency Optimization (High Priority)

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

## 2) Audio & Media Enhancements (Medium Priority)

### Audio Pipeline Improvements

- [ ] Enhance MediaSource integration for progressive audio
- [ ] Implement latency indicator

### Transcript Display Improvements

- [ ] Improve partial transcript display
- [ ] Add finalized transcript bubbles
- [ ] Add confidence indicators

## 3) Typography & Localization (Medium Priority)

### Language Features

- [ ] Add per-L1 selector (Polish/Russian/Ukrainian/Serbian)
- [ ] Implement contrast note switching based on L1
- [ ] Add localized UI elements
- [ ] Implement proper Bulgarian text normalization

## 4) Advanced Features (Low Priority)

### Mini-Lesson System

- [ ] Add mini-lesson display (2-3 minutes) for repeated errors
- [ ] Create micro-learning content for common error patterns
- [ ] Implement lesson completion tracking
- [ ] Add progress indicators for mini-lessons

### TTS Enhancement

- [ ] Research Piper TTS integration as eSpeak alternative
- [ ] Add voice selection options
- [ ] Implement cloud TTS fallback options
- [ ] Add prosody and emotion controls

### Data Privacy & Analytics

- [ ] Implement local transcript persistence
- [ ] Add opt-in analytics system
- [ ] Add GDPR-compliant data handling

### Content Management

- [ ] Add grammar pack validation tools
- [ ] Create content authoring interface
- [ ] Implement A/B testing for drill effectiveness
- [ ] Add content versioning system

## 5) Production Readiness

### Deployment

- [ ] Create Docker configuration
- [ ] Add production environment setup guide
- [ ] Implement health checks and monitoring
- [ ] Add logging and error tracking

### Installation & Troubleshooting

- [ ] Add troubleshooting guide for common setup issues

### Scalability

- [ ] Implement user authentication
- [ ] Add multi-user support
- [ ] Create admin interface for content management

## 6) Testing & Validation

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

## 7) Technical Debt

### Known Issues

- [ ] Address WebSocket connection handling edge cases

### Code Quality

- [ ] Improve error handling consistency across modules
- [ ] Add API documentation with OpenAPI specs

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
- **Frontend UX**: ✅ **COMPLETE** - Interactive grammar chips, drill interfaces, audio controls, error highlighting
- **Progress Tracking**: ✅ **COMPLETE** - localStorage-based SRS with full test coverage
- **Testing Infrastructure**: ✅ **COMPLETE** - 79+ frontend tests, comprehensive backend coverage
- **Production Ready**: 🔄 **PARTIAL** - Observability done, needs deployment automation

## 🎯 Next Priorities

1. **Performance Optimization**: Reduce end-to-end latency to 1.2-2.0s target
2. **Audio Enhancements**: Progressive audio loading, latency indicators
3. **Transcript Polish**: Partial display, confidence indicators
4. **Mini-Lessons**: 2-3 minute focused error remediation  
5. **Production Deployment**: Docker config, health checks, monitoring
