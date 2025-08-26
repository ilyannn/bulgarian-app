"""
Comprehensive tests for the config module
"""

import logging
import os
import subprocess
from unittest.mock import ANY, Mock, patch

import pytest
from config import (
    ConfigError,
    EnvironmentConfig,
    get_config,
    validate_startup_environment,
)


class TestEnvironmentConfig:
    """Test EnvironmentConfig class initialization and validation"""

    def test_default_configuration(self):
        """Test default configuration values when no environment variables are set"""
        with patch.dict(os.environ, {}, clear=True):
            config = EnvironmentConfig()

            # LLM defaults
            assert config.chat_provider == "dummy"
            assert config.openai_api_key is None
            assert config.openai_model == "gpt-4o-mini"
            assert config.anthropic_api_key is None
            assert config.anthropic_model == "claude-3-haiku-20240307"

            # ASR defaults
            assert config.whisper_model_path == "medium"
            assert config.whisper_language == "bg"
            assert config.whisper_beam_size == 5
            assert config.whisper_temperature == 0.0
            assert config.whisper_no_speech_threshold == 0.6

            # TTS defaults
            assert config.espeak_voice == "bg"
            assert config.espeak_speed == 160
            assert config.espeak_pitch == 50
            assert config.espeak_path is None

            # Audio defaults
            assert config.sample_rate == 16000
            assert config.frame_duration_ms == 20
            assert config.vad_aggressiveness == 2

            # Server defaults
            assert config.server_host == "127.0.0.1"
            assert config.server_port == 8000
            assert config.debug is False
            assert config.log_level == "INFO"
            assert config.reload is True

            # CORS defaults
            assert config.allowed_origins == [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]

            # Content defaults
            assert config.default_l1_language == "PL"
            assert config.grammar_pack_path == "content/bg_grammar_pack.json"
            assert config.scenarios_path == "content/bg_scenarios_with_grammar.json"

    def test_environment_variable_parsing(self):
        """Test that environment variables override defaults"""
        env_vars = {
            "CHAT_PROVIDER": "openai",
            "OPENAI_API_KEY": "test-openai-key",
            "OPENAI_MODEL": "gpt-4",
            "ANTHROPIC_API_KEY": "test-anthropic-key",
            "ANTHROPIC_MODEL": "claude-3-opus-20240229",
            "WHISPER_MODEL_PATH": "large",
            "WHISPER_LANGUAGE": "en",
            "WHISPER_BEAM_SIZE": "3",
            "WHISPER_TEMPERATURE": "0.5",
            "WHISPER_NO_SPEECH_THRESHOLD": "0.8",
            "ESPEAK_VOICE": "en",
            "ESPEAK_SPEED": "180",
            "ESPEAK_PITCH": "60",
            "ESPEAK_PATH": "/usr/bin/espeak-ng",
            "SAMPLE_RATE": "22050",
            "FRAME_DURATION_MS": "30",
            "VAD_AGGRESSIVENESS": "3",
            "SERVER_HOST": "0.0.0.0",
            "SERVER_PORT": "9000",
            "DEBUG": "true",
            "LOG_LEVEL": "DEBUG",
            "RELOAD": "false",
            "ALLOWED_ORIGINS": "http://localhost:8080,https://example.com",
            "DEFAULT_L1_LANGUAGE": "RU",
            "GRAMMAR_PACK_PATH": "custom/grammar.json",
            "SCENARIOS_PATH": "custom/scenarios.json",
            "ENABLE_METRICS": "true",
            "LOG_REQUESTS": "true",
            "LOG_ASR_DETAILS": "true",
            "OTEL_ENABLED": "true",
            "OTEL_SERVICE_NAME": "custom-service",
            "OTEL_CONSOLE_EXPORT": "true",
            "ENVIRONMENT": "production",
        }

        with patch.dict(os.environ, env_vars, clear=True):
            config = EnvironmentConfig()

            # Verify all custom values are set
            assert config.chat_provider == "openai"
            assert config.openai_api_key == "test-openai-key"
            assert config.openai_model == "gpt-4"
            assert config.anthropic_api_key == "test-anthropic-key"
            assert config.anthropic_model == "claude-3-opus-20240229"
            assert config.whisper_model_path == "large"
            assert config.whisper_language == "en"
            assert config.whisper_beam_size == 3
            assert config.whisper_temperature == 0.5
            assert config.whisper_no_speech_threshold == 0.8
            assert config.espeak_voice == "en"
            assert config.espeak_speed == 180
            assert config.espeak_pitch == 60
            assert config.espeak_path == "/usr/bin/espeak-ng"
            assert config.sample_rate == 22050
            assert config.frame_duration_ms == 30
            assert config.vad_aggressiveness == 3
            assert config.server_host == "0.0.0.0"
            assert config.server_port == 9000
            assert config.debug is True
            assert config.log_level == "DEBUG"
            assert config.reload is False
            assert config.allowed_origins == [
                "http://localhost:8080",
                "https://example.com",
            ]
            assert config.default_l1_language == "RU"
            assert config.enable_metrics is True
            assert config.log_requests is True
            assert config.log_asr_details is True
            assert config.otel_enabled is True
            assert config.otel_service_name == "custom-service"
            assert config.environment == "production"

    def test_chat_provider_case_insensitive(self):
        """Test that CHAT_PROVIDER is normalized to lowercase"""
        with patch.dict(os.environ, {"CHAT_PROVIDER": "OPENAI"}, clear=True):
            config = EnvironmentConfig()
            assert config.chat_provider == "openai"

    def test_boolean_parsing(self):
        """Test boolean environment variables are parsed correctly"""
        test_cases = [
            ("true", True),
            ("TRUE", True),
            ("True", True),
            ("false", False),
            ("FALSE", False),
            ("False", False),
            ("", False),
            ("invalid", False),
        ]

        for env_value, expected in test_cases:
            with patch.dict(os.environ, {"DEBUG": env_value}, clear=True):
                config = EnvironmentConfig()
                assert config.debug == expected, f"Failed for DEBUG={env_value}"

    def test_integer_parsing(self):
        """Test integer environment variables are parsed correctly"""
        with patch.dict(
            os.environ,
            {
                "SERVER_PORT": "9000",
                "WHISPER_BEAM_SIZE": "7",
                "VAD_AGGRESSIVENESS": "1",
            },
            clear=True,
        ):
            config = EnvironmentConfig()
            assert config.server_port == 9000
            assert config.whisper_beam_size == 7
            assert config.vad_aggressiveness == 1

    def test_float_parsing(self):
        """Test float environment variables are parsed correctly"""
        with patch.dict(
            os.environ,
            {"WHISPER_TEMPERATURE": "0.3", "WHISPER_NO_SPEECH_THRESHOLD": "0.7"},
            clear=True,
        ):
            config = EnvironmentConfig()
            assert config.whisper_temperature == 0.3
            assert config.whisper_no_speech_threshold == 0.7

    def test_allowed_origins_parsing(self):
        """Test ALLOWED_ORIGINS comma-separated parsing"""
        test_cases = [
            ("http://localhost:3000", ["http://localhost:3000"]),
            (
                "http://localhost:3000,https://example.com",
                ["http://localhost:3000", "https://example.com"],
            ),
            (
                "http://localhost:3000, https://example.com , http://test.com",
                ["http://localhost:3000", "https://example.com", "http://test.com"],
            ),
            ("", [""]),
        ]

        for origins_str, expected in test_cases:
            with patch.dict(os.environ, {"ALLOWED_ORIGINS": origins_str}, clear=True):
                config = EnvironmentConfig()
                assert config.allowed_origins == expected


class TestConfigValidation:
    """Test configuration validation logic"""

    def test_validate_environment_with_no_issues(self):
        """Test validation when all configuration is valid"""
        with patch.dict(
            os.environ,
            {"CHAT_PROVIDER": "dummy", "DEFAULT_L1_LANGUAGE": "PL"},
            clear=True,
        ):
            config = EnvironmentConfig()

            # Mock all external checks to pass
            with (
                patch.object(config, "_check_espeak_installation", return_value=True),
                patch("pathlib.Path.exists", return_value=True),
            ):
                issues = config.validate_environment()
                assert issues == []

    def test_validate_openai_provider_without_api_key(self):
        """Test validation fails when OpenAI provider selected but no API key"""
        with patch.dict(os.environ, {"CHAT_PROVIDER": "openai"}, clear=True):
            config = EnvironmentConfig()

            with (
                patch.object(config, "_check_espeak_installation", return_value=True),
                patch("pathlib.Path.exists", return_value=True),
            ):
                issues = config.validate_environment()
                assert any("OpenAI API key is required" in issue for issue in issues)

    def test_validate_claude_provider_without_api_key(self):
        """Test validation fails when Claude provider selected but no API key"""
        with patch.dict(os.environ, {"CHAT_PROVIDER": "claude"}, clear=True):
            config = EnvironmentConfig()

            with (
                patch.object(config, "_check_espeak_installation", return_value=True),
                patch("pathlib.Path.exists", return_value=True),
            ):
                issues = config.validate_environment()
                assert any("Anthropic API key is required" in issue for issue in issues)

    def test_validate_auto_provider_fallback_to_dummy(self):
        """Test auto provider falls back to dummy when no API keys available"""
        with patch.dict(os.environ, {"CHAT_PROVIDER": "auto"}, clear=True):
            config = EnvironmentConfig()

            with (
                patch.object(config, "_check_espeak_installation", return_value=True),
                patch("pathlib.Path.exists", return_value=True),
            ):
                config.validate_environment()
                assert config.chat_provider == "dummy"

    def test_validate_missing_content_files(self):
        """Test validation fails when content files are missing"""
        with patch.dict(os.environ, {}, clear=True):
            config = EnvironmentConfig()

            with (
                patch.object(config, "_check_espeak_installation", return_value=True),
                patch("pathlib.Path.exists", return_value=False),
            ):
                issues = config.validate_environment()
                assert any("Grammar pack file not found" in issue for issue in issues)
                assert any("Scenarios file not found" in issue for issue in issues)

    def test_validate_espeak_not_installed(self):
        """Test validation fails when eSpeak NG is not installed"""
        with patch.dict(os.environ, {}, clear=True):
            config = EnvironmentConfig()

            with (
                patch.object(config, "_check_espeak_installation", return_value=False),
                patch("pathlib.Path.exists", return_value=True),
            ):
                issues = config.validate_environment()
                assert any("eSpeak NG not found" in issue for issue in issues)

    def test_validate_invalid_sample_rate(self):
        """Test validation fails for invalid sample rates"""
        with patch.dict(os.environ, {"SAMPLE_RATE": "12000"}, clear=True):
            config = EnvironmentConfig()

            with (
                patch.object(config, "_check_espeak_installation", return_value=True),
                patch("pathlib.Path.exists", return_value=True),
            ):
                issues = config.validate_environment()
                assert any("Invalid sample rate" in issue for issue in issues)

    def test_validate_invalid_vad_aggressiveness(self):
        """Test validation fails for invalid VAD aggressiveness values"""
        invalid_values = ["0", "4", "-1"]

        for invalid_val in invalid_values:
            with patch.dict(
                os.environ, {"VAD_AGGRESSIVENESS": invalid_val}, clear=True
            ):
                config = EnvironmentConfig()

                with (
                    patch.object(
                        config, "_check_espeak_installation", return_value=True
                    ),
                    patch("pathlib.Path.exists", return_value=True),
                ):
                    issues = config.validate_environment()
                    assert any(
                        "VAD aggressiveness must be 1-3" in issue for issue in issues
                    )

    def test_validate_invalid_l1_language(self):
        """Test validation fails for invalid L1 languages"""
        with patch.dict(os.environ, {"DEFAULT_L1_LANGUAGE": "EN"}, clear=True):
            config = EnvironmentConfig()

            with (
                patch.object(config, "_check_espeak_installation", return_value=True),
                patch("pathlib.Path.exists", return_value=True),
            ):
                issues = config.validate_environment()
                assert any("Invalid L1 language" in issue for issue in issues)

    def test_validate_valid_l1_languages(self):
        """Test validation passes for valid L1 languages"""
        valid_languages = ["PL", "RU", "UK", "SR"]

        for lang in valid_languages:
            with patch.dict(os.environ, {"DEFAULT_L1_LANGUAGE": lang}, clear=True):
                config = EnvironmentConfig()

                with (
                    patch.object(
                        config, "_check_espeak_installation", return_value=True
                    ),
                    patch("pathlib.Path.exists", return_value=True),
                ):
                    issues = config.validate_environment()
                    # Should not have L1 language validation error
                    assert not any("Invalid L1 language" in issue for issue in issues)


class TestEspeakInstallationCheck:
    """Test eSpeak NG installation detection"""

    def test_espeak_check_with_custom_path_success(self):
        """Test eSpeak check succeeds with custom ESPEAK_PATH"""
        with patch.dict(os.environ, {"ESPEAK_PATH": "/custom/espeak-ng"}, clear=True):
            config = EnvironmentConfig()

            mock_result = Mock()
            mock_result.returncode = 0

            with patch("subprocess.run", return_value=mock_result) as mock_run:
                result = config._check_espeak_installation()
                assert result is True
                mock_run.assert_called_once_with(
                    ["/custom/espeak-ng", "--version"], capture_output=True, timeout=5
                )

    def test_espeak_check_with_custom_path_failure(self):
        """Test eSpeak check fails with custom ESPEAK_PATH that doesn't work"""
        with patch.dict(os.environ, {"ESPEAK_PATH": "/invalid/path"}, clear=True):
            config = EnvironmentConfig()

            mock_result = Mock()
            mock_result.returncode = 1

            with patch("subprocess.run", return_value=mock_result):
                result = config._check_espeak_installation()
                assert result is False

    def test_espeak_check_standard_paths_success(self):
        """Test eSpeak check succeeds with standard installation"""
        with patch.dict(os.environ, {}, clear=True):
            config = EnvironmentConfig()

            mock_result = Mock()
            mock_result.returncode = 0

            with patch("subprocess.run", return_value=mock_result) as mock_run:
                result = config._check_espeak_installation()
                assert result is True
                # Should have tried espeak-ng first
                assert mock_run.call_args_list[0][0][0] == ["espeak-ng", "--version"]

    def test_espeak_check_fallback_to_espeak(self):
        """Test eSpeak check falls back to 'espeak' command"""
        with patch.dict(os.environ, {}, clear=True):
            config = EnvironmentConfig()

            def mock_run_side_effect(cmd, **kwargs):
                if "espeak-ng" in cmd:
                    raise FileNotFoundError("espeak-ng not found")
                elif "espeak" in cmd:
                    mock_result = Mock()
                    mock_result.returncode = 0
                    return mock_result

            with patch("subprocess.run", side_effect=mock_run_side_effect) as mock_run:
                result = config._check_espeak_installation()
                assert result is True
                assert mock_run.call_count == 2

    def test_espeak_check_timeout(self):
        """Test eSpeak check handles timeout gracefully"""
        with patch.dict(os.environ, {}, clear=True):
            config = EnvironmentConfig()

            with patch(
                "subprocess.run", side_effect=subprocess.TimeoutExpired("cmd", 5)
            ):
                result = config._check_espeak_installation()
                assert result is False

    def test_espeak_check_all_commands_fail(self):
        """Test eSpeak check fails when no commands work"""
        with patch.dict(os.environ, {}, clear=True):
            config = EnvironmentConfig()

            with patch("subprocess.run", side_effect=FileNotFoundError("not found")):
                result = config._check_espeak_installation()
                assert result is False


class TestLoggingSetup:
    """Test logging configuration"""

    def test_setup_logging_default_level(self):
        """Test logging setup with default INFO level"""
        with patch.dict(os.environ, {}, clear=True):
            config = EnvironmentConfig()

            with patch("logging.basicConfig") as mock_basic_config:
                config.setup_logging()
                mock_basic_config.assert_called_once_with(
                    level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                    handlers=ANY,
                )

    def test_setup_logging_custom_level(self):
        """Test logging setup with custom level"""
        with patch.dict(os.environ, {"LOG_LEVEL": "DEBUG"}, clear=True):
            config = EnvironmentConfig()

            with patch("logging.basicConfig") as mock_basic_config:
                config.setup_logging()
                mock_basic_config.assert_called_once_with(
                    level=logging.DEBUG,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                    handlers=ANY,
                )

    def test_setup_logging_with_request_logging(self):
        """Test logging setup enables uvicorn access logging when LOG_REQUESTS=true"""
        with patch.dict(os.environ, {"LOG_REQUESTS": "true"}, clear=True):
            config = EnvironmentConfig()

            with (
                patch("logging.basicConfig"),
                patch("logging.getLogger") as mock_get_logger,
            ):
                mock_logger = Mock()
                mock_get_logger.return_value = mock_logger

                config.setup_logging()
                mock_get_logger.assert_any_call("uvicorn.access")
                mock_logger.setLevel.assert_any_call(logging.DEBUG)

    def test_setup_logging_with_asr_details(self):
        """Test logging setup enables ASR detailed logging when LOG_ASR_DETAILS=true"""
        with patch.dict(os.environ, {"LOG_ASR_DETAILS": "true"}, clear=True):
            config = EnvironmentConfig()

            with (
                patch("logging.basicConfig"),
                patch("logging.getLogger") as mock_get_logger,
            ):
                mock_logger = Mock()
                mock_get_logger.return_value = mock_logger

                config.setup_logging()
                mock_get_logger.assert_any_call("asr")
                mock_logger.setLevel.assert_any_call(logging.DEBUG)


class TestStartupValidation:
    """Test startup validation function"""

    def test_validate_startup_environment_success(self):
        """Test successful startup validation"""
        with patch.dict(os.environ, {"CHAT_PROVIDER": "dummy"}, clear=True):
            with patch("config.EnvironmentConfig") as mock_config_class:
                mock_config = Mock()
                mock_config.validate_environment.return_value = []
                mock_config_class.return_value = mock_config

                result = validate_startup_environment()

                assert result == mock_config
                mock_config.setup_logging.assert_called_once()
                mock_config.validate_environment.assert_called_once()

    def test_validate_startup_environment_non_critical_warnings(self):
        """Test startup validation with non-critical warnings"""
        with patch.dict(os.environ, {}, clear=True):
            with patch("config.EnvironmentConfig") as mock_config_class:
                mock_config = Mock()
                mock_config.validate_environment.return_value = ["Some warning message"]
                mock_config_class.return_value = mock_config

                result = validate_startup_environment()

                assert result == mock_config

    def test_validate_startup_environment_critical_failure(self):
        """Test startup validation fails with critical issues"""
        with patch.dict(os.environ, {}, clear=True):
            with patch("config.EnvironmentConfig") as mock_config_class:
                mock_config = Mock()
                mock_config.validate_environment.return_value = [
                    "Grammar pack file not found: /path/to/file",
                    "API key is required when CHAT_PROVIDER=openai",
                ]
                mock_config_class.return_value = mock_config

                with pytest.raises(
                    ConfigError, match="Critical environment configuration issues found"
                ):
                    validate_startup_environment()


class TestGlobalConfig:
    """Test global configuration instance management"""

    def test_get_config_creates_instance(self):
        """Test get_config creates and returns configuration instance"""
        # Reset global config
        import config

        config.config = None

        with patch("config.validate_startup_environment") as mock_validate:
            mock_config = Mock()
            mock_validate.return_value = mock_config

            result = get_config()

            assert result == mock_config
            mock_validate.assert_called_once()

    def test_get_config_reuses_instance(self):
        """Test get_config reuses existing configuration instance"""
        import config

        mock_config = Mock()
        config.config = mock_config

        with patch("config.validate_startup_environment") as mock_validate:
            result = get_config()

            assert result == mock_config
            mock_validate.assert_not_called()

    def teardown_method(self):
        """Reset global config after each test"""
        import config

        config.config = None


class TestConfigErrorHandling:
    """Test error handling in configuration parsing"""

    def test_invalid_integer_environment_variable(self):
        """Test that invalid integer values cause ValueError"""
        with patch.dict(os.environ, {"SERVER_PORT": "not_a_number"}, clear=True):
            with pytest.raises(ValueError):
                EnvironmentConfig()

    def test_invalid_float_environment_variable(self):
        """Test that invalid float values cause ValueError"""
        with patch.dict(os.environ, {"WHISPER_TEMPERATURE": "not_a_float"}, clear=True):
            with pytest.raises(ValueError):
                EnvironmentConfig()
