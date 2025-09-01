# TTS Research Findings

## Piper TTS Integration Research (2025-08-31)

### Executive Summary

**Piper TTS Bulgarian Support**: ❌ **Not Available**

After thorough research, Piper TTS does not support Bulgarian language. While it supports 37 languages including several
Slavic languages (Russian, Ukrainian, Serbian, Polish, Slovak, Slovenian), Bulgarian is notably absent.

### Key Findings

#### Piper TTS Language Support

- **Total Languages**: 37
- **Slavic Languages Available**: Russian, Ukrainian, Serbian, Polish, Slovak, Slovenian
- **Bulgarian Support**: None
- **Custom Training Required**: Would need custom Bulgarian voice training (high complexity, uncertain quality)

#### Alternative Neural TTS Options

1. **ElevenLabs**
   - ✅ High-quality Bulgarian voices available
   - ❌ Cloud-only (no local deployment)
   - ❌ Commercial API with usage costs
   - Best for: Production apps with budget for API costs

2. **Azure Speech Services**
   - ✅ Bulgarian support available
   - ❌ Enterprise pricing model
   - ❌ Cloud dependency
   - Best for: Enterprise applications

3. **Coqui XTTS-v2**
   - ✅ Voice cloning capabilities
   - ❌ Requires Bulgarian training data
   - ❌ Complex setup and training process
   - Best for: Research projects with resources for model training

#### Current eSpeak NG Assessment

**Strengths**:

- ✅ Working Bulgarian (bg) voice active and functional
- ✅ Local deployment with no cloud dependencies
- ✅ Fast synthesis (~200ms latency)
- ✅ Already integrated with progressive audio streaming
- ✅ Zero cost, open source
- ✅ Minimal resource requirements

**Limitations**:

- ⚠️ Robotic quality compared to neural TTS
- ⚠️ Less natural prosody and intonation
- ✅ Still intelligible for language learning purposes

### Recommendation: Three-Phase Incremental Approach

Based on the research findings, we recommend a phased approach to TTS improvements:

#### Phase 1: Optimize eSpeak NG Parameters (Low Risk, High Impact)

- **Status**: ✅ COMPLETE - Voice profile selection implemented
- Tune speed, pitch, and volume parameters
- Add voice profiles for different learning contexts
- Implement prosody controls for emphasis

#### Phase 2: Add Optional Cloud TTS Fallback (Medium Risk, High Quality)

- Integrate ElevenLabs or Azure as optional premium feature
- Maintain eSpeak as default/fallback
- Allow users to choose between local (free) and cloud (premium) voices

#### Phase 3: Custom Bulgarian Voice Training (High Risk, High Reward)

- Investigate open voice datasets for Bulgarian
- Train custom Coqui or similar model
- Long-term investment for best quality + local deployment

### Performance Benchmarks

Current eSpeak NG performance with Bulgarian text:

- **Synthesis latency**: ~200ms for typical sentences
- **Audio quality**: Sufficient for language learning
- **Resource usage**: Minimal CPU, <50MB RAM
- **Compatibility**: Works on all platforms

### Conclusion

While Piper TTS would have been an excellent upgrade for Bulgarian voice synthesis, its lack of Bulgarian support makes
it unsuitable for our use case. The current eSpeak NG implementation, enhanced with voice profiles, provides a solid
foundation. Future improvements should focus on optional cloud TTS integration for users who prioritize voice quality
over local deployment.

---

_Research conducted: 2025-08-31_ _Last updated: 2025-09-01_
