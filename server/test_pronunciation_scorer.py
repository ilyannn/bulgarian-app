"""
Unit tests for PronunciationScorer module.
"""

from unittest.mock import Mock, patch

import numpy as np
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
            assert scorer.compute_type == "int8"

    def test_pronunciation_scorer_custom_config(self):
        """Test PronunciationScorer with custom configuration."""
        config = {
            "device": "cuda",
            "batch_size": 32,
            "compute_type": "float16",
            "whisper_model": "large-v3",
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
            assert scorer.difficulty_weights[5] > scorer.difficulty_weights[1]

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
    def test_initialize_models(self, mock_load_align, mock_load_model):
        """Test model initialization."""
        mock_model = Mock()
        mock_align_model = Mock()
        mock_metadata = {"language": "bg"}

        mock_load_model.return_value = mock_model
        mock_load_align.return_value = (mock_align_model, mock_metadata)

        scorer = PronunciationScorer()
        scorer._initialize_models()

        mock_load_model.assert_called_once_with(
            "large-v3", scorer.device, compute_type=scorer.compute_type
        )
        mock_load_align.assert_called_once_with(
            language_code="bg", device=scorer.device
        )
        assert scorer.whisperx_model == mock_model
        assert scorer.align_model == mock_align_model
        assert scorer.align_metadata == mock_metadata

    @patch("pronunciation_scorer.whisperx.load_model")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    def test_initialize_models_failure(self, mock_load_align, mock_load_model):
        """Test model initialization failure handling."""
        mock_load_model.side_effect = Exception("Model loading failed")

        scorer = PronunciationScorer()
        scorer._initialize_models()

        # Should not raise exception, just log error
        assert not scorer.is_initialized

    def test_phoneme_to_ipa_mapping(self):
        """Test phoneme to IPA mapping."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test known mappings
            assert scorer._phoneme_to_ipa("SH") == "ʃ"
            assert scorer._phoneme_to_ipa("CH") == "tʃ"
            assert scorer._phoneme_to_ipa("ZH") == "ʒ"
            assert scorer._phoneme_to_ipa("YU") == "ju"

            # Test pass-through for IPA symbols
            assert scorer._phoneme_to_ipa("a") == "a"
            assert scorer._phoneme_to_ipa("i") == "i"

            # Test unknown phoneme
            assert scorer._phoneme_to_ipa("UNKNOWN") == "UNKNOWN"

    def test_calculate_gop_score(self):
        """Test GOP score calculation."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test perfect alignment
            perfect_score = scorer._calculate_gop_score(1.0, 1.0, 1.0)
            assert perfect_score > 0.8

            # Test poor alignment
            poor_score = scorer._calculate_gop_score(0.3, 0.2, 0.4)
            assert poor_score < 0.5

            # Test moderate alignment
            moderate_score = scorer._calculate_gop_score(0.7, 0.6, 0.8)
            assert 0.4 < moderate_score < 0.8

    def test_get_difficulty_level(self):
        """Test difficulty level calculation."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test different score ranges
            assert scorer._get_difficulty_level(0.9) == 1  # Easy
            assert scorer._get_difficulty_level(0.75) == 2  # Medium-easy
            assert scorer._get_difficulty_level(0.55) == 3  # Medium
            assert scorer._get_difficulty_level(0.35) == 4  # Hard
            assert scorer._get_difficulty_level(0.15) == 5  # Very hard

    @patch("pronunciation_scorer.whisperx.load_model")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    def test_analyze_pronunciation_not_initialized(
        self, mock_load_align, mock_load_model
    ):
        """Test analyze_pronunciation when models not initialized."""
        scorer = PronunciationScorer()
        audio_data = np.random.random(16000).astype(np.float32)

        result = scorer.analyze_pronunciation(audio_data, "тест", 16000)

        assert result is None

    @patch("pronunciation_scorer.whisperx.load_model")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    def test_analyze_pronunciation_success(self, mock_load_align, mock_load_model):
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

        with patch("pronunciation_scorer.whisperx.align") as mock_align_func:
            mock_align_func.return_value = mock_alignment

            scorer = PronunciationScorer()
            scorer._initialize_models()

            audio_data = np.random.random(16000).astype(np.float32)
            result = scorer.analyze_pronunciation(audio_data, "тест", 16000)

            assert result is not None
            assert "overall_score" in result
            assert "phoneme_scores" in result
            assert "timing" in result
            assert "transcription" in result
            assert result["reference_text"] == "тест"

    @patch("pronunciation_scorer.whisperx.load_model")
    @patch("pronunciation_scorer.whisperx.load_align_model")
    def test_analyze_pronunciation_exception_handling(
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
        scorer._initialize_models()

        audio_data = np.random.random(16000).astype(np.float32)
        result = scorer.analyze_pronunciation(audio_data, "тест", 16000)

        assert result is None

    def test_get_practice_words(self):
        """Test practice word generation."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test getting practice words for a specific phoneme
            words = scorer.get_practice_words("ʃ", 3)
            assert isinstance(words, list)
            assert len(words) <= 10  # Default limit

            # Test with difficulty level
            easy_words = scorer.get_practice_words("a", 1)
            hard_words = scorer.get_practice_words("ʃ", 5)
            assert isinstance(easy_words, list)
            assert isinstance(hard_words, list)

    def test_get_phoneme_difficulties(self):
        """Test getting phoneme difficulties for L1 language."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Test for different L1 languages
            polish_difficulties = scorer.get_phoneme_difficulties("polish")
            russian_difficulties = scorer.get_phoneme_difficulties("russian")
            ukrainian_difficulties = scorer.get_phoneme_difficulties("ukrainian")
            serbian_difficulties = scorer.get_phoneme_difficulties("serbian")

            assert isinstance(polish_difficulties, dict)
            assert isinstance(russian_difficulties, dict)
            assert isinstance(ukrainian_difficulties, dict)
            assert isinstance(serbian_difficulties, dict)

            # Should contain phonemes with difficulty ratings
            assert len(polish_difficulties) > 0
            for phoneme, difficulty in polish_difficulties.items():
                assert isinstance(phoneme, str)
                assert 1 <= difficulty <= 5

    def test_get_phoneme_difficulties_unknown_language(self):
        """Test getting phoneme difficulties for unknown L1 language."""
        with (
            patch("pronunciation_scorer.whisperx.load_model"),
            patch("pronunciation_scorer.whisperx.load_align_model"),
        ):
            scorer = PronunciationScorer()

            # Should return empty dict for unknown language
            unknown_difficulties = scorer.get_phoneme_difficulties("unknown")
            assert isinstance(unknown_difficulties, dict)
            assert len(unknown_difficulties) == 0
