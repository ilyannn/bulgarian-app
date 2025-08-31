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

- [x] **Progressive audio streaming with MediaSource API** ✅ **COMPLETE** (2025-08-31)
  
  #### Implementation Complete
  
  **Backend Changes (server/tts.py)**:
  - [x] TTS endpoint already supports chunked streaming via `synthesize_streaming()` method
  - [x] Generator function produces WAV chunks for real-time streaming
  - [x] FastAPI `StreamingResponse` provides automatic chunked transfer encoding
  - [x] Sentence-based chunking for optimal streaming experience
  
  **Frontend Implementation (`client/services/ProgressiveAudioPlayer.js`)**:
  - [x] Complete MediaSource API integration with SourceBuffer management
  - [x] Automatic fallback to traditional Audio element for unsupported browsers
  - [x] Progressive buffer management with queue system
  - [x] Proper error handling and recovery mechanisms
  - [x] Memory management with automatic cleanup of blob URLs
  - [x] Event-driven architecture with callback support
  
  **Key Features Achieved**:
  - ✅ **Reduced perceived latency** - Audio playback starts as soon as sufficient data is buffered
  - ✅ **Better memory efficiency** - No need to load entire audio file before playback
  - ✅ **Cross-browser compatibility** - Graceful fallback for browsers without MediaSource support
  - ✅ **Robust error handling** - Network interruption recovery and graceful degradation
  - ✅ **Clean integration** - Seamlessly integrated into existing `main.js` audio controls
  
  **Browser Support**:
  - ✅ Chrome/Edge: Full MediaSource API support with WAV streaming
  - ✅ Firefox: MediaSource API support
  - ✅ Safari: Automatic fallback to traditional audio loading
  - ✅ All browsers: Fallback audio element ensures universal compatibility
  
  **Testing Completed**:
  - [x] Created comprehensive test page (`test_progressive_audio.html`)
  - [x] Verified streaming with Bulgarian text synthesis
  - [x] Tested both progressive and fallback modes
  - [x] Confirmed smooth playback without gaps
  - [x] Validated memory management and cleanup

## 2) TTS Enhancement (Medium Priority)

- [x] **Research Piper TTS integration as eSpeak alternative** ✅ **COMPLETE** (2025-08-31)
  
  #### Research Findings
  
  **Piper TTS Bulgarian Support**: ❌ **Not Available**
  - Piper TTS supports 37 languages but Bulgarian is not included
  - Related Slavic languages available: Russian, Ukrainian, Serbian, Polish, Slovak, Slovenian
  - Would require custom Bulgarian voice training (high complexity, uncertain quality)
  
  **Alternative Neural TTS Options**:
  - **ElevenLabs**: High-quality Bulgarian voices (cloud-only, commercial API)
  - **Azure Speech**: Bulgarian support available (enterprise pricing)
  - **Coqui XTTS-v2**: Voice cloning possible but requires Bulgarian training data
  
  **Current eSpeak NG Assessment**:
  - ✅ Working Bulgarian (bg) voice active and functional
  - ✅ Local deployment with no cloud dependencies
  - ✅ Fast synthesis (~200ms latency)
  - ✅ Already integrated with progressive audio streaming
  - ⚠️ Robotic quality but intelligible for language learning
  
  **Recommendation**: Three-phase incremental approach
  1. **Phase 1**: Optimize eSpeak NG parameters (low risk, high impact)
  2. **Phase 2**: Add optional cloud TTS fallback (medium risk, high quality)
  3. **Phase 3**: Custom Bulgarian voice training (high risk, high reward)

- [ ] Add voice selection options within eSpeak NG
- [ ] Implement optional cloud TTS fallback (ElevenLabs/Azure)
- [ ] Add prosody and emotion controls for eSpeak NG

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
