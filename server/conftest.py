"""
Pytest configuration and shared fixtures for Bulgarian Voice Coach tests.
"""

import asyncio
from unittest.mock import Mock, patch

import numpy as np
import pytest


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_audio_data():
    """Provide mock audio data for testing."""
    # Generate realistic-looking audio data
    duration = 2.0  # 2 seconds
    sample_rate = 16000
    samples = int(duration * sample_rate)

    # Create audio with some variation (not just zeros)
    audio = np.random.normal(0, 0.1, samples).astype(np.float32)

    return audio


@pytest.fixture
def mock_bulgarian_text():
    """Provide sample Bulgarian text for testing."""
    return [
        "Здравей свят!",
        "Как се казваш?",
        "Искам да ям нещо.",
        "Моля, помогнете ми.",
        "Благодаря много.",
        "До скоро виждане!",
    ]


@pytest.fixture
def mock_grammar_data():
    """Provide mock grammar data for testing."""
    return {
        "bg.no_infinitive.da_present": {
            "id": "bg.no_infinitive.da_present",
            "explanation": "Bulgarian uses да + present tense instead of infinitive",
            "examples": [
                "Искам да ям (I want to eat)",
                "Трябва да учиш (You have to study)",
                "Мога да дойда (I can come)",
            ],
            "l1_contrast": {
                "polish": "Polish uses infinitive: chcę jeść",
                "russian": "Russian uses infinitive: хочу есть",
                "serbian": "Serbian uses da + present: hoću da jedem",
            },
            "level": "A1",
            "frequency": "high",
        },
        "bg.definite_article": {
            "id": "bg.definite_article",
            "explanation": "Bulgarian definite article is a suffix attached to the noun",
            "examples": [
                "къща → къщата (house → the house)",
                "мъж → мъжът (man → the man)",
                "дете → детето (child → the child)",
            ],
            "level": "A1",
            "frequency": "high",
        },
    }


@pytest.fixture
def mock_scenario_data():
    """Provide mock scenario data for testing."""
    return {
        "restaurant_order": {
            "id": "restaurant_order",
            "title": "Ordering Food at a Restaurant",
            "description": "Practice ordering food and drinks in Bulgarian",
            "level": "A2",
            "grammar_focus": ["bg.no_infinitive.da_present", "bg.definite_article"],
            "vocabulary": ["храна", "пиене", "сметка", "сервитьор"],
            "dialogue": [
                {"speaker": "waiter", "text": "Добро утро! Какво ще желаете?"},
                {"speaker": "customer", "text": "Искам да поръчам салата, моля."},
                {"speaker": "waiter", "text": "Отлично! И какво ще пиете?"},
            ],
        },
        "directions": {
            "id": "directions",
            "title": "Asking for Directions",
            "description": "Learn how to ask for and give directions in Bulgarian",
            "level": "A2",
            "grammar_focus": ["bg.definite_article"],
            "vocabulary": ["улица", "площад", "спирка", "наляво", "надясно"],
            "dialogue": [
                {"speaker": "tourist", "text": "Извинете, къде е автобусната спирка?"},
                {"speaker": "local", "text": "Вървете направо и завийте наляво."},
            ],
        },
    }


@pytest.fixture
def mock_asr_processor():
    """Provide a mock ASR processor."""
    processor = Mock()
    processor.process_audio = Mock(
        return_value={"text": "Здравей свят", "confidence": 0.95, "language": "bg"}
    )
    return processor


@pytest.fixture
def mock_tts_processor():
    """Provide a mock TTS processor."""
    processor = Mock()
    processor.synthesize = Mock(return_value=b"fake_audio_data")
    processor.synthesize_streaming = Mock(return_value=[b"chunk1", b"chunk2"])
    return processor


@pytest.fixture
def mock_chat_provider():
    """Provide a mock chat provider."""
    provider = Mock()
    provider.get_response = Mock(return_value="Добре дошли в българския урок!")
    return provider


@pytest.fixture(autouse=True)
def reset_global_state():
    """Reset global state before each test."""
    # Patch global variables that might interfere between tests
    with (
        patch("app.grammar_index", {}),
        patch("app.scenarios", {}),
        patch("app.asr_processor", None),
        patch("app.tts_processor", None),
        patch("app.chat_provider", None),
    ):
        yield


@pytest.fixture
def mock_whisper_model():
    """Provide a mock Whisper model."""
    model = Mock()
    model.transcribe = Mock(
        return_value=(
            [
                {
                    "text": " Test transcription",
                    "start": 0.0,
                    "end": 2.0,
                    "avg_logprob": -0.5,
                }
            ],
            {"language": "en"},
        )
    )
    return model


@pytest.fixture
def mock_espeak_subprocess():
    """Provide a mock subprocess for espeak-ng."""
    result = Mock()
    result.returncode = 0
    result.stdout = b"fake_wav_audio_data"
    result.stderr = b""
    return result


@pytest.fixture
def bulgarian_grammar_errors():
    """Provide sample grammar errors in Bulgarian."""
    return [
        {
            "type": "infinitive_usage",
            "message": "Use да + present tense instead of infinitive",
            "position": {"start": 5, "end": 10},
            "suggestion": "да ям",
            "original": "ести",
        },
        {
            "type": "definite_article",
            "message": "Missing definite article",
            "position": {"start": 0, "end": 5},
            "suggestion": "къщата",
            "original": "къща",
        },
    ]


# Async test utilities
@pytest.fixture
def async_test():
    """Helper fixture for async tests."""

    def _async_test(coro):
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(coro)

    return _async_test


# Performance testing fixtures
@pytest.fixture
def performance_timer():
    """Timer fixture for performance tests."""
    import time

    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None

        def start(self):
            self.start_time = time.time()

        def stop(self):
            self.end_time = time.time()

        @property
        def elapsed(self):
            if self.start_time is None or self.end_time is None:
                return None
            return self.end_time - self.start_time

    return Timer()


# Test data validation
def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line("markers", "integration: marks tests as integration tests")
    config.addinivalue_line("markers", "unit: marks tests as unit tests")


# Test collection customization
def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers automatically."""
    for item in items:
        # Mark tests based on their names or locations
        if "test_integration" in item.name or "Integration" in str(item.cls):
            item.add_marker(pytest.mark.integration)
        elif "test_performance" in item.name or "Performance" in str(item.cls):
            item.add_marker(pytest.mark.slow)
        else:
            item.add_marker(pytest.mark.unit)


# Cleanup fixtures
@pytest.fixture(scope="function", autouse=True)
def cleanup_temp_files():
    """Clean up temporary files after each test."""
    import os
    import shutil

    temp_dirs = []
    temp_files = []

    yield

    # Cleanup temporary directories
    for temp_dir in temp_dirs:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

    # Cleanup temporary files
    for temp_file in temp_files:
        if os.path.exists(temp_file):
            os.unlink(temp_file)
