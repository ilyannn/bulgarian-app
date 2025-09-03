"""
Pronunciation scoring module using WhisperX for phoneme-level analysis.

This module provides pronunciation assessment capabilities for Bulgarian speech,
focusing on phoneme-level accuracy scoring and visual feedback generation.
"""

import logging
import threading

import numpy as np
import torch
import whisperx

logger = logging.getLogger(__name__)


class PronunciationScorer:
    """
    Pronunciation scoring system using WhisperX for Bulgarian phoneme analysis.

    This class provides phoneme-level pronunciation assessment by:
    1. Using WhisperX for word-level timestamps and phoneme alignment
    2. Computing Goodness of Pronunciation (GOP) scores
    3. Providing visual feedback data for the frontend
    """

    def __init__(self, config: dict | None = None):
        """Initialize pronunciation scorer with configurable parameters.

        Args:
            config: Optional configuration dict with:
                - device: Device to run models on ('cpu', 'cuda')
                - compute_type: Compute type for WhisperX ('float32', 'float16', 'int8')
                - batch_size: Batch size for WhisperX alignment
                - model_name: WhisperX model name (default: 'large-v2')
                - alignment_model: Custom alignment model for Bulgarian
        """
        config = config or {}

        # Configuration
        self.device = config.get("device", "cpu")
        self.compute_type = config.get("compute_type", "float32")
        self.batch_size = config.get("batch_size", 16)
        self.model_name = config.get("model_name", "large-v2")
        self.alignment_model = config.get("alignment_model", None)

        # Models
        self.whisperx_model = None
        self.alignment_model_obj = None
        self.alignment_metadata = None
        self.is_initialized = False

        # Thread safety
        self.lock = threading.Lock()

        # Bulgarian phoneme mapping and scoring weights
        self.bulgarian_phonemes = self._init_bulgarian_phonemes()
        self.difficulty_weights = self._init_difficulty_weights()

        # Cache for common phrases
        self.pronunciation_cache = {}
        self.cache_max_size = 50

    def _init_bulgarian_phonemes(self) -> dict[str, dict]:
        """Initialize Bulgarian phoneme information.

        Returns:
            Dictionary mapping phonemes to their characteristics.
        """
        return {
            # Vowels
            "a": {"type": "vowel", "difficulty": 1, "ipa": "a"},
            "ɤ": {"type": "vowel", "difficulty": 4, "ipa": "ɤ"},  # Bulgarian-specific
            "e": {"type": "vowel", "difficulty": 1, "ipa": "e"},
            "i": {"type": "vowel", "difficulty": 1, "ipa": "i"},
            "o": {"type": "vowel", "difficulty": 1, "ipa": "o"},
            "u": {"type": "vowel", "difficulty": 2, "ipa": "u"},
            # Consonants - Common
            "b": {"type": "consonant", "difficulty": 1, "ipa": "b"},
            "d": {"type": "consonant", "difficulty": 1, "ipa": "d"},
            "f": {"type": "consonant", "difficulty": 1, "ipa": "f"},
            "g": {"type": "consonant", "difficulty": 1, "ipa": "g"},
            "k": {"type": "consonant", "difficulty": 1, "ipa": "k"},
            "l": {"type": "consonant", "difficulty": 2, "ipa": "l"},
            "m": {"type": "consonant", "difficulty": 1, "ipa": "m"},
            "n": {"type": "consonant", "difficulty": 1, "ipa": "n"},
            "p": {"type": "consonant", "difficulty": 1, "ipa": "p"},
            "r": {"type": "consonant", "difficulty": 3, "ipa": "r"},
            "s": {"type": "consonant", "difficulty": 1, "ipa": "s"},
            "t": {"type": "consonant", "difficulty": 1, "ipa": "t"},
            "v": {"type": "consonant", "difficulty": 1, "ipa": "v"},
            "z": {"type": "consonant", "difficulty": 2, "ipa": "z"},
            # Consonants - Complex
            "ʃ": {"type": "consonant", "difficulty": 3, "ipa": "ʃ"},  # ш
            "ʒ": {"type": "consonant", "difficulty": 3, "ipa": "ʒ"},  # ж
            "tʃ": {"type": "consonant", "difficulty": 4, "ipa": "tʃ"},  # ч
            "dʒ": {"type": "consonant", "difficulty": 4, "ipa": "dʒ"},  # дж
            "ts": {"type": "consonant", "difficulty": 3, "ipa": "ts"},  # ц
            "x": {"type": "consonant", "difficulty": 3, "ipa": "x"},  # х
            "j": {"type": "consonant", "difficulty": 2, "ipa": "j"},  # й
            # Palatalized consonants (Bulgarian-specific challenges)
            "lʲ": {"type": "consonant", "difficulty": 4, "ipa": "lʲ"},  # ль
            "nʲ": {"type": "consonant", "difficulty": 4, "ipa": "nʲ"},  # нь
        }

    def _init_difficulty_weights(self) -> dict[int, float]:
        """Initialize difficulty-based scoring weights.

        Returns:
            Dictionary mapping difficulty levels to scoring weights.
        """
        return {
            1: 1.0,  # Easy sounds - full weight
            2: 1.2,  # Medium sounds - slight weight increase
            3: 1.5,  # Hard sounds - moderate weight increase
            4: 2.0,  # Very hard sounds - double weight
        }

    async def initialize(self) -> bool:
        """Initialize WhisperX models asynchronously.

        Returns:
            True if initialization successful, False otherwise.
        """
        with self.lock:
            if self.is_initialized:
                return True

            try:
                logger.info("Initializing WhisperX pronunciation scorer...")

                # Load WhisperX model
                self.whisperx_model = whisperx.load_model(
                    self.model_name,
                    self.device,
                    compute_type=self.compute_type,
                    language="bg",
                )
                logger.info("✅ WhisperX model loaded successfully")

                # Load alignment model for Bulgarian
                try:
                    self.alignment_model_obj, self.alignment_metadata = (
                        whisperx.load_align_model(
                            language_code="bg",
                            device=self.device,
                            model_name=self.alignment_model,
                        )
                    )
                    logger.info("✅ Bulgarian alignment model loaded successfully")
                except Exception as e:
                    logger.warning(f"Bulgarian alignment model not available: {e}")
                    logger.info("Falling back to multilingual alignment model")
                    try:
                        self.alignment_model_obj, self.alignment_metadata = (
                            whisperx.load_align_model(
                                language_code="en",  # Fallback to English model
                                device=self.device,
                            )
                        )
                        logger.info("✅ Fallback alignment model loaded")
                    except Exception as fallback_error:
                        logger.error(
                            f"Failed to load fallback alignment model: {fallback_error}"
                        )
                        return False

                self.is_initialized = True
                logger.info("🎯 Pronunciation scorer initialized successfully")
                return True

            except Exception as e:
                logger.error(f"Failed to initialize pronunciation scorer: {e}")
                self.is_initialized = False
                return False

    async def analyze_pronunciation(
        self, audio_data: np.ndarray, reference_text: str, sample_rate: int = 16000
    ) -> dict:
        """
        Analyze pronunciation quality of audio against reference text.

        Args:
            audio_data: Audio data as numpy array (float32, normalized)
            reference_text: Expected text for comparison
            sample_rate: Audio sample rate (default: 16000)

        Returns:
            Dictionary containing pronunciation analysis results:
            {
                'overall_score': float,  # 0.0-1.0 overall pronunciation score
                'word_scores': List[Dict],  # Per-word pronunciation scores
                'phoneme_scores': List[Dict],  # Per-phoneme scores
                'problem_phonemes': List[str],  # Problematic phonemes
                'visual_feedback': Dict,  # Data for visual feedback
                'suggestions': List[str]  # Improvement suggestions
            }
        """
        if not self.is_initialized:
            await self.initialize()
            if not self.is_initialized:
                return self._empty_analysis("Pronunciation scorer not initialized")

        try:
            # Convert audio to proper format for WhisperX
            if len(audio_data.shape) > 1:
                audio_data = audio_data.mean(axis=1)  # Convert to mono if stereo

            # Ensure proper sample rate
            if sample_rate != 16000:
                import torchaudio.transforms as T

                resampler = T.Resample(sample_rate, 16000)
                audio_tensor = torch.from_numpy(audio_data)
                audio_data = resampler(audio_tensor).numpy()

            # Transcribe with WhisperX
            transcription_result = self.whisperx_model.transcribe(
                audio_data, batch_size=self.batch_size, language="bg"
            )

            # Align transcription if alignment model is available
            if self.alignment_model_obj is not None:
                aligned_result = whisperx.align(
                    transcription_result["segments"],
                    self.alignment_model_obj,
                    self.alignment_metadata,
                    audio_data,
                    self.device,
                    return_char_alignments=True,
                )
            else:
                # Use word-level timestamps from transcription
                aligned_result = transcription_result

            # Compute pronunciation scores
            analysis = self._compute_pronunciation_scores(
                aligned_result, reference_text, audio_data
            )

            return analysis

        except Exception as e:
            logger.error(f"Pronunciation analysis failed: {e}")
            return self._empty_analysis(f"Analysis failed: {str(e)}")

    def _compute_pronunciation_scores(
        self, aligned_result: dict, reference_text: str, audio_data: np.ndarray
    ) -> dict:
        """
        Compute detailed pronunciation scores from aligned results.

        Args:
            aligned_result: WhisperX alignment results
            reference_text: Expected reference text
            audio_data: Original audio data

        Returns:
            Detailed pronunciation analysis dictionary
        """
        try:
            segments = aligned_result.get("segments", [])
            if not segments:
                return self._empty_analysis("No segments found in alignment")

            # Extract transcribed text
            transcribed_text = " ".join(
                [seg.get("text", "").strip() for seg in segments]
            )

            # Initialize results
            word_scores = []
            phoneme_scores = []
            problem_phonemes = []
            overall_scores = []

            # Analyze each segment
            for segment in segments:
                segment_text = segment.get("text", "").strip()

                # Get word-level analysis if available
                words = segment.get("words", [])
                if words:
                    for word in words:
                        word_analysis = self._analyze_word_pronunciation(
                            word, segment_text, audio_data
                        )
                        word_scores.append(word_analysis)
                        overall_scores.append(word_analysis["score"])

                        # Extract phoneme-level scores
                        if "phonemes" in word_analysis:
                            phoneme_scores.extend(word_analysis["phonemes"])

                        # Collect problem phonemes
                        if (
                            word_analysis["score"] < 0.6
                        ):  # Threshold for problematic words
                            problem_phonemes.extend(
                                word_analysis.get("problem_phonemes", [])
                            )
                else:
                    # Fallback: analyze at segment level
                    segment_analysis = self._analyze_segment_pronunciation(
                        segment, reference_text, audio_data
                    )
                    word_scores.append(segment_analysis)
                    overall_scores.append(segment_analysis["score"])

            # Compute overall score
            overall_score = np.mean(overall_scores) if overall_scores else 0.0

            # Generate visual feedback data
            visual_feedback = self._generate_visual_feedback(
                word_scores, phoneme_scores, audio_data
            )

            # Generate improvement suggestions
            suggestions = self._generate_suggestions(problem_phonemes, overall_score)

            return {
                "overall_score": float(overall_score),
                "word_scores": word_scores,
                "phoneme_scores": phoneme_scores,
                "problem_phonemes": list(set(problem_phonemes)),
                "transcribed_text": transcribed_text,
                "reference_text": reference_text,
                "visual_feedback": visual_feedback,
                "suggestions": suggestions,
                "confidence": self._calculate_analysis_confidence(segments),
            }

        except Exception as e:
            logger.error(f"Error computing pronunciation scores: {e}")
            return self._empty_analysis(f"Score computation failed: {str(e)}")

    def _analyze_word_pronunciation(
        self, word: dict, context: str, audio_data: np.ndarray
    ) -> dict:
        """Analyze pronunciation of a single word."""
        word_text = word.get("word", "").strip()
        word_start = word.get("start", 0.0)
        word_end = word.get("end", 0.0)
        word_score = word.get("score", 0.7)  # Default confidence as proxy for score

        # Basic phoneme analysis (simplified)
        phonemes = self._text_to_phonemes(word_text)
        phoneme_scores = []
        problem_phonemes = []

        for phoneme in phonemes:
            phoneme_info = self.bulgarian_phonemes.get(phoneme, {})
            difficulty = phoneme_info.get("difficulty", 2)

            # Compute phoneme score (simplified GOP-like calculation)
            base_score = word_score
            difficulty_penalty = 1.0 - (difficulty - 1) * 0.1
            phoneme_score = min(1.0, max(0.0, base_score * difficulty_penalty))

            phoneme_data = {
                "phoneme": phoneme,
                "score": phoneme_score,
                "difficulty": difficulty,
                "start_time": word_start,
                "end_time": word_end,
                "ipa": phoneme_info.get("ipa", phoneme),
            }

            phoneme_scores.append(phoneme_data)

            if phoneme_score < 0.6:
                problem_phonemes.append(phoneme)

        return {
            "word": word_text,
            "score": float(word_score),
            "start_time": word_start,
            "end_time": word_end,
            "phonemes": phoneme_scores,
            "problem_phonemes": problem_phonemes,
            "difficulty": self._calculate_word_difficulty(phonemes),
        }

    def _analyze_segment_pronunciation(
        self, segment: dict, reference: str, audio_data: np.ndarray
    ) -> dict:
        """Analyze pronunciation of an entire segment (fallback method)."""
        segment_text = segment.get("text", "").strip()
        segment_start = segment.get("start", 0.0)
        segment_end = segment.get("end", 0.0)

        # Use average log probability as proxy for pronunciation score
        avg_logprob = segment.get("avg_logprob", -1.0)
        score = min(1.0, max(0.0, (avg_logprob + 1.0) / 1.0))  # Normalize to 0-1

        return {
            "word": segment_text,
            "score": float(score),
            "start_time": segment_start,
            "end_time": segment_end,
            "phonemes": [],
            "problem_phonemes": [],
            "difficulty": 2,  # Medium difficulty as default
        }

    def _text_to_phonemes(self, text: str) -> list[str]:
        """
        Convert Bulgarian text to phonemes (simplified mapping).

        This is a basic implementation. In production, you'd want to use
        a proper Bulgarian phonetic dictionary or G2P model.
        """
        # Simplified Bulgarian to phoneme mapping
        phoneme_map = {
            "а": "a",
            "ъ": "ɤ",
            "е": "e",
            "и": "i",
            "о": "o",
            "у": "u",
            "б": "b",
            "в": "v",
            "г": "g",
            "д": "d",
            "ж": "ʒ",
            "з": "z",
            "к": "k",
            "л": "l",
            "м": "m",
            "н": "n",
            "п": "p",
            "р": "r",
            "с": "s",
            "т": "t",
            "ф": "f",
            "х": "x",
            "ц": "ts",
            "ч": "tʃ",
            "ш": "ʃ",
            "щ": "ʃt",
            "ь": "ʲ",
            "ю": "ju",
            "я": "ja",
        }

        phonemes = []
        text = text.lower()

        i = 0
        while i < len(text):
            char = text[i]

            # Check for digraphs first
            if i < len(text) - 1:
                digraph = char + text[i + 1]
                if digraph in phoneme_map:
                    phonemes.append(phoneme_map[digraph])
                    i += 2
                    continue

            # Single character mapping
            if char in phoneme_map:
                phonemes.append(phoneme_map[char])
            elif char.isalpha():
                phonemes.append(char)  # Fallback for unmapped characters

            i += 1

        return phonemes

    def _calculate_word_difficulty(self, phonemes: list[str]) -> int:
        """Calculate overall difficulty of a word based on its phonemes."""
        if not phonemes:
            return 1

        difficulties = [
            self.bulgarian_phonemes.get(p, {}).get("difficulty", 2) for p in phonemes
        ]

        return int(np.mean(difficulties))

    def _generate_visual_feedback(
        self,
        word_scores: list[dict],
        phoneme_scores: list[dict],
        audio_data: np.ndarray,
    ) -> dict:
        """Generate data for visual feedback components."""

        # Create timeline data for waveform visualization
        timeline = []
        for word in word_scores:
            timeline.append(
                {
                    "start": word["start_time"],
                    "end": word["end_time"],
                    "text": word["word"],
                    "score": word["score"],
                    "color": self._score_to_color(word["score"]),
                }
            )

        # Create phoneme heatmap data
        phoneme_heatmap = {}
        for phoneme_data in phoneme_scores:
            phoneme = phoneme_data["phoneme"]
            score = phoneme_data["score"]

            if phoneme not in phoneme_heatmap:
                phoneme_heatmap[phoneme] = []
            phoneme_heatmap[phoneme].append(score)

        # Average scores for each phoneme
        for phoneme in phoneme_heatmap:
            scores = phoneme_heatmap[phoneme]
            phoneme_heatmap[phoneme] = {
                "average_score": np.mean(scores),
                "count": len(scores),
                "color": self._score_to_color(np.mean(scores)),
            }

        return {
            "timeline": timeline,
            "phoneme_heatmap": phoneme_heatmap,
            "audio_length": len(audio_data) / 16000.0,  # Assuming 16kHz
        }

    def _score_to_color(self, score: float) -> str:
        """Convert pronunciation score to color for visual feedback."""
        if score >= 0.8:
            return "#22c55e"  # Green - good
        elif score >= 0.6:
            return "#eab308"  # Yellow - okay
        elif score >= 0.4:
            return "#f97316"  # Orange - needs work
        else:
            return "#ef4444"  # Red - poor

    def _generate_suggestions(
        self, problem_phonemes: list[str], overall_score: float
    ) -> list[str]:
        """Generate improvement suggestions based on analysis."""
        suggestions = []

        if overall_score < 0.5:
            suggestions.append(
                "Overall pronunciation needs significant improvement. Consider practicing with slower speech."
            )
        elif overall_score < 0.7:
            suggestions.append(
                "Good progress! Focus on the specific sounds highlighted in red."
            )
        else:
            suggestions.append(
                "Excellent pronunciation! Keep practicing to maintain consistency."
            )

        # Specific phoneme suggestions
        unique_problems = list(set(problem_phonemes))
        if unique_problems:
            for phoneme in unique_problems[:3]:  # Limit to top 3 problems
                if phoneme == "ɤ":
                    suggestions.append(
                        "The Bulgarian 'ъ' sound is unique - practice with 'къде' and 'възможно'"
                    )
                elif phoneme == "r":
                    suggestions.append(
                        "Practice rolling your R's - try 'река', 'работа', 'прекрасен'"
                    )
                elif phoneme in ["ʃ", "ʒ"]:
                    suggestions.append(
                        "Focus on Bulgarian 'ш' and 'ж' sounds - they're softer than in other languages"
                    )

        return suggestions

    def _calculate_analysis_confidence(self, segments: list[dict]) -> float:
        """Calculate confidence in the pronunciation analysis."""
        if not segments:
            return 0.0

        confidences = []
        for segment in segments:
            # Use average log probability as confidence measure
            avg_logprob = segment.get("avg_logprob", -2.0)
            confidence = min(1.0, max(0.0, (avg_logprob + 1.0) / 1.0))
            confidences.append(confidence)

        return float(np.mean(confidences))

    def _empty_analysis(self, error_message: str) -> dict:
        """Return empty analysis result with error message."""
        return {
            "overall_score": 0.0,
            "word_scores": [],
            "phoneme_scores": [],
            "problem_phonemes": [],
            "transcribed_text": "",
            "reference_text": "",
            "visual_feedback": {
                "timeline": [],
                "phoneme_heatmap": {},
                "audio_length": 0.0,
            },
            "suggestions": [f"Analysis unavailable: {error_message}"],
            "confidence": 0.0,
            "error": error_message,
        }

    def get_pronunciation_practice_words(
        self, phoneme: str, difficulty_level: int = 1
    ) -> list[str]:
        """
        Get practice words for a specific phoneme.

        Args:
            phoneme: Target phoneme to practice
            difficulty_level: Difficulty level (1-4)

        Returns:
            List of practice words containing the target phoneme
        """
        # Basic practice word database for Bulgarian phonemes
        practice_words = {
            "ɤ": ["къде", "място", "възможно", "сърце", "първи"],
            "r": ["река", "работа", "прекрасен", "право", "предлогa"],
            "ʃ": ["шоколад", "машина", "пише", "душа", "каша"],
            "ʒ": ["жена", "можем", "ножа", "железница", "оже"],
            "tʃ": ["час", "чаша", "учебник", "червен", "чудесен"],
            "x": ["хубав", "хляб", "характер", "химия", "хотел"],
            "ts": ["център", "цвете", "цена", "процент", "концерт"],
        }

        return practice_words.get(phoneme, [])

    def cleanup(self):
        """Clean up models and free memory."""
        with self.lock:
            if self.whisperx_model:
                del self.whisperx_model
                self.whisperx_model = None

            if self.alignment_model_obj:
                del self.alignment_model_obj
                self.alignment_model_obj = None

            self.alignment_metadata = None
            self.is_initialized = False

            # Clear cache
            self.pronunciation_cache.clear()

            # Clear GPU memory if using CUDA
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            logger.info("Pronunciation scorer cleaned up")
