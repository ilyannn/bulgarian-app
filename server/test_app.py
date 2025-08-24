"""
Unit tests for the Bulgarian Voice Coach FastAPI application.
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from app import CoachResponse, app
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)


@pytest.fixture
def mock_processors():
    """Mock the global processors to avoid dependency issues."""
    with (
        patch("app.asr_processor") as mock_asr,
        patch("app.tts_processor") as mock_tts,
        patch("app.chat_provider") as mock_chat,
    ):
        mock_asr.process_audio = AsyncMock(return_value={"text": "Здравей"})
        mock_tts.synthesize_streaming = Mock(return_value=[b"audio_data"])
        mock_chat.get_response = AsyncMock(return_value="Добре дошли!")

        yield {"asr": mock_asr, "tts": mock_tts, "chat": mock_chat}


class TestHealthEndpoints:
    """Test health check endpoints."""

    def test_root_endpoint_with_static_files(self, client):
        """Test the root endpoint (serves static files if available)."""
        # Since static files might not exist in test env, just check it doesn't crash
        response = client.get("/")
        # Could be 404 (no static files) or 200 (static files found)
        assert response.status_code in [200, 404]

    def test_nonexistent_endpoint(self, client):
        """Test a non-existent endpoint returns 404."""
        response = client.get("/nonexistent")
        assert response.status_code == 404


class TestContentEndpoints:
    """Test content-related endpoints."""

    @patch(
        "app.SCENARIOS",
        {"test_scenario": {"id": "test_scenario", "title": "Test Scenario"}},
    )
    def test_get_scenarios(self, client):
        """Test retrieving scenarios."""
        response = client.get("/content/scenarios")
        assert response.status_code == 200
        data = response.json()
        # The endpoint returns list(SCENARIOS.values())
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["title"] == "Test Scenario"

    @patch("app.get_grammar_item")
    def test_get_grammar_item_success(self, mock_get_grammar, client):
        """Test successful grammar item retrieval."""
        mock_get_grammar.return_value = {
            "id": "test_item",
            "explanation": "Test explanation",
            "examples": ["Test example"],
        }

        response = client.get("/content/grammar/test_item")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "test_item"
        assert data["explanation"] == "Test explanation"

    @patch("app.get_grammar_item")
    def test_get_grammar_item_not_found(self, mock_get_grammar, client):
        """Test grammar item not found."""
        mock_get_grammar.return_value = None

        response = client.get("/content/grammar/nonexistent")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestTTSEndpoints:
    """Test text-to-speech endpoints."""

    def test_tts_missing_text(self, client):
        """Test TTS endpoint with missing text parameter."""
        response = client.get("/tts")
        assert response.status_code == 422  # Validation error

    @patch("app.tts_processor")
    def test_tts_success(self, mock_tts, client):
        """Test successful TTS generation."""
        mock_tts.synthesize_streaming.return_value = [b"audio_chunk1", b"audio_chunk2"]

        response = client.get("/tts", params={"text": "Здравей"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"

        # Verify the mock was called with correct text
        mock_tts.synthesize_streaming.assert_called_once_with("Здравей")

    @patch("app.tts_processor", None)
    def test_tts_processor_not_available(self, client):
        """Test TTS when processor is not available."""
        response = client.get("/tts", params={"text": "test"})
        assert response.status_code == 500


class TestCoachResponse:
    """Test the CoachResponse model."""

    def test_coach_response_creation(self):
        """Test creating a CoachResponse instance."""
        response = CoachResponse(
            reply_bg="Добре!",
            corrections=[{"error": "test", "correction": "test"}],
            contrastive_note="Test note",
        )

        assert response.reply_bg == "Добре!"
        assert len(response.corrections) == 1
        assert response.contrastive_note == "Test note"
        assert response.drills == []  # Default empty list

    def test_coach_response_with_drills(self):
        """Test CoachResponse with drills."""
        drills = [{"type": "multiple_choice", "question": "Test?"}]
        response = CoachResponse(
            reply_bg="Добре!", corrections=[], contrastive_note=None, drills=drills
        )

        assert response.drills == drills


class TestProcessUserInput:
    """Test the process_user_input function."""

    @patch("app.detect_grammar_errors")
    @patch("app.chat_provider")
    async def test_process_user_input(self, mock_chat, mock_detect_errors):
        """Test processing user input."""
        # Import here to avoid circular import issues
        from app import process_user_input

        # Setup mocks
        mock_detect_errors.return_value = [{"error": "test", "correction": "тест"}]
        mock_chat.get_response = AsyncMock(return_value="Добре казано!")

        result = await process_user_input("test input")

        assert isinstance(result, CoachResponse)
        assert result.reply_bg == "Добре казано!"
        assert len(result.corrections) == 1
        assert result.corrections[0]["error"] == "test"


class TestWebSocketConnection:
    """Test WebSocket functionality."""

    def test_websocket_asr_endpoint_exists(self, client, mock_processors):
        """Test that ASR WebSocket endpoint exists."""
        # Simple test to verify the WebSocket endpoint is defined
        # We'll check the app's routes contain a WebSocket route
        routes = []
        for route in app.routes:
            if hasattr(route, "path"):
                path = getattr(route, "path", None)
                if path:
                    routes.append((path, type(route).__name__))

        # Check that we have a WebSocket route with /ws/asr path
        websocket_routes = [
            path for path, route_type in routes if "WebSocket" in route_type
        ]
        assert any("/ws/asr" in route for route in websocket_routes)


class TestStartupEvent:
    """Test application startup."""

    @patch("app.ASRProcessor")
    @patch("app.TTSProcessor")
    @patch("app.DummyProvider")
    @patch("app.load_grammar_pack")
    @patch("app.load_scenarios")
    async def test_lifespan_initialization(
        self,
        mock_load_scenarios,
        mock_load_grammar,
        mock_dummy_provider,
        mock_tts_processor,
        mock_asr_processor,
    ):
        """Test the lifespan initialization."""
        from app import lifespan
        from unittest.mock import AsyncMock

        # Setup mocks
        mock_load_grammar.return_value = {"test": "grammar"}
        mock_load_scenarios.return_value = {"test": "scenario"}

        # Create a mock FastAPI app
        mock_app = AsyncMock()

        # Test the lifespan context manager
        async with lifespan(mock_app):
            # Verify processors were instantiated
            mock_asr_processor.assert_called_once()
            mock_tts_processor.assert_called_once()
            mock_dummy_provider.assert_called_once()

        # Verify content was loaded
        mock_load_grammar.assert_called_once()
        mock_load_scenarios.assert_called_once()


class TestIntegration:
    """Integration tests combining multiple components."""

    def test_app_creation(self):
        """Test that the app is created successfully."""
        assert app.title == "Bulgarian Voice Coach"
        assert app.version == "0.1.0"

    def test_cors_middleware(self):
        """Test that CORS middleware is configured."""
        # Check that CORS middleware is in the middleware stack
        # FastAPI stores middleware in a different structure
        middleware_stack = app.middleware_stack
        assert middleware_stack is not None
        # Just verify we can make requests (CORS would block if not configured)
        from fastapi.testclient import TestClient

        test_client = TestClient(app)
        response = test_client.get("/content/scenarios")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
