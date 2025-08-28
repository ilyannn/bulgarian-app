# Performance Optimization Guide

## Overview

This document outlines the performance optimizations implemented for the Bulgarian Voice Coach application, focusing on
achieving the target latency of 1.2-2.0 seconds end-to-end.

## Current Configuration

The application uses optimized ASR (Automatic Speech Recognition) parameters configured in `server/app.py`:

```python
asr_config = {
    'vad_tail_ms': 250,           # Optimized VAD tail timing
    'vad_aggressiveness': 2,      # Moderate aggressiveness
    'beam_size_partial': 1,       # Fast partial transcription
    'beam_size_final': 3,         # Balanced final transcription
    'no_speech_threshold': 0.6,   # Standard threshold
    'temperature': 0.0            # Deterministic decoding
}
```

## VAD (Voice Activity Detection) Configuration

### VAD Tail Timing

The VAD tail timing determines how long to wait after speech ends before finalizing transcription:

- **200ms**: Most aggressive, fastest response but may cut off trailing words
- **250ms**: Optimal balance (RECOMMENDED) - fast response with good accuracy
- **300ms**: Conservative, slightly slower but more reliable
- **400ms**: Very conservative, best for noisy environments
- **500ms**: Maximum safety, may feel sluggish

### VAD Aggressiveness Levels

- **0**: Least aggressive (most permissive)
- **1**: Slightly aggressive
- **2**: Moderately aggressive (RECOMMENDED)
- **3**: Most aggressive (may miss soft speech)

## ASR Model Parameters

### Beam Size

Controls the search space during decoding:

- **Partial transcription**: `beam_size=1` for fastest streaming updates
- **Final transcription**: `beam_size=3` for balanced speed/accuracy
- **High accuracy mode**: `beam_size=5-8` (slower but more accurate)

### No-Speech Threshold

Confidence threshold for detecting non-speech:

- **0.3**: More sensitive, may produce false positives
- **0.6**: Standard threshold (RECOMMENDED)
- **0.8**: Less sensitive, may miss quiet speech

### Temperature

Controls randomness in decoding:

- **0.0**: Deterministic, most consistent (RECOMMENDED)
- **0.1-0.3**: Slight variation, may help with difficult audio
- **>0.5**: Not recommended for production

## Performance Monitoring

### Client-Side Monitoring

The application includes a comprehensive `PerformanceMonitor` service that tracks:

- VAD processing time
- ASR transcription latency
- LLM response time
- TTS generation time
- End-to-end latency
- WebSocket round-trip time

### Key Metrics

Monitor these metrics for optimal performance:

1. **Speech Detection Latency**: Should be <500ms
2. **Partial Transcription Updates**: Every 500ms during speech
3. **Final Transcription**: Within 250ms of speech ending
4. **End-to-End Latency**: Target 1.2-2.0s total

### Performance Levels

The monitoring system categorizes latency into levels:

- **Excellent**: <1500ms (green)
- **Good**: 1500-2000ms (yellow-green)
- **Fair**: 2000-3000ms (yellow)
- **Poor**: >3000ms (red)

## Testing & Benchmarking

### Available Scripts

1. **benchmark_performance.py**: Comprehensive configuration testing

   ```bash
   python scripts/benchmark_performance.py --quick --samples 5
   ```

2. **test_vad_timings.py**: Real-time VAD timing tests
   ```bash
   python scripts/test_vad_timings.py
   ```

### Benchmark Results

Based on testing, the optimal configuration achieves:

- Average latency: 250-300ms for VAD detection
- ASR processing: 500-800ms for 1-2 second utterances
- Total end-to-end: 1.2-1.8s with LLM and TTS

For detailed benchmark results, see [benchmark_results.json](../benchmark_results.json) which contains:
- Latency measurements for 5 different configurations
- Statistical analysis (mean, median, p90, p99)
- Accuracy metrics for each configuration
- Optimal configuration recommendation: 200ms VAD tail with beam size 5

## Optimization Recommendations

### For Minimum Latency

```python
{
    'vad_tail_ms': 200,
    'beam_size_partial': 1,
    'beam_size_final': 2,
    'no_speech_threshold': 0.5
}
```

### For Best Accuracy

```python
{
    'vad_tail_ms': 400,
    'beam_size_partial': 2,
    'beam_size_final': 5,
    'no_speech_threshold': 0.7
}
```

### For Balanced Performance (RECOMMENDED)

```python
{
    'vad_tail_ms': 250,
    'beam_size_partial': 1,
    'beam_size_final': 3,
    'no_speech_threshold': 0.6
}
```

## Future Optimizations

### Short-term

1. **Model Preloading**: Initialize Whisper model at startup to avoid first-use delay
2. **Retry Logic**: Implement automatic retry for empty ASR results
3. **Caching**: Cache common phrases and responses

### Medium-term

1. **GPU Acceleration**: Use CUDA for faster ASR processing
2. **Model Quantization**: Use int8 quantized models for speed
3. **Streaming LLM**: Implement streaming responses from language model

### Long-term

1. **Custom ASR Model**: Fine-tune model specifically for Bulgarian
2. **Edge Deployment**: Move ASR to client-side for reduced latency
3. **Predictive Responses**: Pre-generate likely responses

## Troubleshooting

### High Latency Issues

1. Check model initialization time (first request is always slower)
2. Verify CPU usage isn't maxed out
3. Monitor memory usage for swapping
4. Check network latency for WebSocket connection

### Empty Transcriptions

1. Increase `vad_tail_ms` to 300-400ms
2. Decrease `no_speech_threshold` to 0.4
3. Check audio input levels
4. Verify VAD aggressiveness isn't too high

### Inaccurate Transcriptions

1. Increase `beam_size_final` to 5
2. Ensure audio quality is good (16kHz, mono)
3. Check for background noise
4. Consider using a larger Whisper model

## Configuration Environment Variables

Set these in your `.env` file to override defaults:

```bash
# ASR Configuration
ASR_VAD_TAIL_MS=250
ASR_VAD_AGGRESSIVENESS=2
ASR_BEAM_SIZE_PARTIAL=1
ASR_BEAM_SIZE_FINAL=3
ASR_NO_SPEECH_THRESHOLD=0.6
ASR_TEMPERATURE=0.0

# Model Configuration
WHISPER_MODEL_PATH=medium
```

## Monitoring Dashboard

Access performance metrics in the browser console:

```javascript
// Get current statistics
performanceMonitor.getStatistics();

// Get performance recommendations
performanceMonitor.getRecommendations();

// Export metrics for analysis
performanceMonitor.exportMetrics();
```

## References

- [Whisper Model Documentation](https://github.com/openai/whisper)
- [WebRTC VAD Documentation](https://github.com/wiseman/py-webrtcvad)
- [FastAPI WebSocket Guide](https://fastapi.tiangolo.com/advanced/websockets/)
