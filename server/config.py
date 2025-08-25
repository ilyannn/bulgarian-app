"""
Configuration and environment validation for Bulgarian Voice Coach
"""

import logging
import os
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


class ConfigError(Exception):
    """Configuration validation error"""

    pass


class EnvironmentConfig:
    """Environment configuration with validation"""

    def __init__(self):
        """Initialize configuration from environment variables"""
        # LLM Configuration
        self.chat_provider = os.getenv("CHAT_PROVIDER", "dummy").lower()
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        self.anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")

        # ASR Configuration
        self.whisper_model_path = os.getenv("WHISPER_MODEL_PATH", "medium")
        self.whisper_language = os.getenv("WHISPER_LANGUAGE", "bg")
        self.whisper_beam_size = int(os.getenv("WHISPER_BEAM_SIZE", "5"))
        self.whisper_temperature = float(os.getenv("WHISPER_TEMPERATURE", "0.0"))
        self.whisper_no_speech_threshold = float(
            os.getenv("WHISPER_NO_SPEECH_THRESHOLD", "0.6")
        )

        # TTS Configuration
        self.espeak_voice = os.getenv("ESPEAK_VOICE", "bg")
        self.espeak_speed = int(os.getenv("ESPEAK_SPEED", "160"))
        self.espeak_pitch = int(os.getenv("ESPEAK_PITCH", "50"))
        self.espeak_path = os.getenv("ESPEAK_PATH")

        # Audio Configuration
        self.sample_rate = int(os.getenv("SAMPLE_RATE", "16000"))
        self.frame_duration_ms = int(os.getenv("FRAME_DURATION_MS", "20"))
        self.vad_aggressiveness = int(os.getenv("VAD_AGGRESSIVENESS", "2"))

        # Server Configuration
        self.server_host = os.getenv("SERVER_HOST", "127.0.0.1")
        self.server_port = int(os.getenv("SERVER_PORT", "8000"))
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        self.log_level = os.getenv("LOG_LEVEL", "INFO").upper()
        self.reload = os.getenv("RELOAD", "true").lower() == "true"

        # CORS Configuration
        allowed_origins_str = os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        )
        self.allowed_origins = [
            origin.strip() for origin in allowed_origins_str.split(",")
        ]

        # Content System Configuration
        self.default_l1_language = os.getenv("DEFAULT_L1_LANGUAGE", "PL")
        self.grammar_pack_path = os.getenv(
            "GRAMMAR_PACK_PATH", "content/bg_grammar_pack.json"
        )
        self.scenarios_path = os.getenv(
            "SCENARIOS_PATH", "content/bg_scenarios_with_grammar.json"
        )

        # Development & Debugging
        self.enable_metrics = os.getenv("ENABLE_METRICS", "false").lower() == "true"
        self.log_requests = os.getenv("LOG_REQUESTS", "false").lower() == "true"
        self.log_asr_details = os.getenv("LOG_ASR_DETAILS", "false").lower() == "true"

        # OpenTelemetry Configuration
        self.otel_enabled = os.getenv("OTEL_ENABLED", "false").lower() == "true"
        self.otel_service_name = os.getenv("OTEL_SERVICE_NAME", "bulgarian-voice-coach")
        self.otel_console_export = (
            os.getenv("OTEL_CONSOLE_EXPORT", "false").lower() == "true"
        )
        self.otel_otlp_traces_endpoint = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
        self.otel_otlp_metrics_endpoint = os.getenv(
            "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT"
        )
        self.environment = os.getenv("ENVIRONMENT", "development")

    def validate_environment(self) -> list[str]:
        """Validate environment configuration and return list of issues"""
        issues = []

        # Validate LLM provider configuration
        if self.chat_provider == "openai" and not self.openai_api_key:
            issues.append("OpenAI API key is required when CHAT_PROVIDER=openai")
        elif self.chat_provider == "claude" and not self.anthropic_api_key:
            issues.append("Anthropic API key is required when CHAT_PROVIDER=claude")
        elif self.chat_provider == "auto":
            if not self.openai_api_key and not self.anthropic_api_key:
                logger.warning("No API keys found, falling back to dummy provider")
                self.chat_provider = "dummy"

        # Validate content files exist
        server_dir = Path(__file__).parent
        grammar_pack_path = server_dir / self.grammar_pack_path
        scenarios_path = server_dir / self.scenarios_path

        if not grammar_pack_path.exists():
            issues.append(f"Grammar pack file not found: {grammar_pack_path}")
        if not scenarios_path.exists():
            issues.append(f"Scenarios file not found: {scenarios_path}")

        # Validate eSpeak NG installation
        if not self._check_espeak_installation():
            issues.append(
                "eSpeak NG not found. Please install eSpeak NG for text-to-speech functionality"
            )

        # Validate audio configuration
        if self.sample_rate not in [8000, 16000, 22050, 44100, 48000]:
            issues.append(
                f"Invalid sample rate: {self.sample_rate}. Use standard rates like 16000"
            )

        if not (1 <= self.vad_aggressiveness <= 3):
            issues.append(
                f"VAD aggressiveness must be 1-3, got: {self.vad_aggressiveness}"
            )

        # Validate L1 language
        if self.default_l1_language not in ["PL", "RU", "UK", "SR"]:
            issues.append(
                f"Invalid L1 language: {self.default_l1_language}. Use PL, RU, UK, or SR"
            )

        return issues

    def _check_espeak_installation(self) -> bool:
        """Check if eSpeak NG is installed and accessible"""
        try:
            # Try custom path first if specified
            if self.espeak_path:
                result = subprocess.run(
                    [self.espeak_path, "--version"], capture_output=True, timeout=5
                )
                return result.returncode == 0

            # Try common installation paths
            for cmd in ["espeak-ng", "espeak"]:
                try:
                    result = subprocess.run(
                        [cmd, "--version"], capture_output=True, timeout=5
                    )
                    if result.returncode == 0:
                        return True
                except FileNotFoundError:
                    continue

            return False
        except (subprocess.TimeoutExpired, Exception):
            return False

    def setup_logging(self):
        """Configure logging based on environment settings"""
        logging.basicConfig(
            level=getattr(logging, self.log_level, logging.INFO),
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[logging.StreamHandler(sys.stdout)],
        )

        if self.log_requests:
            logging.getLogger("uvicorn.access").setLevel(logging.DEBUG)

        if self.log_asr_details:
            logging.getLogger("asr").setLevel(logging.DEBUG)


def validate_startup_environment() -> EnvironmentConfig:
    """Validate environment on startup and return configuration"""
    logger.info("Validating environment configuration...")

    config = EnvironmentConfig()
    config.setup_logging()

    issues = config.validate_environment()

    if issues:
        logger.error("Environment validation failed:")
        for issue in issues:
            logger.error(f"  - {issue}")

        # Check if any issues are critical
        critical_issues = [
            issue
            for issue in issues
            if any(
                keyword in issue.lower()
                for keyword in ["not found", "required", "invalid"]
            )
        ]

        if critical_issues:
            logger.error(
                "Critical configuration issues found. Please fix these issues:"
            )
            for issue in critical_issues:
                logger.error(f"  CRITICAL: {issue}")
            raise ConfigError("Critical environment configuration issues found")
        else:
            logger.warning(
                "Non-critical environment issues found, continuing with warnings"
            )
    else:
        logger.info("Environment validation passed ✅")

    logger.info(
        f"Configuration: LLM Provider={config.chat_provider}, "
        f"Whisper Model={config.whisper_model_path}, "
        f"L1 Language={config.default_l1_language}"
    )

    return config


# Global configuration instance
config: EnvironmentConfig | None = None


def get_config() -> EnvironmentConfig:
    """Get the global configuration instance"""
    global config
    if config is None:
        config = validate_startup_environment()
    return config
