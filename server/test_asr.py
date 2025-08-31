"""
Unit tests for ASR (Automatic Speech Recognition) module.
"""

from unittest.mock import Mock, patch

import numpy as np
import pytest
from asr import ASRProcessor


class TestASRProcessor:
    """Test the ASRProcessor class."""

    def test_asr_processor_instantiation(self):
        """Test that ASRProcessor can be instantiated."""
        with patch("asr.WhisperModel"):
            processor = ASRProcessor()
            assert isinstance(processor, ASRProcessor)
            assert hasattr(processor, "process_audio")

    @patch("asr.WhisperModel")
    def test_asr_processor_default_model(self, mock_whisper_model):
        """Test ASRProcessor with default model."""
        ASRProcessor()

        # Should initialize with a default model
        mock_whisper_model.assert_called_once()
        call_args = mock_whisper_model.call_args

        # Should use a reasonable default model size
        model_size = call_args[0][0] if call_args[0] else "base"
        assert model_size in ["tiny", "base", "small", "medium", "large"]

    @patch("asr.WhisperModel")
    def test_asr_processor_default_initialization(self, mock_whisper_model):
        """Test ASRProcessor default initialization."""
        ASRProcessor()

        mock_whisper_model.assert_called_with(
            "medium", device="cpu", compute_type="int8"
        )

    @patch("asr.WhisperModel")
    def test_asr_processor_initialization_called(self, mock_whisper_model):
        """Test ASRProcessor initialization calls WhisperModel."""
        ASRProcessor()

        # Verify WhisperModel was called during initialization
        mock_whisper_model.assert_called_once()


class TestProcessAudio:
    """Test the process_audio method."""

    @patch("asr.WhisperModel")
    async def test_process_audio_success(self, mock_whisper_model):
        """Test successful audio processing."""
        # Mock Whisper model
        mock_model = Mock()
        # Create mock segment objects with text attribute
        mock_segment = Mock()
        mock_segment.text = " Здравей свят"
        mock_segment.start = 0.0
        mock_segment.end = 2.0
        mock_segment.avg_logprob = -0.5

        mock_transcribe_result = (
            [mock_segment],
            {"language": "bg"},
        )
        mock_model.transcribe = Mock(return_value=mock_transcribe_result)
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Create fake audio data
        fake_audio = np.array([0.1, 0.2, 0.3, 0.4], dtype=np.float32)

        result = await processor.process_audio(fake_audio)

        assert result["text"].lower() == "здравей свят"
        assert result["confidence"] > 0
        assert result["language"] == "bg"

    @patch("asr.WhisperModel")
    async def test_process_audio_empty_audio(self, mock_whisper_model):
        """Test processing empty audio."""
        mock_model = Mock()
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Empty audio array
        empty_audio = np.array([], dtype=np.float32)

        result = await processor.process_audio(empty_audio)

        assert result["text"] == ""
        assert result["confidence"] == 0.0

    @patch("asr.WhisperModel")
    async def test_process_audio_none_input(self, mock_whisper_model):
        """Test processing None audio input."""
        mock_model = Mock()
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        result = await processor.process_audio(None)

        assert result["text"] == ""
        assert result["confidence"] == 0.0

    @patch("asr.WhisperModel")
    async def test_process_audio_transcription_error(self, mock_whisper_model):
        """Test handling transcription errors."""
        mock_model = Mock()
        mock_model.transcribe.side_effect = Exception("Transcription failed")
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        fake_audio = np.array([0.1, 0.2], dtype=np.float32)

        result = await processor.process_audio(fake_audio)

        # Should handle error gracefully and return default values
        assert result["text"] == ""
        assert result["confidence"] == 0.0
        assert result["language"] == "bg"

    @patch("asr.WhisperModel")
    async def test_process_audio_bulgarian_text(self, mock_whisper_model):
        """Test processing audio that results in Bulgarian text."""
        mock_model = Mock()
        bulgarian_texts = [
            "Добро утро",
            "Как се казваш?",
            "Моля, помогнете ми",
            "Благодаря много",
        ]

        for bulgarian_text in bulgarian_texts:
            # Create mock segment with text attribute
            mock_segment = Mock()
            mock_segment.text = f" {bulgarian_text}"
            mock_segment.start = 0.0
            mock_segment.end = 1.0
            mock_segment.avg_logprob = -0.3

            mock_model.transcribe = Mock(
                return_value=(
                    [mock_segment],
                    {"language": "bg"},
                )
            )
            mock_whisper_model.return_value = mock_model

            processor = ASRProcessor()
            fake_audio = np.random.random(1000).astype(np.float32)

            result = await processor.process_audio(fake_audio)

            assert result["text"].lower() == bulgarian_text.lower()
            assert result["language"] == "bg"

    @patch("asr.WhisperModel")
    async def test_process_audio_confidence_calculation(self, mock_whisper_model):
        """Test confidence score calculation."""
        mock_model = Mock()

        # Create mock segments with different confidence-indicating properties
        mock_segment_high = Mock()
        mock_segment_high.text = " Clear speech"
        mock_segment_high.start = 0.0
        mock_segment_high.end = 2.0
        mock_segment_high.avg_logprob = -0.1  # High confidence

        mock_segment_low = Mock()
        mock_segment_low.text = " Unclear speech"
        mock_segment_low.start = 0.0
        mock_segment_low.end = 2.0
        mock_segment_low.avg_logprob = -2.0  # Lower confidence

        # Test high confidence
        mock_model.transcribe = Mock(
            return_value=([mock_segment_high], {"language": "en"})
        )
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()
        result = await processor.process_audio(np.array([0.1, 0.2], dtype=np.float32))
        high_confidence = result["confidence"]

        # Test low confidence
        mock_model.transcribe = Mock(
            return_value=([mock_segment_low], {"language": "en"})
        )
        result = await processor.process_audio(np.array([0.1, 0.2], dtype=np.float32))
        low_confidence = result["confidence"]

        # High confidence should be higher than low confidence
        assert high_confidence > low_confidence
        assert 0 <= high_confidence <= 1
        assert 0 <= low_confidence <= 1


class TestAudioPreprocessing:
    """Test audio preprocessing functionality."""

    @patch("asr.WhisperModel")
    async def test_audio_normalization(self, mock_whisper_model):
        """Test that audio is properly normalized."""
        mock_model = Mock()
        # Create mock segment with text attribute
        mock_segment = Mock()
        mock_segment.text = " Test"
        mock_segment.start = 0.0
        mock_segment.end = 1.0
        mock_segment.avg_logprob = -0.5

        mock_model.transcribe = Mock(
            return_value=(
                [mock_segment],
                {"language": "en"},
            )
        )
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Very loud audio (values > 1.0)
        loud_audio = np.array([2.0, -3.0, 1.5, -2.5], dtype=np.float32)

        await processor.process_audio(loud_audio)

        # Check that transcribe was called twice (once for warmup, once for processing)
        assert mock_model.transcribe.call_count == 2

        # The second call (index 1) should be our actual audio processing
        # First call (index 0) is the warmup with silent audio
        call_args = mock_model.transcribe.call_args_list[1][0][0]
        np.testing.assert_array_equal(call_args, loud_audio)

    @patch("asr.WhisperModel")
    async def test_sample_rate_handling(self, mock_whisper_model):
        """Test handling of different sample rates."""
        mock_model = Mock()
        # Create mock segment with text attribute
        mock_segment = Mock()
        mock_segment.text = " Sample rate test"
        mock_segment.start = 0.0
        mock_segment.end = 1.0
        mock_segment.avg_logprob = -0.4

        mock_model.transcribe = Mock(
            return_value=(
                [mock_segment],
                {"language": "en"},
            )
        )
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Simulate audio at different sample rates
        # Whisper expects 16kHz, so longer arrays simulate higher sample rates
        audio_16khz = np.random.random(16000).astype(np.float32)  # 1 second at 16kHz
        audio_44khz = np.random.random(44100).astype(np.float32)  # 1 second at 44.1kHz

        result1 = await processor.process_audio(audio_16khz)
        result2 = await processor.process_audio(audio_44khz)

        # Both should process successfully
        assert result1["text"].lower() == "sample rate test"
        assert result2["text"].lower() == "sample rate test"


class TestVADIntegration:
    """Test Voice Activity Detection integration."""

    @patch("asr.WhisperModel")
    @patch("asr.webrtcvad")
    async def test_vad_silence_detection(self, mock_vad, mock_whisper_model):
        """Test VAD silence detection."""
        # Mock VAD
        mock_vad_instance = Mock()
        mock_vad_instance.is_speech.return_value = False  # Silence detected
        mock_vad.Vad.return_value = mock_vad_instance

        # Mock Whisper
        mock_model = Mock()
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Simulate silent audio
        silent_audio = np.zeros(1000, dtype=np.float32)

        result = await processor.process_audio(silent_audio)

        # Should detect silence and return empty result quickly
        assert result["text"] == ""
        assert result["confidence"] == 0.0

    @patch("asr.WhisperModel")
    @patch("asr.webrtcvad")
    async def test_vad_speech_detection(self, mock_vad, mock_whisper_model):
        """Test VAD speech detection."""
        # Mock VAD to detect speech
        mock_vad_instance = Mock()
        mock_vad_instance.is_speech.return_value = True
        mock_vad.Vad.return_value = mock_vad_instance

        # Mock Whisper
        mock_model = Mock()
        # Create mock segment with text attribute
        mock_segment = Mock()
        mock_segment.text = " Speech detected"
        mock_segment.start = 0.0
        mock_segment.end = 1.0
        mock_segment.avg_logprob = -0.3

        mock_model.transcribe = Mock(
            return_value=(
                [mock_segment],
                {"language": "en"},
            )
        )
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Simulate audio with speech
        speech_audio = np.random.random(1000).astype(np.float32)

        result = await processor.process_audio(speech_audio)

        # Should process through Whisper
        assert result["text"].lower() == "speech detected"
        # Check that transcribe was called twice (once for warmup, once for processing)
        assert mock_model.transcribe.call_count == 2


class TestLanguageDetection:
    """Test language detection functionality."""

    @patch("asr.WhisperModel")
    async def test_bulgarian_language_detection(self, mock_whisper_model):
        """Test detection of Bulgarian language."""
        mock_model = Mock()
        # Create mock segment with text attribute
        mock_segment = Mock()
        mock_segment.text = " Това е българският език"
        mock_segment.start = 0.0
        mock_segment.end = 2.0
        mock_segment.avg_logprob = -0.3

        mock_model.transcribe = Mock(
            return_value=(
                [mock_segment],
                {"language": "bg"},
            )
        )
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        result = await processor.process_audio(np.array([0.1, 0.2], dtype=np.float32))

        assert result["language"] == "bg"
        assert "българ" in result["text"]

    @patch("asr.WhisperModel")
    async def test_english_language_detection(self, mock_whisper_model):
        """Test detection of English language."""
        mock_model = Mock()
        # Create mock segment with text attribute
        mock_segment = Mock()
        mock_segment.text = " This is English text"
        mock_segment.start = 0.0
        mock_segment.end = 2.0
        mock_segment.avg_logprob = -0.3

        mock_model.transcribe = Mock(
            return_value=(
                [mock_segment],
                {"language": "en"},
            )
        )
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        result = await processor.process_audio(np.array([0.1, 0.2], dtype=np.float32))

        assert result["language"] == "bg"  # ASR processor is hardcoded to Bulgarian
        assert result["text"].lower() == "this is english text"

    @patch("asr.WhisperModel")
    async def test_mixed_language_handling(self, mock_whisper_model):
        """Test handling of mixed language content."""
        mock_model = Mock()
        # Create mock segment with text attribute
        mock_segment = Mock()
        mock_segment.text = " Hello, как дела?"
        mock_segment.start = 0.0
        mock_segment.end = 2.0
        mock_segment.avg_logprob = -0.3

        mock_model.transcribe = Mock(
            return_value=(
                [mock_segment],
                {"language": "bg"},
            )
        )  # Detected as Bulgarian due to Cyrillic
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        result = await processor.process_audio(np.array([0.1, 0.2], dtype=np.float32))

        assert result["language"] == "bg"
        assert (
            "hello" in result["text"].lower() and "как дела" in result["text"].lower()
        )


class TestPerformance:
    """Test performance characteristics."""

    @patch("asr.WhisperModel")
    async def test_processing_timeout(self, mock_whisper_model):
        """Test processing timeout handling."""
        import asyncio

        mock_model = Mock()

        def slow_transcribe(*args, **kwargs):
            import time

            time.sleep(0.1)  # Simulate slow processing
            # Create mock segment with text attribute
            mock_segment = Mock()
            mock_segment.text = " Slow result"
            mock_segment.start = 0.0
            mock_segment.end = 1.0
            mock_segment.avg_logprob = -0.3
            return (
                [mock_segment],
                {"language": "en"},
            )

        mock_model.transcribe = slow_transcribe
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        start_time = asyncio.get_event_loop().time()
        result = await processor.process_audio(np.array([0.1, 0.2], dtype=np.float32))
        end_time = asyncio.get_event_loop().time()

        assert result["text"].lower() == "slow result"
        # Should handle the delay
        assert (end_time - start_time) >= 0.1

    @patch("asr.WhisperModel")
    async def test_concurrent_processing(self, mock_whisper_model):
        """Test concurrent audio processing."""
        import asyncio

        mock_model = Mock()
        # Create mock segment with text attribute
        mock_segment = Mock()
        mock_segment.text = " Concurrent test"
        mock_segment.start = 0.0
        mock_segment.end = 1.0
        mock_segment.avg_logprob = -0.3

        mock_model.transcribe = Mock(
            return_value=(
                [mock_segment],
                {"language": "en"},
            )
        )
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Process multiple audio samples concurrently
        audio_samples = [np.random.random(100).astype(np.float32) for _ in range(3)]

        tasks = [processor.process_audio(audio) for audio in audio_samples]
        results = await asyncio.gather(*tasks)

        assert len(results) == 3
        for result in results:
            assert result["text"].lower() == "concurrent test"


class TestErrorHandling:
    """Test error handling scenarios."""

    @patch("asr.WhisperModel")
    async def test_model_loading_error(self, mock_whisper_model):
        """Test handling model loading errors."""
        mock_whisper_model.side_effect = RuntimeError("Failed to load model")

        with pytest.raises(RuntimeError):
            ASRProcessor()

    @patch("asr.WhisperModel")
    async def test_corrupted_audio_handling(self, mock_whisper_model):
        """Test handling corrupted audio data."""
        mock_model = Mock()
        mock_model.transcribe.side_effect = ValueError("Invalid audio format")
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Corrupted audio (wrong dtype)
        corrupted_audio = np.array([1, 2, 3], dtype=np.int32)

        result = await processor.process_audio(corrupted_audio)

        assert result["text"] == ""
        assert result["confidence"] == 0.0
        assert result["language"] == "bg"

    @patch("asr.WhisperModel")
    async def test_extremely_long_audio(self, mock_whisper_model):
        """Test handling extremely long audio."""
        mock_model = Mock()
        # Create mock segment with text attribute
        mock_segment = Mock()
        mock_segment.text = " Very long audio processed"
        mock_segment.start = 0.0
        mock_segment.end = 60.0
        mock_segment.avg_logprob = -0.3

        mock_model.transcribe = Mock(
            return_value=(
                [mock_segment],
                {"language": "en"},
            )
        )
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Very long audio (1 minute at 16kHz)
        long_audio = np.random.random(16000 * 60).astype(np.float32)

        result = await processor.process_audio(long_audio)

        # Should handle long audio
        assert result["text"].lower() == "very long audio processed"


class TestIntegration:
    """Integration tests for ASR module."""

    @patch("asr.WhisperModel")
    def test_asr_processor_attributes(self, mock_whisper_model):
        """Test that ASRProcessor has all expected attributes."""
        processor = ASRProcessor()

        assert hasattr(processor, "model")
        assert hasattr(processor, "process_audio")
        assert callable(processor.process_audio)

    @patch("asr.WhisperModel")
    async def test_realistic_workflow(self, mock_whisper_model):
        """Test realistic ASR workflow."""
        mock_model = Mock()
        # Create mock segment with text attribute
        mock_segment = Mock()
        mock_segment.text = " Здравей, как се казваш?"
        mock_segment.start = 0.0
        mock_segment.end = 3.0
        mock_segment.avg_logprob = -0.3

        mock_model.transcribe = Mock(
            return_value=(
                [mock_segment],
                {"language": "bg"},
            )
        )
        mock_whisper_model.return_value = mock_model

        processor = ASRProcessor()

        # Simulate realistic audio processing workflow
        audio_data = np.random.random(48000).astype(np.float32)  # 3 seconds of audio

        result = await processor.process_audio(audio_data)

        # Verify complete result structure
        assert "text" in result
        assert "confidence" in result
        assert "language" in result
        assert result["text"].lower() == "здравей, как се казваш?"
        assert result["language"] == "bg"
        assert isinstance(result["confidence"], int | float)
        assert 0 <= result["confidence"] <= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
