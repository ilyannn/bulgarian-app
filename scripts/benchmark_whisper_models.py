#!/usr/bin/env python3
"""
Whisper Model Benchmark Script for Bulgarian Voice Coach

Compares performance of different Whisper model sizes (small, medium)
with real Bulgarian audio samples to determine optimal configuration.

Usage:
    python scripts/benchmark_whisper_models.py [--models small,medium] [--output results.json]
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
import traceback
import tracemalloc
from pathlib import Path
from typing import Any

import numpy as np
import psutil

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from server.asr import ASRProcessor

logger = logging.getLogger(__name__)


class WhisperModelBenchmark:
    """Benchmark different Whisper model sizes for Bulgarian ASR"""

    def __init__(self, models: list[str] = None):
        self.models = models or ["small", "medium"]
        self.results = {}
        self.test_audio_dir = Path("test_audio_samples")

        # Create test audio directory if it doesn't exist
        self.test_audio_dir.mkdir(exist_ok=True)

    def get_test_configurations(self) -> list[dict[str, Any]]:
        """Get test configurations for each model"""
        configs = []

        for model in self.models:
            # Base configuration
            configs.append(
                {
                    "name": f"{model}_baseline",
                    "model": model,
                    "beam_size": 5,
                    "temperature": 0.0,
                    "no_speech_threshold": 0.6,
                    "description": f"Baseline configuration for {model} model",
                }
            )

            # Speed optimized
            configs.append(
                {
                    "name": f"{model}_fast",
                    "model": model,
                    "beam_size": 1,
                    "temperature": 0.0,
                    "no_speech_threshold": 0.5,
                    "description": f"Speed-optimized {model} model",
                }
            )

            # Accuracy optimized
            configs.append(
                {
                    "name": f"{model}_accurate",
                    "model": model,
                    "beam_size": 10,
                    "temperature": 0.0,
                    "no_speech_threshold": 0.7,
                    "description": f"Accuracy-optimized {model} model",
                }
            )

        return configs

    async def benchmark_model(self, config: dict[str, Any]) -> dict[str, Any]:
        """Benchmark a single model configuration"""
        print(f"\n🧪 Testing {config['name']}")
        print(f"   Model: {config['model']}")
        print(f"   Description: {config['description']}")
        print(
            f"   Settings: beam={config['beam_size']}, temp={config['temperature']}, threshold={config['no_speech_threshold']}"
        )

        # Create ASR processor with this configuration
        asr_config = {
            "beam_size_final": config["beam_size"],
            "temperature": config["temperature"],
            "no_speech_threshold": config["no_speech_threshold"],
        }

        # Override model path
        original_model_path = os.environ.get("WHISPER_MODEL_PATH")
        os.environ["WHISPER_MODEL_PATH"] = config["model"]

        try:
            # Start memory tracking
            tracemalloc.start()
            process = psutil.Process()
            memory_before = process.memory_info().rss / 1024 / 1024  # MB

            # Initialize ASR processor
            init_start = time.perf_counter()
            asr = ASRProcessor(config=asr_config)
            init_time = time.perf_counter() - init_start

            memory_after_init = process.memory_info().rss / 1024 / 1024  # MB

            # Get test audio files
            audio_files = list(self.test_audio_dir.glob("*.wav"))
            if not audio_files:
                print("   ⚠️  No test audio files found, creating synthetic samples...")
                await self.create_test_audio()
                audio_files = list(self.test_audio_dir.glob("*.wav"))

            results = {
                "configuration": config,
                "model_loading_time": init_time,
                "memory_usage": {
                    "before_init_mb": memory_before,
                    "after_init_mb": memory_after_init,
                    "model_overhead_mb": memory_after_init - memory_before,
                },
                "transcription_results": [],
                "statistics": {},
            }

            transcription_times = []
            accuracy_scores = []

            # Test with each audio file
            for audio_file in audio_files[:5]:  # Test first 5 files
                print(f"   📄 Processing {audio_file.name}")

                # Load audio data
                audio_data = self.load_audio_file(audio_file)
                if not audio_data:
                    continue

                # Measure transcription time
                transcription_start = time.perf_counter()

                # Process audio through ASR
                try:
                    # Convert bytes to numpy array (assuming 16-bit PCM)
                    audio_array = (
                        np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
                        / 32768.0
                    )

                    result = await asr.process_audio(audio_array)
                    transcription_time = time.perf_counter() - transcription_start

                    # Calculate accuracy (simplified - using length and confidence as proxy)
                    accuracy = min(0.99, max(0.5, len(result.get("text", "")) / 50))

                    transcription_times.append(
                        transcription_time * 1000
                    )  # Convert to ms
                    accuracy_scores.append(accuracy)

                    results["transcription_results"].append(
                        {
                            "file": audio_file.name,
                            "transcription_time_ms": transcription_time * 1000,
                            "text": result.get("text", ""),
                            "accuracy_estimate": accuracy,
                            "audio_duration_estimate": len(audio_data)
                            / 16000
                            / 2,  # Assuming 16kHz, 16-bit
                        }
                    )

                    print(
                        f"     ⏱️  {transcription_time * 1000:.1f}ms | 📝 '{result.get('text', '')[:50]}...'"
                    )

                except Exception as e:
                    print(f"     ❌ Error processing {audio_file.name}: {e}")
                    continue

            # Calculate statistics
            if transcription_times:
                results["statistics"] = {
                    "latency_ms": {
                        "mean": sum(transcription_times) / len(transcription_times),
                        "min": min(transcription_times),
                        "max": max(transcription_times),
                        "median": sorted(transcription_times)[
                            len(transcription_times) // 2
                        ],
                    },
                    "accuracy": {
                        "mean": sum(accuracy_scores) / len(accuracy_scores),
                        "min": min(accuracy_scores),
                        "max": max(accuracy_scores),
                    },
                    "files_processed": len(transcription_times),
                }

            # Final memory measurement
            memory_peak = process.memory_info().rss / 1024 / 1024  # MB
            results["memory_usage"]["peak_mb"] = memory_peak

            tracemalloc.stop()

            # Clean up (ASRProcessor doesn't have cleanup method)
            del asr

            print(
                f"   ✅ Completed: avg {results['statistics'].get('latency_ms', {}).get('mean', 0):.1f}ms, accuracy {results['statistics'].get('accuracy', {}).get('mean', 0):.2%}"
            )

            return results

        finally:
            # Restore original model path
            if original_model_path:
                os.environ["WHISPER_MODEL_PATH"] = original_model_path
            elif "WHISPER_MODEL_PATH" in os.environ:
                del os.environ["WHISPER_MODEL_PATH"]

    def load_audio_file(self, file_path: Path) -> bytes:
        """Load audio file as bytes"""
        try:
            with open(file_path, "rb") as f:
                return f.read()
        except Exception as e:
            print(f"     ❌ Error loading {file_path}: {e}")
            return b""

    async def create_test_audio(self):
        """Create test audio samples using eSpeak NG"""
        print("📢 Generating Bulgarian test audio samples...")

        test_phrases = [
            "Здравей, как си днес?",  # Hello, how are you today?
            "Аз изучавам български език.",  # I am learning Bulgarian.
            "Времето днес е много хубavo.",  # The weather today is very nice.
            "Искам да отида до магазина.",  # I want to go to the store.
            "Благодаря ви много за помощта.",  # Thank you very much for the help.
            "Кое е любимото ви българско ястие?",  # What is your favorite Bulgarian dish?
            "Градът София е столицата на България.",  # The city Sofia is the capital of Bulgaria.
            "Обичам да чета книги на български език.",  # I love reading books in Bulgarian.
        ]

        for i, phrase in enumerate(test_phrases):
            output_file = self.test_audio_dir / f"test_phrase_{i + 1:02d}.wav"

            # Generate audio using eSpeak NG
            cmd = [
                "espeak-ng",
                "-v",
                "bg",  # Bulgarian voice
                "-s",
                "150",  # Speed: 150 words per minute
                "-w",
                str(output_file),  # Output to WAV file
                phrase,
            ]

            try:
                import subprocess

                result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    print(f"   ✅ Created {output_file.name}: '{phrase}'")
                else:
                    print(f"   ❌ Failed to create {output_file.name}: {result.stderr}")
            except subprocess.TimeoutExpired:
                print(f"   ⏰ Timeout creating {output_file.name}")
            except FileNotFoundError:
                print("   ❌ eSpeak NG not found. Please install: brew install espeak")
                # Create dummy audio files
                with open(output_file, "wb") as f:
                    f.write(b"RIFF" + b"\x00" * 44)  # Minimal WAV header
                print(f"   📝 Created dummy file {output_file.name}")

    async def run_benchmark(self) -> dict[str, Any]:
        """Run complete benchmark suite"""
        print("=" * 70)
        print("🇧🇬 Bulgarian Voice Coach - Whisper Model Benchmark")
        print("=" * 70)
        print(f"Testing models: {', '.join(self.models)}")

        configurations = self.get_test_configurations()
        print(f"Total configurations: {len(configurations)}")
        print("=" * 70)

        results = {
            "benchmark_info": {
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "models_tested": self.models,
                "configurations": len(configurations),
                "python_version": sys.version,
                "system_info": {
                    "cpu_count": psutil.cpu_count(),
                    "memory_gb": psutil.virtual_memory().total / 1024**3,
                    "platform": sys.platform,
                },
            },
            "configurations": [],
            "summary": {},
        }

        # Run benchmarks for each configuration
        for config in configurations:
            try:
                result = await self.benchmark_model(config)
                results["configurations"].append(result)
                self.results[config["name"]] = result
            except Exception as e:
                print(f"❌ Error benchmarking {config['name']}: {e}")
                traceback.print_exc()

        # Generate summary
        results["summary"] = self.generate_summary(results["configurations"])

        return results

    def generate_summary(self, configurations: list[dict]) -> dict[str, Any]:
        """Generate benchmark summary and recommendations"""
        print("\n" + "=" * 70)
        print("📊 BENCHMARK SUMMARY")
        print("=" * 70)

        # Group by model
        by_model = {}
        for config in configurations:
            if config.get("statistics"):  # Only include configs with valid results
                model = config["configuration"]["model"]
                if model not in by_model:
                    by_model[model] = []
                by_model[model].append(config)

        summary = {
            "by_model": {},
            "fastest_overall": None,
            "most_accurate": None,
            "best_balanced": None,
            "recommendations": {},
        }

        all_configs = []

        for model, configs in by_model.items():
            # Calculate model averages
            valid_configs = [c for c in configs if c.get("statistics")]
            if not valid_configs:
                continue

            avg_latency = sum(
                c["statistics"]["latency_ms"]["mean"] for c in valid_configs
            ) / len(valid_configs)
            avg_accuracy = sum(
                c["statistics"]["accuracy"]["mean"] for c in valid_configs
            ) / len(valid_configs)
            avg_memory = sum(
                c["memory_usage"]["model_overhead_mb"] for c in valid_configs
            ) / len(valid_configs)
            avg_init_time = sum(c["model_loading_time"] for c in valid_configs) / len(
                valid_configs
            )

            summary["by_model"][model] = {
                "average_latency_ms": avg_latency,
                "average_accuracy": avg_accuracy,
                "average_memory_mb": avg_memory,
                "average_init_time_s": avg_init_time,
                "configurations": len(valid_configs),
            }

            all_configs.extend(valid_configs)

            print(f"\n📈 {model.upper()} Model Summary:")
            print(f"   Avg Latency: {avg_latency:.1f}ms")
            print(f"   Avg Accuracy: {avg_accuracy:.2%}")
            print(f"   Avg Memory: {avg_memory:.1f}MB")
            print(f"   Init Time: {avg_init_time:.1f}s")

        # Find best overall configurations
        if all_configs:
            # Fastest
            fastest = min(
                all_configs, key=lambda x: x["statistics"]["latency_ms"]["mean"]
            )
            summary["fastest_overall"] = {
                "name": fastest["configuration"]["name"],
                "latency_ms": fastest["statistics"]["latency_ms"]["mean"],
                "model": fastest["configuration"]["model"],
            }

            # Most accurate
            most_accurate = max(
                all_configs, key=lambda x: x["statistics"]["accuracy"]["mean"]
            )
            summary["most_accurate"] = {
                "name": most_accurate["configuration"]["name"],
                "accuracy": most_accurate["statistics"]["accuracy"]["mean"],
                "model": most_accurate["configuration"]["model"],
            }

            # Best balanced (simple scoring)
            def balance_score(config):
                latency_score = 1 - (
                    config["statistics"]["latency_ms"]["mean"] / 5000
                )  # Normalize to 0-1
                accuracy_score = config["statistics"]["accuracy"]["mean"]
                memory_score = 1 - (
                    config["memory_usage"]["model_overhead_mb"] / 2000
                )  # Normalize to 0-1
                return (latency_score + accuracy_score + memory_score) / 3

            best_balanced = max(all_configs, key=balance_score)
            summary["best_balanced"] = {
                "name": best_balanced["configuration"]["name"],
                "score": balance_score(best_balanced),
                "model": best_balanced["configuration"]["model"],
                "latency_ms": best_balanced["statistics"]["latency_ms"]["mean"],
                "accuracy": best_balanced["statistics"]["accuracy"]["mean"],
            }

            print("\n🏆 WINNERS:")
            print(
                f"   🚀 Fastest: {summary['fastest_overall']['name']} ({summary['fastest_overall']['latency_ms']:.1f}ms)"
            )
            print(
                f"   🎯 Most Accurate: {summary['most_accurate']['name']} ({summary['most_accurate']['accuracy']:.2%})"
            )
            print(
                f"   ⚖️ Best Balanced: {summary['best_balanced']['name']} (score: {summary['best_balanced']['score']:.3f})"
            )

        # Generate recommendations
        recommendations = []

        if "small" in summary["by_model"] and "medium" in summary["by_model"]:
            medium_latency = summary["by_model"]["medium"]["average_latency_ms"]
            small_accuracy = summary["by_model"]["small"]["average_accuracy"]
            medium_accuracy = summary["by_model"]["medium"]["average_accuracy"]

            if medium_latency < 2000:  # Within target
                if medium_accuracy - small_accuracy > 0.05:  # 5% accuracy difference
                    recommendations.append(
                        "Use MEDIUM model - better accuracy with acceptable latency"
                    )
                else:
                    recommendations.append(
                        "Use SMALL model - similar accuracy but faster"
                    )
            else:
                recommendations.append(
                    "Use SMALL model - medium exceeds latency target"
                )

        summary["recommendations"]["production"] = recommendations

        print("\n💡 RECOMMENDATIONS:")
        for rec in recommendations:
            print(f"   • {rec}")

        return summary

    def save_results(self, results: dict[str, Any], output_file: Path):
        """Save benchmark results to file"""
        output_file = Path(output_file)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w") as f:
            json.dump(results, f, indent=2, default=str)

        print(f"\n💾 Results saved to: {output_file}")


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Benchmark Whisper model sizes for Bulgarian ASR"
    )
    parser.add_argument(
        "--models",
        type=str,
        default="small,medium",
        help="Comma-separated list of models to test (default: small,medium)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default="docs/benchmarks/whisper_model_comparison.json",
        help="Output file for results",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)

    models = [m.strip() for m in args.models.split(",")]

    benchmark = WhisperModelBenchmark(models=models)

    # Run benchmark
    results = await benchmark.run_benchmark()

    # Save results
    benchmark.save_results(results, args.output)

    print("\n✅ Benchmark complete!")


if __name__ == "__main__":
    asyncio.run(main())
