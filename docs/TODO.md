# 📋 TODO - Bulgarian Voice Coach

Items remaining to be implemented from the original build plan and additional improvements needed.

## 🎯 Current Status

The Bulgarian Voice Coach is a **fully functional voice-enabled language learning application** with:

### ✅ Core Features Working

- **Real-time Speech Recognition**: Whisper-based ASR with VAD for Bulgarian speech
- **Grammar Error Detection**: 40+ Bulgarian grammar rules with contextual corrections
- **Interactive Learning**: Micro-drills, mini-lessons, and spaced repetition (SRS)
- **Text-to-Speech**: eSpeak NG for Bulgarian pronunciation feedback
- **Multi-L1 Support**: Tailored feedback for Polish, Russian, Ukrainian, Serbian speakers

### ✅ Technical Excellence

- **Local-First Architecture**: All progress stored in localStorage, no auth needed
- **WebSocket Communication**: Real-time audio streaming and processing
- **Docker Ready**: Production & dev containers with Bun and Wolfi-based images
- **Comprehensive Testing**: 79+ frontend tests, full backend coverage
- **API Documentation**: Complete OpenAPI specification
- **Health Monitoring**: Health checks, logging, error handling

### 🚀 Ready For

- Local development (`just dev`)
- Docker deployment (`docker-compose up`)
- Single-user learning sessions
- Bulgarian language practice with immediate feedback

### ⏳ Not Yet Available

- Cloud deployment (needs deployment guide)
- Multi-user support (by design - local-first)
- Advanced TTS voices (still using eSpeak)
- Usage analytics (privacy-first approach)
- Progressive audio streaming (uses full audio chunks)

Most recently completed items have been moved to [DONE.md](./DONE.md)

## 1) Audio & Media Enhancements (High Priority)

### Audio Pipeline Improvements

- [ ] Enhance MediaSource integration for progressive audio

## 2) TTS Enhancement (Medium Priority)

- [ ] Research Piper TTS integration as eSpeak alternative
- [ ] Add voice selection options
- [ ] Implement cloud TTS fallback options
- [ ] Add prosody and emotion controls

## 3) Data Privacy & Analytics (Medium Priority)

- [ ] Implement local transcript persistence
- [ ] Add opt-in analytics system
- [ ] Add GDPR-compliant data handling

## 4) Content Management (Low Priority)

- [ ] Add grammar pack validation tools
- [ ] Create content authoring interface
- [ ] Implement A/B testing for drill effectiveness
- [ ] Add content versioning system

## 5) Production Readiness

### Deployment

- [ ] Add production environment setup guide
- [ ] Add error tracking service integration (e.g., Sentry, Rollbar)

### Installation & Troubleshooting

- [ ] Add troubleshooting guide for common setup issues

### Scalability

- [ ] Implement user authentication
- [ ] Add multi-user support
- [ ] Create admin interface for content management

## 6) Testing & Validation

### Performance Benchmarks

- [ ] Measure end-to-end latency under various conditions
- [ ] Test ASR accuracy with different Bulgarian dialects
- [ ] Validate grammar detection precision and recall
- [ ] Benchmark TTS generation speed and quality

## 7) Technical Debt

### Code Quality

- [ ] Improve error handling consistency across modules

---

## Priority Levels

- **🔥 High Priority**: Audio enhancements, production deployment
- **⚡ Medium Priority**: TTS improvements, privacy features, analytics
- **🌟 Low Priority**: Content management, scalability features

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
- **Performance Optimization**: ✅ **COMPLETE** - All latency targets achieved
- **Localization**: ✅ **COMPLETE** - Bulgarian text normalization, L1 support
- **Containerization**: ✅ **COMPLETE** - Docker with Wolfi and Bun
- **Health Monitoring**: ✅ **COMPLETE** - Health checks, logging, WebSocket error handling
- **API Documentation**: ✅ **COMPLETE** - Full OpenAPI specification at docs/api/openapi.json
- **Production Ready**: 🔄 **PARTIAL** - Docker done, health checks done, needs deployment guide & error tracking

## 🎯 Next Priorities

1. **Audio Enhancements**: Progressive audio loading with MediaSource API
2. **TTS Improvements**: Research Piper TTS for better Bulgarian speech
3. **Production Deployment**: Setup guides, health checks, monitoring
4. **Privacy Features**: Local persistence, GDPR compliance
5. **Performance Benchmarking**: Measure and optimize real-world usage
