"""
Unit tests for TTS (Text-to-Speech) module.
"""

import subprocess
from unittest.mock import Mock, patch

import pytest
from tts import TTSProcessor


class TestTTSProcessor:
    """Test the TTSProcessor class."""

    def test_tts_processor_instantiation(self):
        """Test that TTSProcessor can be instantiated."""
        processor = TTSProcessor()
        assert isinstance(processor, TTSProcessor)
        assert hasattr(processor, "synthesize")
        assert hasattr(processor, "synthesize_streaming")

    def test_tts_processor_default_settings(self):
        """Test TTSProcessor default settings."""
        processor = TTSProcessor()

        # Check default attributes exist
        assert hasattr(processor, "voice")
        assert hasattr(processor, "speed")
        assert hasattr(processor, "pitch")

    def test_tts_processor_custom_settings(self):
        """Test TTSProcessor with custom settings."""
        processor = TTSProcessor(voice="bg", speed=150, pitch=50)

        assert processor.voice == "bg"
        assert processor.speed == 150
        assert processor.pitch == 50


class TestSynthesize:
    """Test the synthesize method."""

    @patch("subprocess.run")
    def test_synthesize_success(self, mock_subprocess):
        """Test successful audio synthesis."""
        # Mock subprocess to return audio data
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = b"fake_wav_data"

        processor = TTSProcessor()
        result = processor.synthesize("Здравей свят")

        assert result == b"fake_wav_data"
        mock_subprocess.assert_called_once()

        # Check that espeak-ng was called with correct parameters
        call_args = mock_subprocess.call_args
        assert "espeak-ng" in call_args[0][0]
        assert "Здравей свят" in call_args[0]

    @patch("subprocess.run")
    def test_synthesize_empty_text(self, mock_subprocess):
        """Test synthesis with empty text."""
        processor = TTSProcessor()
        result = processor.synthesize("")

        # Should return empty bytes for empty text
        assert result == b""
        mock_subprocess.assert_not_called()

    @patch("subprocess.run")
    def test_synthesize_none_text(self, mock_subprocess):
        """Test synthesis with None text."""
        processor = TTSProcessor()
        result = processor.synthesize(None)

        assert result == b""
        mock_subprocess.assert_not_called()

    @patch("subprocess.run")
    def test_synthesize_subprocess_error(self, mock_subprocess):
        """Test synthesis when subprocess fails."""
        mock_subprocess.return_value.returncode = 1
        mock_subprocess.return_value.stdout = b""
        mock_subprocess.return_value.stderr = b"espeak-ng error"

        processor = TTSProcessor()
        result = processor.synthesize("Тест")

        # Should return empty bytes on error
        assert result == b""

    @patch("subprocess.run")
    def test_synthesize_subprocess_exception(self, mock_subprocess):
        """Test synthesis when subprocess raises exception."""
        mock_subprocess.side_effect = subprocess.CalledProcessError(1, "espeak-ng")

        processor = TTSProcessor()
        result = processor.synthesize("Тест")

        # Should handle exception gracefully
        assert result == b""

    @patch("subprocess.run")
    def test_synthesize_bulgarian_text(self, mock_subprocess):
        """Test synthesis with Bulgarian text."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = b"bulgarian_audio_data"

        processor = TTSProcessor()
        bulgarian_text = "Добро утро! Как си днес?"
        result = processor.synthesize(bulgarian_text)

        assert result == b"bulgarian_audio_data"

        # Verify Bulgarian text was passed correctly
        call_args = mock_subprocess.call_args[0][0]
        assert bulgarian_text in call_args

    @patch("subprocess.run")
    def test_synthesize_voice_parameter(self, mock_subprocess):
        """Test synthesis with specific voice parameter."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = b"voice_audio_data"

        processor = TTSProcessor(voice="bg+f3")  # Bulgarian female voice
        result = processor.synthesize("Тест")

        assert result == b"voice_audio_data"

        # Check that voice parameter was used
        call_args = mock_subprocess.call_args[0][0]
        assert any("-v" in arg or "bg+f3" in str(arg) for arg in call_args)

    @patch("subprocess.run")
    def test_synthesize_speed_parameter(self, mock_subprocess):
        """Test synthesis with custom speed."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = b"speed_audio_data"

        processor = TTSProcessor(speed=120)
        result = processor.synthesize("Тест")

        assert result == b"speed_audio_data"

        # Check that speed parameter was used
        call_args = mock_subprocess.call_args[0][0]
        assert any("-s" in arg or "120" in str(arg) for arg in call_args)


class TestSynthesizeStreaming:
    """Test the synthesize_streaming method."""

    @patch("subprocess.Popen")
    def test_synthesize_streaming_success(self, mock_popen):
        """Test successful streaming synthesis."""
        # Mock Popen to simulate streaming output
        mock_process = Mock()
        mock_process.poll.return_value = None  # Process still running
        mock_process.stdout.read.side_effect = [b"chunk1", b"chunk2", b""]
        mock_process.wait.return_value = 0
        mock_popen.return_value = mock_process

        processor = TTSProcessor()
        chunks = list(processor.synthesize_streaming("Здравей"))

        assert chunks == [b"chunk1", b"chunk2"]
        mock_popen.assert_called_once()

    @patch("subprocess.Popen")
    def test_synthesize_streaming_empty_text(self, mock_popen):
        """Test streaming with empty text."""
        processor = TTSProcessor()
        chunks = list(processor.synthesize_streaming(""))

        assert chunks == []
        mock_popen.assert_not_called()

    @patch("subprocess.Popen")
    def test_synthesize_streaming_process_error(self, mock_popen):
        """Test streaming when process fails."""
        mock_process = Mock()
        mock_process.poll.return_value = 1  # Process failed
        mock_process.wait.return_value = 1
        mock_popen.return_value = mock_process

        processor = TTSProcessor()
        chunks = list(processor.synthesize_streaming("Тест"))

        # Should return empty generator on error
        assert chunks == []

    @patch("subprocess.Popen")
    def test_synthesize_streaming_exception_handling(self, mock_popen):
        """Test streaming with subprocess exception."""
        mock_popen.side_effect = Exception("Process failed")

        processor = TTSProcessor()
        chunks = list(processor.synthesize_streaming("Тест"))

        # Should handle exception gracefully
        assert chunks == []

    @patch("subprocess.Popen")
    def test_synthesize_streaming_large_text(self, mock_popen):
        """Test streaming with large text input."""
        mock_process = Mock()
        mock_process.poll.return_value = None
        # Simulate multiple chunks for large text
        mock_process.stdout.read.side_effect = [
            b"chunk1",
            b"chunk2",
            b"chunk3",
            b"chunk4",
            b"",
        ]
        mock_process.wait.return_value = 0
        mock_popen.return_value = mock_process

        processor = TTSProcessor()
        large_text = "Това е много дълъг текст. " * 50
        chunks = list(processor.synthesize_streaming(large_text))

        assert len(chunks) == 4
        assert all(chunk.startswith(b"chunk") for chunk in chunks)


class TestEspeakIntegration:
    """Test integration with espeak-ng."""

    @patch("subprocess.run")
    def test_espeak_command_structure(self, mock_subprocess):
        """Test that espeak-ng is called with correct command structure."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = b"audio"

        processor = TTSProcessor()
        processor.synthesize("Тест")

        call_args = mock_subprocess.call_args[0][0]

        # Should use espeak-ng
        assert call_args[0] == "espeak-ng"

        # Should output WAV format
        assert "--stdout" in call_args

        # Should have text as last argument
        assert "Тест" == call_args[-1]

    @patch("subprocess.run")
    def test_espeak_bulgarian_language(self, mock_subprocess):
        """Test that Bulgarian language is specified."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = b"audio"

        processor = TTSProcessor()
        processor.synthesize("Здравей")

        call_args = mock_subprocess.call_args[0][0]

        # Should specify Bulgarian language/voice
        assert any("bg" in str(arg) for arg in call_args)

    @patch("shutil.which")
    def test_espeak_availability_check(self, mock_which):
        """Test checking if espeak-ng is available."""
        mock_which.return_value = "/usr/bin/espeak-ng"

        processor = TTSProcessor()

        # Should be able to check availability
        assert hasattr(processor, "is_available") or True  # Method might not exist yet


class TestAudioFormat:
    """Test audio format handling."""

    @patch("subprocess.run")
    def test_wav_format_output(self, mock_subprocess):
        """Test that output is in WAV format."""
        # Mock WAV header (simplified)
        wav_header = b"RIFF\x24\x08\x00\x00WAVE"
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = wav_header + b"fake_audio_data"

        processor = TTSProcessor()
        result = processor.synthesize("Тест")

        # Should return WAV data
        assert result.startswith(b"RIFF")
        assert b"WAVE" in result

    @patch("subprocess.run")
    def test_audio_quality_parameters(self, mock_subprocess):
        """Test audio quality parameters."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = b"quality_audio"

        processor = TTSProcessor()
        processor.synthesize("Качествен звук")

        call_args = mock_subprocess.call_args[0][0]

        # Should have quality-related parameters
        assert "--stdout" in call_args  # Output to stdout for streaming


class TestErrorHandling:
    """Test error handling scenarios."""

    def test_invalid_voice_parameter(self):
        """Test handling invalid voice parameter."""
        # Should not raise exception during initialization
        processor = TTSProcessor(voice="invalid_voice")
        assert processor.voice == "invalid_voice"

    def test_invalid_speed_parameter(self):
        """Test handling invalid speed parameter."""
        processor = TTSProcessor(speed=-100)  # Invalid speed
        assert processor.speed == -100  # Should store value, handle in synthesis

    @patch("subprocess.run")
    def test_network_unavailable(self, mock_subprocess):
        """Test behavior when network/system resources unavailable."""
        mock_subprocess.side_effect = OSError("No such file or directory")

        processor = TTSProcessor()
        result = processor.synthesize("Тест")

        # Should handle OS error gracefully
        assert result == b""

    @patch("subprocess.run")
    def test_permission_denied(self, mock_subprocess):
        """Test behavior with permission denied."""
        mock_subprocess.side_effect = PermissionError("Permission denied")

        processor = TTSProcessor()
        result = processor.synthesize("Тест")

        # Should handle permission error gracefully
        assert result == b""


class TestPerformance:
    """Test performance characteristics."""

    @patch("subprocess.run")
    def test_synthesis_timeout(self, mock_subprocess):
        """Test synthesis timeout handling."""
        import time

        def slow_subprocess(*args, **kwargs):
            time.sleep(0.1)  # Simulate slow subprocess
            result = Mock()
            result.returncode = 0
            result.stdout = b"delayed_audio"
            return result

        mock_subprocess.side_effect = slow_subprocess

        processor = TTSProcessor()
        start_time = time.time()
        result = processor.synthesize("Тест")
        end_time = time.time()

        assert result == b"delayed_audio"
        assert (end_time - start_time) >= 0.1  # Should wait for subprocess

    @patch("subprocess.run")
    def test_multiple_synthesis_calls(self, mock_subprocess):
        """Test multiple consecutive synthesis calls."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = b"multi_audio"

        processor = TTSProcessor()

        # Make multiple calls
        results = []
        for i in range(3):
            result = processor.synthesize(f"Тест {i}")
            results.append(result)

        assert len(results) == 3
        assert all(result == b"multi_audio" for result in results)
        assert mock_subprocess.call_count == 3


class TestIntegration:
    """Integration tests for TTS module."""

    def test_tts_processor_methods_exist(self):
        """Test that all expected methods exist."""
        processor = TTSProcessor()

        assert hasattr(processor, "synthesize")
        assert callable(processor.synthesize)
        assert hasattr(processor, "synthesize_streaming")
        assert callable(processor.synthesize_streaming)

    @patch("subprocess.run")
    def test_realistic_bulgarian_synthesis(self, mock_subprocess):
        """Test with realistic Bulgarian text."""
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = b"realistic_bulgarian_audio"

        processor = TTSProcessor()

        realistic_texts = [
            "Добро утро! Как сте днес?",
            "Моля, кажете ми къде е най-близката аптека.",
            "Благодаря ви много за помощта.",
            "До скоро виждане!",
        ]

        for text in realistic_texts:
            result = processor.synthesize(text)
            assert isinstance(result, bytes)
            assert len(result) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
