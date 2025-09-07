"""
Unit tests for PronunciationScorer module.
"""

import asyncio
import importlib.util
from unittest.mock import Mock, patch

import numpy as np
import pytest

# Check if pronunciation dependencies are available
DEPS_AVAILABLE = (
    importlib.util.find_spec("torch") is not None
    and importlib.util.find_spec("whisperx") is not None
)

# Skip all tests if dependencies are not available
pytestmark = pytest.mark.skipif(
    not DEPS_AVAILABLE,
    reason="Pronunciation scoring dependencies (torch, whisperx) not installed",
)

# Import after checking dependencies
# ruff: noqa: E402
from pronunciation_scorer import PronunciationScorer


class TestPronunciationScorer:
    """Test the PronunciationScorer class."""

    def test_pronunciation_scorer_instantiation(self):
        """Test that PronunciationScorer can be instantiated."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()
            assert isinstance(scorer, PronunciationScorer)
            assert hasattr(scorer, "analyze_pronunciation")

    def test_pronunciation_scorer_default_config(self):
        """Test PronunciationScorer with default configuration."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()
            assert scorer.device == "cpu"
            assert scorer.batch_size == 16
            assert scorer.compute_type == "float32"

    def test_pronunciation_scorer_custom_config(self):
        """Test PronunciationScorer with custom configuration."""
        config = {
            "device": "cuda",
            "batch_size": 32,
            "compute_type": "float16",
            "model_name": "large-v3",
        }
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer(config)
            assert scorer.device == "cuda"
            assert scorer.batch_size == 32
            assert scorer.compute_type == "float16"

    def test_bulgarian_phonemes_initialization(self):
        """Test that Bulgarian phonemes are properly initialized."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()
            assert len(scorer.bulgarian_phonemes) == 29
            assert "a" in scorer.bulgarian_phonemes
            assert "ʃ" in scorer.bulgarian_phonemes
            assert "tʃ" in scorer.bulgarian_phonemes

    def test_difficulty_weights_initialization(self):
        """Test that difficulty weights are properly initialized."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()
            assert len(scorer.difficulty_weights) > 0
            # Check that hardest sounds have higher weights
            assert scorer.difficulty_weights[4] > scorer.difficulty_weights[1]
            # Check all expected difficulty levels exist
            assert 1 in scorer.difficulty_weights
            assert 2 in scorer.difficulty_weights
            assert 3 in scorer.difficulty_weights
            assert 4 in scorer.difficulty_weights

    def test_is_initialized_property(self):
        """Test the is_initialized property."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()
            # Initially not initialized until models are loaded
            assert not scorer.is_initialized

    @patch("pronunciation_scorer.whisperx.load_model")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    async def test_initialize_models(self, mock_load_align, mock_load_model):
        """Test model initialization."""
        mock_model = Mock()
        mock_align_model = Mock()
        mock_metadata = {"language": "bg"}

        mock_load_model.return_value = mock_model
        mock_load_align.return_value = (mock_align_model, mock_metadata)

        scorer = PronunciationScorer()
        result = await scorer.initialize()

        assert result is True
        mock_load_model.assert_called_once_with(
            "large-v2", scorer.device, compute_type=scorer.compute_type, language="bg"
        )
        mock_load_align.assert_called_once_with(
            language_code="bg", device=scorer.device, model_name=None
        )
        assert scorer.whisperx_model == mock_model
        assert scorer.alignment_model_obj == mock_align_model
        assert scorer.alignment_metadata == mock_metadata
        assert scorer.is_initialized is True

    @patch("pronunciation_scorer.whisperx.load_model")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    async def test_initialize_models_failure(self, mock_load_align, mock_load_model):
        """Test model initialization failure handling."""
        mock_load_model.side_effect = Exception("Model loading failed")

        scorer = PronunciationScorer()
        result = await scorer.initialize()

        # Should not raise exception, just return False
        assert result is False
        assert not scorer.is_initialized

    def test_text_to_phonemes(self):
        """Test text to phonemes conversion."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test basic conversion
            phonemes = scorer._text_to_phonemes("баба")
            assert isinstance(phonemes, list)
            assert len(phonemes) > 0

            # Test empty string
            phonemes = scorer._text_to_phonemes("")
            assert phonemes == []

    def test_calculate_word_difficulty(self):
        """Test word difficulty calculation."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test with easy phonemes
            easy_difficulty = scorer._calculate_word_difficulty(["a", "b", "m"])
            assert easy_difficulty == 1

            # Test with hard phonemes
            hard_difficulty = scorer._calculate_word_difficulty(["ʃ", "ʒ", "ɤ"])
            assert hard_difficulty >= 3

            # Test empty list
            empty_difficulty = scorer._calculate_word_difficulty([])
            assert empty_difficulty == 1

    def test_score_to_color(self):
        """Test score to color conversion."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test different score ranges (returns hex colors)
            assert scorer._score_to_color(0.9) == "#22c55e"  # Green - good
            assert scorer._score_to_color(0.6) == "#eab308"  # Yellow - okay
            assert scorer._score_to_color(0.3) == "#ef4444"  # Red - poor

            # Test boundary values
            assert scorer._score_to_color(1.0) == "#22c55e"  # Green
            assert scorer._score_to_color(0.0) == "#ef4444"  # Red

    @patch("pronunciation_scorer.whisperx.load_model")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    async def test_analyze_pronunciation_not_initialized(
        self, mock_load_align, mock_load_model
    ):
        """Test analyze_pronunciation when models not initialized."""
        scorer = PronunciationScorer()
        audio_data = np.random.random(16000).astype(np.float32)

        result = await scorer.analyze_pronunciation(audio_data, "тест", 16000)

        # Should return empty analysis with error message
        assert result is not None
        assert "error" in result or result.get("overall_score", 0) == 0

    @patch("pronunciation_scorer.whisperx.align")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    @patch("pronunciation_scorer.whisperx.load_model")
    async def test_analyze_pronunciation_success(
        self, mock_load_model, mock_load_align, mock_align_func
    ):
        """Test successful pronunciation analysis."""
        # Setup mocks
        mock_model = Mock()
        mock_align_model = Mock()
        mock_metadata = {"language": "bg"}

        mock_load_model.return_value = mock_model
        mock_load_align.return_value = (mock_align_model, mock_metadata)

        # Mock transcription result
        mock_transcription = {
            "segments": [
                {
                    "text": "тест",
                    "start": 0.0,
                    "end": 1.0,
                }
            ]
        }
        mock_model.transcribe.return_value = mock_transcription

        # Mock alignment result
        mock_alignment = {
            "segments": [
                {
                    "text": "тест",
                    "start": 0.0,
                    "end": 1.0,
                    "words": [
                        {
                            "word": "тест",
                            "start": 0.0,
                            "end": 1.0,
                            "score": 0.9,
                            "chars": [
                                {"char": "т", "start": 0.0, "end": 0.25, "score": 0.9},
                                {"char": "е", "start": 0.25, "end": 0.5, "score": 0.85},
                                {"char": "с", "start": 0.5, "end": 0.75, "score": 0.8},
                                {"char": "т", "start": 0.75, "end": 1.0, "score": 0.9},
                            ],
                        }
                    ],
                }
            ]
        }
        mock_align_func.return_value = mock_alignment

        scorer = PronunciationScorer()
        await scorer.initialize()

        audio_data = np.random.random(16000).astype(np.float32)
        result = await scorer.analyze_pronunciation(audio_data, "тест", 16000)

        assert result is not None
        assert "overall_score" in result
        assert "phoneme_scores" in result
        assert "visual_feedback" in result
        assert "transcribed_text" in result
        assert result["reference_text"] == "тест"
        assert "suggestions" in result
        assert "confidence" in result

    @patch("pronunciation_scorer.whisperx.load_model")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    async def test_analyze_pronunciation_exception_handling(
        self, mock_load_align, mock_load_model
    ):
        """Test pronunciation analysis exception handling."""
        mock_model = Mock()
        mock_align_model = Mock()
        mock_metadata = {"language": "bg"}

        mock_load_model.return_value = mock_model
        mock_load_align.return_value = (mock_align_model, mock_metadata)

        # Make transcription raise an exception
        mock_model.transcribe.side_effect = Exception("Transcription failed")

        scorer = PronunciationScorer()
        await scorer.initialize()

        audio_data = np.random.random(16000).astype(np.float32)
        result = await scorer.analyze_pronunciation(audio_data, "тест", 16000)

        # Should return empty analysis with error
        assert result is not None
        assert result.get("overall_score", 0) == 0

    def test_get_pronunciation_practice_words(self):
        """Test pronunciation practice word generation."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test getting practice words for a specific phoneme
            words = scorer.get_pronunciation_practice_words("ʃ", 3)
            assert isinstance(words, list)

            # Test with difficulty level
            easy_words = scorer.get_pronunciation_practice_words("a", 1)
            hard_words = scorer.get_pronunciation_practice_words("ʃ", 4)
            assert isinstance(easy_words, list)
            assert isinstance(hard_words, list)

    def test_cleanup(self):
        """Test cleanup method."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()
            scorer.pronunciation_cache = {"test": "data"}

            scorer.cleanup()

            assert len(scorer.pronunciation_cache) == 0

    def test_empty_analysis(self):
        """Test empty analysis generation."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test empty analysis with error message
            result = scorer._empty_analysis("Test error")
            assert isinstance(result, dict)
            assert result["overall_score"] == 0
            assert result["error"] == "Test error"
            assert "visual_feedback" in result
            assert result["visual_feedback"]["timeline"] == []
            assert result["visual_feedback"]["phoneme_heatmap"] == {}

    def test_compute_pronunciation_scores_no_segments(self):
        """Test score computation with no segments."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            aligned_result = {"segments": []}
            result = scorer._compute_pronunciation_scores(
                aligned_result, "test", np.zeros(16000)
            )

            assert result["overall_score"] == 0
            assert "No segments found" in result.get("error", "")

    def test_analyze_word_pronunciation(self):
        """Test single word pronunciation analysis."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            word = {
                "word": "тест",
                "start": 0.0,
                "end": 1.0,
                "score": 0.85,
                "chars": [
                    {"char": "т", "start": 0.0, "end": 0.25, "score": 0.9},
                    {"char": "е", "start": 0.25, "end": 0.5, "score": 0.8},
                    {"char": "с", "start": 0.5, "end": 0.75, "score": 0.85},
                    {"char": "т", "start": 0.75, "end": 1.0, "score": 0.9},
                ],
            }

            result = scorer._analyze_word_pronunciation(
                word, "тест context", np.zeros(16000)
            )

            assert result["word"] == "тест"
            assert result["score"] == 0.85
            assert result["start_time"] == 0.0
            assert result["end_time"] == 1.0
            assert len(result["phonemes"]) == 4
            assert result["difficulty"] >= 1

    def test_analyze_segment_pronunciation(self):
        """Test segment pronunciation analysis (fallback method)."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            segment = {
                "text": "тест сегмент",
                "start": 0.0,
                "end": 2.0,
                "avg_logprob": -0.5,
            }

            result = scorer._analyze_segment_pronunciation(
                segment, "тест сегмент", np.zeros(32000)
            )

            assert result["word"] == "тест сегмент"
            assert 0 <= result["score"] <= 1
            assert result["start_time"] == 0.0
            assert result["end_time"] == 2.0
            assert result["difficulty"] == 2  # Default medium

    def test_generate_visual_feedback(self):
        """Test visual feedback generation."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            word_scores = [
                {
                    "word": "тест",
                    "score": 0.8,
                    "start_time": 0.0,
                    "end_time": 1.0,
                    "phonemes": [
                        {
                            "phoneme": "t",
                            "score": 0.9,
                            "start_time": 0.0,
                            "end_time": 0.25,
                        },
                        {
                            "phoneme": "e",
                            "score": 0.7,
                            "start_time": 0.25,
                            "end_time": 0.5,
                        },
                    ],
                }
            ]

            phoneme_scores = [
                {"phoneme": "t", "score": 0.9},
                {"phoneme": "e", "score": 0.7},
            ]

            result = scorer._generate_visual_feedback(
                word_scores, phoneme_scores, np.zeros(16000)
            )

            assert "timeline" in result
            assert "phoneme_heatmap" in result
            assert "audio_length" in result
            assert result["audio_length"] == 1.0  # 16000 samples at 16kHz

    def test_generate_suggestions(self):
        """Test suggestion generation."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test with problem phonemes
            suggestions = scorer._generate_suggestions(["ʃ", "ʒ"], 0.6)
            assert isinstance(suggestions, list)
            assert len(suggestions) > 0

            # Test with good score
            suggestions = scorer._generate_suggestions([], 0.9)
            assert isinstance(suggestions, list)
            assert any("Great" in s or "Excellent" in s for s in suggestions)

    def test_calculate_analysis_confidence(self):
        """Test confidence calculation."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            segments = [
                {"text": "test", "start": 0.0, "end": 1.0, "avg_logprob": -0.2},
                {"text": "segment", "start": 1.0, "end": 2.0, "avg_logprob": -0.5},
            ]

            confidence = scorer._calculate_analysis_confidence(segments)
            assert 0 <= confidence <= 1

    def test_phoneme_to_ipa_mapping(self):
        """Test phoneme to IPA conversion."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Access the bulgarian_phonemes property
            phonemes = scorer.bulgarian_phonemes

            # Check some common mappings
            assert phonemes["a"]["ipa"] == "a"
            assert phonemes["ʃ"]["ipa"] == "ʃ"
            assert phonemes["ɤ"]["ipa"] == "ɤ"
            assert phonemes["dʒ"]["ipa"] == "dʒ"

    @patch("pronunciation_scorer.whisperx.align")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    @patch("pronunciation_scorer.whisperx.load_model")
    async def test_analyze_pronunciation_with_words(
        self, mock_load_model, mock_load_align, mock_align_func
    ):
        """Test pronunciation analysis with word-level alignment."""
        mock_model = Mock()
        mock_align_model = Mock()
        mock_metadata = {"language": "bg"}

        mock_load_model.return_value = mock_model
        mock_load_align.return_value = (mock_align_model, mock_metadata)

        # Mock transcription with words
        mock_transcription = {
            "segments": [
                {
                    "text": "добро утро",
                    "start": 0.0,
                    "end": 2.0,
                }
            ]
        }
        mock_model.transcribe.return_value = mock_transcription

        # Mock alignment with detailed word and character info
        mock_alignment = {
            "segments": [
                {
                    "text": "добро утро",
                    "start": 0.0,
                    "end": 2.0,
                    "words": [
                        {
                            "word": "добро",
                            "start": 0.0,
                            "end": 1.0,
                            "score": 0.85,
                            "chars": [
                                {"char": "д", "start": 0.0, "end": 0.2, "score": 0.9},
                                {"char": "о", "start": 0.2, "end": 0.4, "score": 0.8},
                                {"char": "б", "start": 0.4, "end": 0.6, "score": 0.85},
                                {"char": "р", "start": 0.6, "end": 0.8, "score": 0.8},
                                {"char": "о", "start": 0.8, "end": 1.0, "score": 0.9},
                            ],
                        },
                        {
                            "word": "утро",
                            "start": 1.0,
                            "end": 2.0,
                            "score": 0.9,
                            "chars": [
                                {"char": "у", "start": 1.0, "end": 1.25, "score": 0.95},
                                {"char": "т", "start": 1.25, "end": 1.5, "score": 0.85},
                                {"char": "р", "start": 1.5, "end": 1.75, "score": 0.85},
                                {"char": "о", "start": 1.75, "end": 2.0, "score": 0.95},
                            ],
                        },
                    ],
                }
            ]
        }
        mock_align_func.return_value = mock_alignment

        scorer = PronunciationScorer()
        await scorer.initialize()

        audio_data = np.random.random(32000).astype(np.float32)
        result = await scorer.analyze_pronunciation(audio_data, "добро утро", 16000)

        assert result is not None
        assert "overall_score" in result
        assert "word_scores" in result
        assert len(result["word_scores"]) == 2
        assert result["word_scores"][0]["word"] == "добро"
        assert result["word_scores"][1]["word"] == "утро"

    @patch("pronunciation_scorer.whisperx.load_model")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    async def test_concurrent_analysis_requests(self, mock_load_align, mock_load_model):
        """Test handling of concurrent analysis requests."""

        mock_model = Mock()
        mock_align_model = Mock()
        mock_metadata = {"language": "bg"}

        mock_load_model.return_value = mock_model
        mock_load_align.return_value = (mock_align_model, mock_metadata)

        scorer = PronunciationScorer()
        await scorer.initialize()

        # Test concurrent initialization attempts
        results = await asyncio.gather(
            scorer.initialize(),
            scorer.initialize(),
            scorer.initialize(),
        )

        # All should return True and only initialize once
        assert all(results)
        mock_load_model.assert_called_once()  # Should only be called once

    def test_device_selection(self):
        """Test device selection based on CUDA availability."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
            patch("pronunciation_scorer.torch.cuda.is_available", return_value=True),
        ):
            # Test with CUDA available
            scorer = PronunciationScorer({"device": "cuda"})
            assert scorer.device == "cuda"

        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
            patch("pronunciation_scorer.torch.cuda.is_available", return_value=False),
        ):
            # Test with CPU fallback
            scorer = PronunciationScorer({"device": "cpu"})
            assert scorer.device == "cpu"
