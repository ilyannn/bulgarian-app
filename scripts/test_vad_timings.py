#!/usr/bin/env python3
"""
Test different VAD timings with real ASR processing
"""

import json
import os
import sys
import time

import numpy as np

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from server.asr import ASRProcessor


def generate_test_audio(duration_seconds=2, sample_rate=16000):
    """Generate test audio with speech-like characteristics"""
    # Generate a simple sine wave with speech-like frequency
    frequency = 200  # Hz (typical fundamental frequency for speech)
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds))
    audio = np.sin(2 * np.pi * frequency * t)

    # Add some modulation to simulate speech variation
    modulation = np.sin(2 * np.pi * 4 * t) * 0.3
    audio = audio * (1 + modulation)

    # Add some noise
    noise = np.random.normal(0, 0.05, len(audio))
    audio = audio + noise

    # Convert to int16 range
    audio = np.clip(audio * 32767, -32768, 32767).astype(np.int16)

    return audio


def test_vad_configuration(config_name, config):
    """Test a specific VAD configuration"""
    print(f"\n{'=' * 60}")
    print(f"Testing: {config_name}")
    print(f"Config: {json.dumps(config, indent=2)}")
    print(f"{'=' * 60}")

    # Initialize ASR with configuration
    asr = ASRProcessor(config)

    # Generate test audio
    audio = generate_test_audio(duration_seconds=1)

    # Process in chunks to simulate streaming
    chunk_size = 320  # 20ms at 16kHz
    chunks = [audio[i : i + chunk_size] for i in range(0, len(audio), chunk_size)]

    start_time = time.perf_counter()
    speech_detected = False
    partial_count = 0
    final_result = None

    for _i, chunk in enumerate(chunks):
        # Convert to bytes
        chunk_bytes = chunk.tobytes()

        # Process chunk
        result = asr.process_audio_chunk(chunk_bytes)

        if result:
            if result["type"] == "partial":
                partial_count += 1
                if not speech_detected:
                    speech_detected = True
                    detection_time = time.perf_counter() - start_time
                    print(f"  Speech detected at: {detection_time * 1000:.1f}ms")
                print(f"  Partial {partial_count}: '{result.get('text', '')}'")
            elif result["type"] == "final":
                final_time = time.perf_counter() - start_time
                final_result = result.get("text", "")
                print(
                    f"  Final transcription at {final_time * 1000:.1f}ms: '{final_result}'"
                )
                break

    total_time = time.perf_counter() - start_time
    print(f"\n  Total processing time: {total_time * 1000:.1f}ms")

    # Add silence to test end-of-speech detection
    silence = np.zeros(chunk_size * 30, dtype=np.int16)  # 600ms of silence
    silence_chunks = [
        silence[i : i + chunk_size] for i in range(0, len(silence), chunk_size)
    ]

    for chunk in silence_chunks:
        result = asr.process_audio_chunk(chunk.tobytes())
        if result and result["type"] == "final":
            end_detection_time = time.perf_counter() - start_time
            print(f"  End-of-speech detected at: {end_detection_time * 1000:.1f}ms")
            break

    return {
        "config_name": config_name,
        "total_time_ms": total_time * 1000,
        "speech_detected": speech_detected,
        "partial_count": partial_count,
        "has_final": final_result is not None,
    }


def main():
    """Test various VAD configurations"""

    configurations = {
        "baseline": {"vad_tail_ms": 400, "beam_size_partial": 1, "beam_size_final": 2},
        "fast_200ms": {
            "vad_tail_ms": 200,
            "beam_size_partial": 1,
            "beam_size_final": 2,
        },
        "optimized_250ms": {
            "vad_tail_ms": 250,
            "beam_size_partial": 1,
            "beam_size_final": 3,
        },
        "balanced_300ms": {
            "vad_tail_ms": 300,
            "beam_size_partial": 1,
            "beam_size_final": 3,
        },
        "conservative_500ms": {
            "vad_tail_ms": 500,
            "beam_size_partial": 1,
            "beam_size_final": 5,
        },
    }

    print("=" * 60)
    print("VAD Timing Performance Test")
    print("=" * 60)

    results = []
    for name, config in configurations.items():
        try:
            result = test_vad_configuration(name, config)
            results.append(result)
        except Exception as e:
            print(f"Error testing {name}: {e}")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    for result in results:
        print(f"\n{result['config_name']}:")
        print(f"  Processing time: {result['total_time_ms']:.1f}ms")
        print(f"  Speech detected: {result['speech_detected']}")
        print(f"  Partial updates: {result['partial_count']}")
        print(f"  Final result: {result['has_final']}")

    # Find optimal
    if results:
        fastest = min(results, key=lambda x: x["total_time_ms"])
        print(
            f"\n🚀 Fastest configuration: {fastest['config_name']} ({fastest['total_time_ms']:.1f}ms)"
        )


if __name__ == "__main__":
    main()
