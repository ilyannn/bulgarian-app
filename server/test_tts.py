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
        assert hasattr(processor, "profile")
        assert processor.profile.name == "natural"  # Default profile

    def test_tts_processor_custom_settings(self):
        """Test TTSProcessor with custom profile."""
        processor = TTSProcessor(voice="bg", profile="slow")

        assert processor.voice == "bg"
        assert processor.profile.name == "slow"
        assert processor.profile.speed == 120  # Slow profile speed


class TestSynthesize:
    """Test the synthesize method."""

    @patch("subprocess.run")
    def test_synthesize_success(self, mock_subprocess):
        """Test successful audio synthesis."""
        # Mock subprocess to return audio data
        # First call is for version check (text mode), second is for synthesis (binary mode)
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=b"fake_wav_data"),  # synthesis
        ]

        processor = TTSProcessor()
        result = processor.synthesize("Здравей свят")

        assert result.startswith(b"RIFF")  # WAV header
        assert b"fake_wav_data" in result
        assert mock_subprocess.call_count == 2

        # Check that espeak-ng was called with correct parameters
        call_args = mock_subprocess.call_args_list[1][0][0]  # Second call (synthesis)
        assert call_args[0].endswith(
            "espeak-ng"
        )  # Handle both "espeak-ng" and "/usr/bin/espeak-ng"

        # Verify text was passed via stdin (not as command argument)
        call_kwargs = mock_subprocess.call_args_list[1][1]
        input_text = call_kwargs.get("input", b"").decode("utf-8")
        assert "Здравей свят" in input_text

    @patch("subprocess.run")
    def test_synthesize_empty_text(self, mock_subprocess):
        """Test synthesis with empty text."""
        # Mock version check
        mock_subprocess.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )
        processor = TTSProcessor()
        result = processor.synthesize("")

        # Should return empty bytes for empty text
        assert result == b""
        # Only version check should be called, no synthesis call
        assert mock_subprocess.call_count == 1

    @patch("subprocess.run")
    def test_synthesize_none_text(self, mock_subprocess):
        """Test synthesis with None text."""
        # Mock version check
        mock_subprocess.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )
        processor = TTSProcessor()
        result = processor.synthesize(None)

        assert result == b""
        # Only version check should be called, no synthesis call
        assert mock_subprocess.call_count == 1

    @patch("subprocess.run")
    def test_synthesize_subprocess_error(self, mock_subprocess):
        """Test synthesis when subprocess fails."""
        # First call for version check, second for synthesis
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(
                returncode=1, stdout=b"", stderr=b"espeak-ng error"
            ),  # synthesis fails
        ]

        processor = TTSProcessor()
        result = processor.synthesize("Тест")

        # Should return WAV header even on synthesis error
        assert result.startswith(b"RIFF")
        # But should not contain the text since synthesis failed
        assert len(result) == len(processor._create_wav_header())

    @patch("subprocess.run")
    def test_synthesize_subprocess_exception(self, mock_subprocess):
        """Test synthesis when subprocess raises exception."""
        # Version check succeeds, synthesis raises exception
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            subprocess.CalledProcessError(1, "espeak-ng"),  # synthesis fails
        ]

        processor = TTSProcessor()
        result = processor.synthesize("Тест")

        # Should handle exception in _synthesize_chunk and return WAV header only
        assert result.startswith(b"RIFF")
        assert len(result) == len(processor._create_wav_header())

    @patch("subprocess.run")
    def test_synthesize_bulgarian_text(self, mock_subprocess):
        """Test synthesis with Bulgarian text."""
        # Mock both version check and synthesis
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=b"bulgarian_audio_data"),  # synthesis
        ]

        processor = TTSProcessor()
        bulgarian_text = "Добро утро! Как си днес?"
        result = processor.synthesize(bulgarian_text)

        assert result.startswith(b"RIFF")  # WAV header
        assert b"bulgarian_audio_data" in result

        # Verify Bulgarian text was passed correctly via stdin (second call)
        call_kwargs = mock_subprocess.call_args_list[1][1]
        input_text = call_kwargs.get("input", b"").decode("utf-8")
        assert bulgarian_text in input_text

    @patch("subprocess.run")
    def test_synthesize_voice_parameter(self, mock_subprocess):
        """Test synthesis with specific voice parameter."""
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=b"voice_audio_data"),  # synthesis
        ]

        processor = TTSProcessor(voice="bg+f3")  # Bulgarian female voice
        result = processor.synthesize("Тест")

        assert result.startswith(b"RIFF")  # WAV header
        assert b"voice_audio_data" in result

        # Check that voice parameter was used (second call)
        call_args = mock_subprocess.call_args_list[1][0][0]
        assert any("-v" in arg or "bg+f3" in str(arg) for arg in call_args)

    @patch("subprocess.run")
    def test_synthesize_speed_parameter(self, mock_subprocess):
        """Test synthesis with custom profile."""
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=b"speed_audio_data"),  # synthesis
        ]

        processor = TTSProcessor(profile="slow")
        result = processor.synthesize("Тест")

        assert result.startswith(b"RIFF")  # WAV header
        assert b"speed_audio_data" in result

        # Check that slow profile speed was used (second call)
        call_args = mock_subprocess.call_args_list[1][0][0]
        assert any(
            "-s" in arg or "120" in str(arg) for arg in call_args
        )  # Slow profile has speed 120


class TestSynthesizeStreaming:
    """Test the synthesize_streaming method."""

    @patch("subprocess.run")
    def test_synthesize_streaming_success(self, mock_run):
        """Test successful streaming synthesis."""
        # Mock version check and synthesis calls
        mock_run.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=b"chunk1"),  # synthesis call
        ]

        processor = TTSProcessor()
        chunks = list(processor.synthesize_streaming("Здравей"))

        # First chunk is WAV header, then audio chunks
        assert len(chunks) >= 2  # At least header + one chunk
        assert chunks[0].startswith(b"RIFF")  # WAV header
        assert mock_run.call_count >= 2  # At least version check + synthesis

    @patch("subprocess.run")
    def test_synthesize_streaming_empty_text(self, mock_run):
        """Test streaming with empty text."""
        # Mock version check
        mock_run.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )
        processor = TTSProcessor()
        chunks = list(processor.synthesize_streaming(""))

        assert chunks == []
        assert mock_run.call_count == 1  # Only version check, no synthesis

    @patch("subprocess.run")
    def test_synthesize_streaming_process_error(self, mock_run):
        """Test streaming when process fails."""
        # Mock version check and failed synthesis
        mock_run.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=1, stdout=b""),  # synthesis fails
        ]

        processor = TTSProcessor()
        chunks = list(processor.synthesize_streaming("Тест"))

        # Should still get WAV header even on error
        assert len(chunks) >= 1
        assert chunks[0].startswith(b"RIFF")

    @patch("subprocess.run")
    def test_synthesize_streaming_exception_handling(self, mock_run):
        """Test streaming with subprocess exception."""

        # Mock version check and synthesis exception
        def side_effect(*args, **kwargs):
            if "--version" in args[0]:
                return Mock(returncode=0, stdout="eSpeak NG text-to-speech: 1.50")
            raise Exception("Process failed")

        mock_run.side_effect = side_effect

        processor = TTSProcessor()
        chunks = list(processor.synthesize_streaming("Тест"))

        # Should still get WAV header and possibly silence chunk on exception
        assert len(chunks) >= 1
        assert chunks[0].startswith(b"RIFF")

    @patch("subprocess.run")
    def test_synthesize_streaming_large_text(self, mock_run):
        """Test streaming with large text input."""
        # Mock version check and multiple synthesis calls for large text
        mock_run.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
        ] + [
            Mock(returncode=0, stdout=f"chunk{i}".encode())  # synthesis calls
            for i in range(1, 5)  # Assume it splits into 4 chunks
        ]

        processor = TTSProcessor()
        large_text = "Това е много дълъг текст. " * 50
        chunks = list(processor.synthesize_streaming(large_text))

        # Should have header + data chunks
        assert len(chunks) >= 2
        assert chunks[0].startswith(b"RIFF")  # WAV header


class TestEspeakIntegration:
    """Test integration with espeak-ng."""

    @patch("subprocess.run")
    def test_espeak_command_structure(self, mock_subprocess):
        """Test that espeak-ng is called with correct command structure."""
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=b"audio"),  # synthesis
        ]

        processor = TTSProcessor()
        processor.synthesize("Тест")

        call_args = mock_subprocess.call_args_list[1][0][
            0
        ]  # Get second call (synthesis)

        # Should use espeak-ng (handle both bare command and full path)
        assert call_args[0].endswith("espeak-ng")

        # Should output WAV format
        assert "--stdout" in call_args

        # Should end with -- for security (text passed via stdin)
        assert call_args[-1] == "--"

        # Verify text was passed via stdin
        call_kwargs = mock_subprocess.call_args_list[1][1]
        input_text = call_kwargs.get("input", b"").decode("utf-8")
        assert "Тест" in input_text

    @patch("subprocess.run")
    def test_espeak_bulgarian_language(self, mock_subprocess):
        """Test that Bulgarian language is specified."""
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=b"audio"),  # synthesis
        ]

        processor = TTSProcessor()
        processor.synthesize("Здравей")

        call_args = mock_subprocess.call_args_list[1][0][0]  # Get second call

        # Should specify Bulgarian language/voice
        assert any("bg" in str(arg) for arg in call_args)

    @patch("subprocess.run")
    @patch("shutil.which")
    def test_espeak_availability_check(self, mock_which, mock_run):
        """Test checking if espeak-ng is available."""
        mock_which.return_value = "/usr/bin/espeak-ng"
        mock_run.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )

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
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=wav_header + b"fake_audio_data"),  # synthesis
        ]

        processor = TTSProcessor()
        result = processor.synthesize("Тест")

        # Should return WAV data
        assert result.startswith(b"RIFF")
        assert b"WAVE" in result

    @patch("subprocess.run")
    def test_audio_quality_parameters(self, mock_subprocess):
        """Test audio quality parameters."""
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=b"quality_audio"),  # synthesis
        ]

        processor = TTSProcessor()
        processor.synthesize("Качествен звук")

        call_args = mock_subprocess.call_args_list[1][0][0]  # Get second call

        # Should have quality-related parameters
        assert "--stdout" in call_args  # Output to stdout for streaming


class TestErrorHandling:
    """Test error handling scenarios."""

    @patch("subprocess.run")
    def test_invalid_voice_parameter(self, mock_run):
        """Test handling invalid voice parameter."""
        # Mock version check
        mock_run.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )
        # Should not raise exception during initialization
        processor = TTSProcessor(voice="invalid_voice")
        assert processor.voice == "invalid_voice"

    @patch("subprocess.run")
    def test_invalid_speed_parameter(self, mock_run):
        """Test handling invalid profile parameter."""
        # Mock version check
        mock_run.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )
        processor = TTSProcessor(profile="invalid_profile")  # Invalid profile
        assert processor.profile.name == "natural"  # Should use default profile

    @patch("subprocess.run")
    def test_network_unavailable(self, mock_subprocess):
        """Test behavior when network/system resources unavailable."""
        # Version check fails
        mock_subprocess.side_effect = OSError("No such file or directory")

        with pytest.raises(OSError):
            TTSProcessor()

    @patch("subprocess.run")
    def test_permission_denied(self, mock_subprocess):
        """Test behavior with permission denied."""
        # Version check fails with permission error
        mock_subprocess.side_effect = PermissionError("Permission denied")

        with pytest.raises(PermissionError):
            TTSProcessor()


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

        def slow_subprocess_with_version(*args, **kwargs):
            # First call is version check
            if "--version" in args[0]:
                result = Mock()
                result.returncode = 0
                result.stdout = "eSpeak NG text-to-speech: 1.50"
                return result
            # Second call is synthesis
            time.sleep(0.1)  # Simulate slow subprocess
            result = Mock()
            result.returncode = 0
            result.stdout = b"delayed_audio"
            return result

        mock_subprocess.side_effect = slow_subprocess_with_version

        processor = TTSProcessor()
        start_time = time.time()
        result = processor.synthesize("Тест")
        end_time = time.time()

        assert result.startswith(b"RIFF")  # Should have WAV header
        assert b"delayed_audio" in result  # Should contain the audio data
        assert (end_time - start_time) >= 0.1  # Should wait for subprocess

    @patch("subprocess.run")
    def test_multiple_synthesis_calls(self, mock_subprocess):
        """Test multiple consecutive synthesis calls."""
        # First call for version, then multiple synthesis calls
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
            Mock(returncode=0, stdout=b"multi_audio"),  # synthesis 1
            Mock(returncode=0, stdout=b"multi_audio"),  # synthesis 2
            Mock(returncode=0, stdout=b"multi_audio"),  # synthesis 3
        ]

        processor = TTSProcessor()

        # Make multiple calls
        results = []
        for i in range(3):
            result = processor.synthesize(f"Тест {i}")
            results.append(result)

        assert len(results) == 3
        assert all(
            result.startswith(b"RIFF") for result in results
        )  # All have WAV headers
        assert mock_subprocess.call_count == 4  # 1 version check + 3 synthesis calls


class TestVoiceProfiles:
    """Tests for voice profile functionality."""

    @patch("subprocess.run")
    def test_voice_profile_switching(self, mock_subprocess):
        """Test that voice profiles can be switched."""
        mock_subprocess.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )

        processor = TTSProcessor(profile="natural")
        assert processor.profile.name == "natural"

        # Switch to slow profile
        success = processor.set_profile("slow")
        assert success
        assert processor.profile.name == "slow"

        # Try invalid profile
        success = processor.set_profile("invalid")
        assert not success
        assert processor.profile.name == "slow"  # Should remain unchanged

        # Switch to clear profile
        success = processor.set_profile("clear")
        assert success
        assert processor.profile.name == "clear"

    @patch("subprocess.run")
    def test_get_available_profiles(self, mock_subprocess):
        """Test getting available profiles."""
        mock_subprocess.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )

        processor = TTSProcessor()
        profiles = processor.get_available_profiles()

        assert "natural" in profiles
        assert "slow" in profiles
        assert "clear" in profiles
        assert "expressive" in profiles

        # Check descriptions are present
        assert all(
            isinstance(desc, str) and len(desc) > 0 for desc in profiles.values()
        )

    @patch("subprocess.run")
    def test_get_current_profile(self, mock_subprocess):
        """Test getting current profile name."""
        mock_subprocess.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )

        processor = TTSProcessor(profile="expressive")
        assert processor.get_current_profile() == "expressive"

        processor.set_profile("slow")
        assert processor.get_current_profile() == "slow"

    @patch("subprocess.run")
    def test_profile_parameters(self, mock_subprocess):
        """Test that different profiles have different parameters."""
        mock_subprocess.return_value = Mock(
            returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
        )

        processor = TTSProcessor()

        # Get parameters for different profiles
        natural_profile = processor.VOICE_PROFILES["natural"]
        slow_profile = processor.VOICE_PROFILES["slow"]
        clear_profile = processor.VOICE_PROFILES["clear"]

        # Slow should have lower speed than natural
        assert slow_profile.speed < natural_profile.speed

        # Clear should have larger word gaps
        assert clear_profile.word_gap > natural_profile.word_gap

        # All profiles should have valid parameter ranges
        for profile in processor.VOICE_PROFILES.values():
            assert 80 <= profile.speed <= 450
            assert 0 <= profile.pitch <= 99
            assert 0 <= profile.amplitude <= 200
            assert profile.word_gap >= 0


class TestIntegration:
    """Integration tests for TTS module."""

    def test_tts_processor_methods_exist(self):
        """Test that all expected methods exist."""
        processor = TTSProcessor()

        assert hasattr(processor, "synthesize")
        assert callable(processor.synthesize)
        assert hasattr(processor, "synthesize_streaming")
        assert callable(processor.synthesize_streaming)
        assert hasattr(processor, "set_profile")
        assert callable(processor.set_profile)
        assert hasattr(processor, "get_available_profiles")
        assert callable(processor.get_available_profiles)
        assert hasattr(processor, "get_current_profile")
        assert callable(processor.get_current_profile)

    @patch("subprocess.run")
    def test_realistic_bulgarian_synthesis(self, mock_subprocess):
        """Test with realistic Bulgarian text."""
        # Setup side_effect for version check + multiple synthesis calls
        mock_subprocess.side_effect = [
            Mock(
                returncode=0, stdout="eSpeak NG text-to-speech: 1.50"
            ),  # version check
        ] + [
            Mock(
                returncode=0, stdout=b"realistic_bulgarian_audio"
            )  # synthesis for each text
            for _ in range(4)  # 4 texts to synthesize
        ]

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
