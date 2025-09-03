import hashlib
import logging
import os
import threading
from collections import deque
from typing import Any

import numpy as np
import webrtcvad
from bg_normalization import normalize_bulgarian
from faster_whisper import WhisperModel
from pronunciation_scorer import PronunciationScorer

logger = logging.getLogger(__name__)


class ASRProcessor:
    """Audio Speech Recognition processor using faster-whisper with VAD"""

    def __init__(self, config: dict | None = None):
        """Initialize ASR with configurable parameters

        Args:
            config: Optional configuration dict with:
                - vad_tail_ms: VAD tail timing in milliseconds (default: 300)
                - vad_aggressiveness: VAD aggressiveness level 0-3 (default: 2)
                - beam_size_partial: Beam size for partial transcription (default: 1)
                - beam_size_final: Beam size for final transcription (default: 2)
                - no_speech_threshold: Threshold for detecting non-speech (default: 0.6)
                - temperature: Temperature for decoding (default: 0.0)
                - enable_pronunciation_scoring: Enable pronunciation analysis (default: False)
        """
        # Load configuration with defaults
        config = config or {}
        self.vad_tail_ms = config.get("vad_tail_ms", 300)  # Optimized from benchmark
        self.vad_aggressiveness = config.get("vad_aggressiveness", 2)
        self.beam_size_partial = config.get("beam_size_partial", 1)
        self.beam_size_final = config.get("beam_size_final", 2)
        self.no_speech_threshold = config.get("no_speech_threshold", 0.6)
        self.temperature = config.get("temperature", 0.0)
        self.enable_pronunciation_scoring = config.get(
            "enable_pronunciation_scoring", False
        )

        self.sample_rate = 16000
        self.frame_duration = 20  # ms
        self.frame_size = int(
            self.sample_rate * self.frame_duration / 1000
        )  # samples per frame

        # Initialize VAD with configurable aggressiveness
        self.vad = webrtcvad.Vad(self.vad_aggressiveness)

        # Audio buffer for accumulating frames
        self.audio_buffer = deque(maxlen=1000)  # ~20 seconds at 20ms frames
        self.speech_frames = []
        self.silence_count = 0
        self.speech_triggered = False

        # Calculate max silence frames based on configured tail timing
        self.max_silence_frames = int(self.vad_tail_ms / self.frame_duration)

        # Initialize Whisper model
        model_path = os.getenv("WHISPER_MODEL_PATH", "medium")
        logger.info(f"Initializing Whisper model: {model_path}")
        try:
            self.model = WhisperModel(model_path, device="cpu", compute_type="int8")
            logger.info("✅ Whisper model initialized successfully")

            # Preload model by running a warm-up inference
            self._warmup_model()
        except Exception as e:
            logger.error(f"❌ Failed to initialize Whisper model: {e}")
            raise

        self.partial_text = ""
        self.lock = threading.Lock()

        # Cache for common phrases (stores audio hash -> transcription)
        self.transcription_cache = {}
        self.cache_max_size = 100  # Maximum number of cached transcriptions

        # Pronunciation scorer (initialized lazily)
        self.pronunciation_scorer = None
        if self.enable_pronunciation_scoring:
            self.pronunciation_scorer = PronunciationScorer(
                {
                    "device": "cpu",  # Use same device as faster-whisper
                    "compute_type": "float32",
                }
            )

    def _warmup_model(self):
        """Warm up the Whisper model to avoid first-use delay"""
        try:
            logger.info("🔥 Warming up Whisper model...")
            # Create a small silent audio sample (0.5 seconds)
            warmup_audio = np.zeros(int(self.sample_rate * 0.5), dtype=np.float32)

            # Run inference to load model into memory
            segments, _ = self.model.transcribe(
                warmup_audio,
                language="bg",
                beam_size=1,
                temperature=0.0,
                no_speech_threshold=0.9,  # High threshold since it's silence
                condition_on_previous_text=False,
            )

            logger.info("✅ Model warm-up complete")

            # Warm up pronunciation scorer if enabled
            if hasattr(self, "pronunciation_scorer") and self.pronunciation_scorer:
                try:
                    logger.info("🎯 Warming up pronunciation scorer...")
                    # Initialize in background to avoid blocking
                    import asyncio

                    asyncio.create_task(self.pronunciation_scorer.initialize())
                except Exception as e:
                    logger.warning(
                        f"⚠️ Pronunciation scorer warm-up failed (non-critical): {e}"
                    )

        except Exception as e:
            logger.warning(f"⚠️ Model warm-up failed (non-critical): {e}")

    def process_audio_chunk(self, audio_data: bytes) -> dict | None:
        """Process incoming audio chunk and return ASR result"""
        try:
            # Convert bytes to numpy array (assuming int16 PCM)
            audio_array = np.frombuffer(audio_data, dtype=np.int16)

            # Process in frame-sized chunks
            for i in range(0, len(audio_array), self.frame_size):
                frame = audio_array[i : i + self.frame_size]

                # Pad frame if necessary
                if len(frame) < self.frame_size:
                    frame = np.pad(frame, (0, self.frame_size - len(frame)), "constant")

                result = self._process_frame(frame)
                if result:
                    return result

            return None

        except Exception as e:
            print(f"Error processing audio chunk: {e}")
            return None

    def _process_frame(self, frame: np.ndarray) -> dict | None:
        """Process individual audio frame through VAD and ASR"""

        # Convert to bytes for VAD
        frame_bytes = frame.astype(np.int16).tobytes()

        # Check if frame contains speech
        is_speech = self.vad.is_speech(frame_bytes, self.sample_rate)

        with self.lock:
            if is_speech:
                self.speech_frames.append(frame)
                self.silence_count = 0

                if not self.speech_triggered:
                    self.speech_triggered = True
                    print("Speech detected")

                # Return partial transcription if we have enough frames
                if len(self.speech_frames) % 25 == 0:  # Every 500ms
                    return self._get_partial_transcription()

            else:
                if self.speech_triggered:
                    self.silence_count += 1

                    # End of speech detected
                    if self.silence_count >= self.max_silence_frames:
                        return self._finalize_transcription()

        return None

    def _get_audio_hash(self, audio: np.ndarray) -> str:
        """Generate a hash for audio data for caching"""
        # Use a simplified hash of audio characteristics for speed
        audio_bytes = audio.tobytes()
        return hashlib.md5(audio_bytes).hexdigest()

    def _get_partial_transcription(self) -> dict:
        """Get partial transcription from current speech frames"""
        if not self.speech_frames:
            return {"type": "partial", "text": "", "confidence": 0.0}

        try:
            # Concatenate frames
            audio = np.concatenate(self.speech_frames)

            # Check cache first
            audio_hash = self._get_audio_hash(audio)
            if audio_hash in self.transcription_cache:
                logger.debug("Cache hit for partial transcription")
                cached_entry = self.transcription_cache[audio_hash]
                # Support both old (text-only) and new (dict with confidence) cache format
                if isinstance(cached_entry, dict):
                    cached_text = cached_entry.get("text", "")
                    cached_confidence = cached_entry.get("confidence", 0.7)
                else:
                    cached_text = cached_entry
                    cached_confidence = 0.7
                self.partial_text = cached_text
                return {
                    "type": "partial",
                    "text": cached_text,
                    "confidence": cached_confidence,
                }

            # Normalize audio
            audio = audio.astype(np.float32) / 32768.0

            # Run Whisper inference with configurable parameters
            segments, info = self.model.transcribe(
                audio,
                language="bg",
                beam_size=self.beam_size_partial,
                temperature=self.temperature,
                no_speech_threshold=self.no_speech_threshold,
                condition_on_previous_text=False,
            )

            text = " ".join([segment.text.strip() for segment in segments])
            # Apply Bulgarian text normalization for ASR
            text = normalize_bulgarian(text, mode="asr")

            # Calculate confidence from segments
            confidences = []
            for segment in segments:
                if hasattr(segment, "avg_logprob"):
                    # Convert log probability to confidence score
                    confidence = min(1.0, max(0.0, (segment.avg_logprob + 1.0) / 1.0))
                    confidences.append(confidence)

            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.7

            # Retry with adjusted parameters if no speech detected
            if (
                not text
                and hasattr(info, "no_speech_prob")
                and info.no_speech_prob > 0.8
            ):
                logger.info(
                    "No speech detected in partial, retrying with lower threshold"
                )
                segments, _ = self.model.transcribe(
                    audio,
                    language="bg",
                    beam_size=self.beam_size_partial,
                    temperature=0.2,  # Add slight temperature for retry
                    no_speech_threshold=0.3,  # Lower threshold
                    condition_on_previous_text=False,
                )
                text = " ".join([segment.text.strip() for segment in segments])
                # Apply Bulgarian text normalization for ASR
                text = normalize_bulgarian(text, mode="asr")

                # Recalculate confidence for retry
                confidences = []
                for segment in segments:
                    if hasattr(segment, "avg_logprob"):
                        confidence = min(
                            1.0, max(0.0, (segment.avg_logprob + 1.0) / 1.0)
                        )
                        confidences.append(confidence)
                avg_confidence = (
                    sum(confidences) / len(confidences) if confidences else 0.5
                )

            # Store in cache if we got text
            if text and len(self.transcription_cache) < self.cache_max_size:
                self.transcription_cache[audio_hash] = {
                    "text": text,
                    "confidence": avg_confidence,
                }
                logger.debug(
                    f"Cached partial transcription (cache size: {len(self.transcription_cache)})"
                )

            self.partial_text = text
            return {"type": "partial", "text": text, "confidence": avg_confidence}

        except Exception as e:
            logger.error(f"Error in partial transcription: {e}")
            return {"type": "partial", "text": "", "confidence": 0.0}

    def _finalize_transcription(self) -> dict:
        """Finalize transcription and reset state"""
        if not self.speech_frames:
            return {"type": "final", "text": "", "confidence": 0.0}

        try:
            # Concatenate all speech frames
            audio = np.concatenate(self.speech_frames)

            # Check cache first
            audio_hash = self._get_audio_hash(audio)
            if audio_hash in self.transcription_cache:
                logger.debug("Cache hit for final transcription")
                cached_entry = self.transcription_cache[audio_hash]
                # Support both old (text-only) and new (dict with confidence) cache format
                if isinstance(cached_entry, dict):
                    cached_text = cached_entry.get("text", "")
                    cached_confidence = cached_entry.get("confidence", 0.85)
                else:
                    cached_text = cached_entry
                    cached_confidence = 0.85
                # Reset state
                self.speech_frames = []
                self.silence_count = 0
                self.speech_triggered = False
                self.partial_text = ""
                print(
                    f"Final transcription (cached): {cached_text} (confidence: {cached_confidence:.2f})"
                )
                return {
                    "type": "final",
                    "text": cached_text,
                    "confidence": cached_confidence,
                }

            # Normalize audio
            audio = audio.astype(np.float32) / 32768.0

            # Run final Whisper inference with higher quality settings
            segments, info = self.model.transcribe(
                audio,
                language="bg",
                beam_size=self.beam_size_final,
                temperature=self.temperature,
                no_speech_threshold=self.no_speech_threshold,
                condition_on_previous_text=False,
                word_timestamps=True,
            )

            text = " ".join([segment.text.strip() for segment in segments])
            # Apply Bulgarian text normalization for ASR
            text = normalize_bulgarian(text, mode="asr")

            # Calculate confidence from segments
            confidences = []
            for segment in segments:
                if hasattr(segment, "avg_logprob"):
                    # Convert log probability to confidence score
                    confidence = min(1.0, max(0.0, (segment.avg_logprob + 1.0) / 1.0))
                    confidences.append(confidence)

            avg_confidence = (
                sum(confidences) / len(confidences) if confidences else 0.85
            )

            # Retry with adjusted parameters if no speech detected
            if (
                not text
                and hasattr(info, "no_speech_prob")
                and info.no_speech_prob > 0.8
            ):
                logger.info(
                    "No speech detected in final, retrying with lower threshold"
                )
                segments, _ = self.model.transcribe(
                    audio,
                    language="bg",
                    beam_size=self.beam_size_final
                    + 1,  # Slightly higher beam for retry
                    temperature=0.2,  # Add slight temperature
                    no_speech_threshold=0.3,  # Lower threshold
                    condition_on_previous_text=False,
                    word_timestamps=True,
                )
                text = " ".join([segment.text.strip() for segment in segments])
                # Apply Bulgarian text normalization for ASR
                text = normalize_bulgarian(text, mode="asr")

                # Recalculate confidence for retry
                confidences = []
                for segment in segments:
                    if hasattr(segment, "avg_logprob"):
                        confidence = min(
                            1.0, max(0.0, (segment.avg_logprob + 1.0) / 1.0)
                        )
                        confidences.append(confidence)
                avg_confidence = (
                    sum(confidences) / len(confidences) if confidences else 0.6
                )

            # Store in cache if we got text
            if text and len(self.transcription_cache) < self.cache_max_size:
                self.transcription_cache[audio_hash] = {
                    "text": text,
                    "confidence": avg_confidence,
                }
                logger.debug(
                    f"Cached final transcription (cache size: {len(self.transcription_cache)})"
                )

            # Reset state
            self.speech_frames = []
            self.silence_count = 0
            self.speech_triggered = False
            self.partial_text = ""

            print(f"Final transcription: {text} (confidence: {avg_confidence:.2f})")
            return {"type": "final", "text": text, "confidence": avg_confidence}

        except Exception as e:
            print(f"Error in final transcription: {e}")
            # Reset state even on error
            self.speech_frames = []
            self.silence_count = 0
            self.speech_triggered = False
            self.partial_text = ""
            return {"type": "final", "text": "", "confidence": 0.0}

    async def process_audio(self, audio_data: np.ndarray | None) -> dict:
        """Process audio data and return transcription result (async interface for tests)"""
        if audio_data is None or len(audio_data) == 0:
            return {"text": "", "confidence": 0.0, "language": "bg"}

        try:
            # Normalize audio to float32 if needed
            if audio_data.dtype != np.float32:
                if audio_data.dtype == np.int16:
                    audio = audio_data.astype(np.float32) / 32768.0
                else:
                    audio = audio_data.astype(np.float32)
            else:
                audio = audio_data

            # Run Whisper inference
            segments, _ = self.model.transcribe(
                audio,
                language="bg",
                beam_size=2,
                temperature=0.0,
                no_speech_threshold=0.6,
                condition_on_previous_text=False,
            )

            text = " ".join([segment.text.strip() for segment in segments])
            # Apply Bulgarian text normalization for ASR
            text = normalize_bulgarian(text, mode="asr")

            # Calculate confidence from segments
            confidences = []
            for segment in segments:
                if hasattr(segment, "avg_logprob"):
                    # Convert log probability to confidence score
                    confidence = min(1.0, max(0.0, (segment.avg_logprob + 1.0) / 1.0))
                    confidences.append(confidence)

            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.7

            return {
                "text": text,
                "confidence": avg_confidence,
                "language": "bg",
            }

        except Exception as e:
            print(f"Error in process_audio: {e}")
            return {"text": "", "confidence": 0.0, "language": "bg"}

    async def analyze_pronunciation(
        self, audio_data: np.ndarray, reference_text: str, sample_rate: int = 16000
    ) -> dict[str, Any] | None:
        """
        Analyze pronunciation quality of audio against reference text.

        Args:
            audio_data: Audio data as numpy array (float32, normalized)
            reference_text: Expected text for comparison
            sample_rate: Audio sample rate (default: 16000)

        Returns:
            Pronunciation analysis results or None if scorer unavailable
        """
        if not self.pronunciation_scorer:
            logger.warning("Pronunciation scorer not enabled")
            return None

        try:
            # Ensure pronunciation scorer is initialized
            if not self.pronunciation_scorer.is_initialized:
                await self.pronunciation_scorer.initialize()

            # Analyze pronunciation
            analysis = await self.pronunciation_scorer.analyze_pronunciation(
                audio_data, reference_text, sample_rate
            )

            logger.info(
                f"Pronunciation analysis completed: score={analysis.get('overall_score', 0.0):.2f}"
            )
            return analysis

        except Exception as e:
            logger.error(f"Pronunciation analysis failed: {e}")
            return None

    def get_pronunciation_practice_words(
        self, phoneme: str, difficulty_level: int = 1
    ) -> list[str]:
        """Get practice words for a specific phoneme."""
        if not self.pronunciation_scorer:
            return []

        return self.pronunciation_scorer.get_pronunciation_practice_words(
            phoneme, difficulty_level
        )

    def is_pronunciation_scoring_enabled(self) -> bool:
        """Check if pronunciation scoring is available."""
        return self.pronunciation_scorer is not None

    def reset(self):
        """Reset ASR state"""
        with self.lock:
            self.speech_frames = []
            self.silence_count = 0
            self.speech_triggered = False
            self.partial_text = ""
