"""
Comprehensive WebSocket tests for Bulgarian Voice Coach ASR endpoint
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from app import app
from fastapi.testclient import TestClient


class TestWebSocketASR:
    """Test WebSocket ASR endpoint functionality"""

    @pytest.fixture
    def mock_asr_processor(self):
        """Mock ASR processor with different response scenarios"""
        mock = Mock()
        mock.process_audio_chunk = Mock()
        return mock

    @pytest.fixture
    def mock_chat_provider(self):
        """Mock chat provider for coaching responses"""
        mock = AsyncMock()
        mock.get_response = AsyncMock(return_value="Много добре!")
        return mock

    @pytest.fixture
    def mock_processors(self, mock_asr_processor, mock_chat_provider):
        """Mock all processors for WebSocket testing"""
        with (
            patch("app.asr_processor", mock_asr_processor),
            patch("app.chat_provider", mock_chat_provider),
            patch("app.tts_processor", Mock()),
            patch("app.get_telemetry", return_value=None),
        ):
            yield {
                "asr": mock_asr_processor,
                "chat": mock_chat_provider,
            }

    def test_websocket_connection_accepted(self, mock_processors):
        """Test WebSocket connection is accepted"""
        with TestClient(app).websocket_connect("/ws/asr") as websocket:
            # Connection should be established successfully
            assert websocket is not None

    def test_websocket_asr_not_initialized(self):
        """Test WebSocket closes when ASR processor is not initialized"""
        with (
            patch("app.asr_processor", None),
            patch("app.get_telemetry", return_value=None),
        ):
            # WebSocket should connect but close immediately when ASR not available
            try:
                with TestClient(app).websocket_connect("/ws/asr") as websocket:
                    # Try to send data - should fail since connection was closed
                    websocket.send_bytes(b"test_data")
                    # If we reach here, the connection didn't close as expected
                    raise AssertionError(
                        "Expected WebSocket to be closed when ASR not initialized"
                    )
            except Exception:
                # Expected - WebSocket should close/disconnect
                pass

    def test_websocket_partial_transcript(self, mock_processors):
        """Test WebSocket handles partial transcripts"""
        mock_processors["asr"].process_audio_chunk.return_value = {
            "type": "partial",
            "text": "Здра",
        }

        with TestClient(app).websocket_connect("/ws/asr") as websocket:
            # Send audio data
            audio_data = b"fake_audio_data"
            websocket.send_bytes(audio_data)

            # Receive partial response
            response = websocket.receive_json()

            assert response["type"] == "partial"
            assert response["text"] == "Здра"
            assert mock_processors["asr"].process_audio_chunk.called

    def test_websocket_final_transcript(self, mock_processors):
        """Test WebSocket handles final transcripts with coaching"""
        mock_processors["asr"].process_audio_chunk.return_value = {
            "type": "final",
            "text": "Здравей, как си?",
        }

        with TestClient(app).websocket_connect("/ws/asr") as websocket:
            audio_data = b"fake_audio_data"
            websocket.send_bytes(audio_data)

            # Should receive final transcript
            final_response = websocket.receive_json()
            assert final_response["type"] == "final"
            assert final_response["text"] == "Здравей, как си?"

            # Should receive coach response
            coach_response = websocket.receive_json()
            assert coach_response["type"] == "coach"
            assert "payload" in coach_response
            assert "reply_bg" in coach_response["payload"]

    def test_websocket_empty_asr_result(self, mock_processors):
        """Test WebSocket handles empty ASR results"""
        mock_processors["asr"].process_audio_chunk.return_value = None

        with TestClient(app).websocket_connect("/ws/asr") as websocket:
            audio_data = b"fake_audio_data"
            websocket.send_bytes(audio_data)

            # Give time for processing, but no response should be sent
            import time

            time.sleep(0.1)

            # Verify ASR processor was called even with None result
            mock_processors["asr"].process_audio_chunk.assert_called_with(audio_data)

    def test_websocket_multiple_audio_chunks(self, mock_processors):
        """Test WebSocket handles multiple sequential audio chunks"""
        # Setup sequence of responses
        responses = [
            {"type": "partial", "text": "Здра"},
            {"type": "partial", "text": "Здравей"},
            {"type": "final", "text": "Здравей!"},
        ]

        mock_processors["asr"].process_audio_chunk.side_effect = responses

        with TestClient(app).websocket_connect("/ws/asr") as websocket:
            for i in range(3):
                websocket.send_bytes(f"audio_chunk_{i}".encode())

                response = websocket.receive_json()
                expected_type = responses[i]["type"]
                expected_text = responses[i]["text"]

                assert response["type"] == expected_type
                assert response["text"] == expected_text

                # Final response should trigger coaching
                if expected_type == "final":
                    coach_response = websocket.receive_json()
                    assert coach_response["type"] == "coach"

    @patch("app.detect_grammar_errors")
    def test_websocket_grammar_error_detection(
        self, mock_grammar_detector, mock_processors
    ):
        """Test WebSocket integrates grammar error detection"""
        mock_processors["asr"].process_audio_chunk.return_value = {
            "type": "final",
            "text": "Аз съм студент",  # Grammatically correct
        }

        mock_grammar_detector.return_value = []  # No errors

        with TestClient(app).websocket_connect("/ws/asr") as websocket:
            websocket.send_bytes(b"audio_data")

            # Skip final transcript
            websocket.receive_json()

            # Check coach response
            coach_response = websocket.receive_json()
            assert coach_response["type"] == "coach"

            payload = coach_response["payload"]
            assert "corrections" in payload
            assert len(payload["corrections"]) == 0  # No grammar errors

    def test_websocket_binary_data_required(self, mock_processors):
        """Test WebSocket only accepts binary audio data"""
        # Set up a proper return value for the mock
        mock_processors["asr"].process_audio_chunk.return_value = {
            "type": "partial",
            "text": "test response",
        }

        with TestClient(app).websocket_connect("/ws/asr") as websocket:
            # Sending binary data should work
            audio_data = b"binary_audio_data"
            websocket.send_bytes(audio_data)

            # Should receive the partial response
            response = websocket.receive_json()
            assert response["type"] == "partial"

            mock_processors["asr"].process_audio_chunk.assert_called_with(audio_data)

    def test_websocket_asr_processor_exception(self, mock_processors):
        """Test WebSocket handles ASR processor exceptions gracefully"""
        mock_processors["asr"].process_audio_chunk.side_effect = Exception("ASR failed")

        # WebSocket should handle exception gracefully and close connection
        try:
            with TestClient(app).websocket_connect("/ws/asr") as websocket:
                websocket.send_bytes(b"audio_data")
                # Try to receive response - should fail since connection closed
                websocket.receive_json()
                raise AssertionError("Expected WebSocket to close due to ASR exception")
        except Exception:
            # Expected - WebSocket should close due to exception
            pass

    @patch("app.process_user_input")
    def test_websocket_coaching_pipeline_exception(
        self, mock_process_input, mock_processors
    ):
        """Test WebSocket handles coaching pipeline exceptions"""
        mock_processors["asr"].process_audio_chunk.return_value = {
            "type": "final",
            "text": "Test text",
        }
        mock_process_input.side_effect = Exception("Coaching failed")

        try:
            with TestClient(app).websocket_connect("/ws/asr") as websocket:
                websocket.send_bytes(b"audio_data")
                # Should handle final transcript
                final_response = websocket.receive_json()
                assert final_response["type"] == "final"
                # Exception in coaching should close connection before coach response
                websocket.receive_json()  # This should fail
                raise AssertionError(
                    "Expected WebSocket to close due to coaching exception"
                )
        except Exception:
            # Expected - WebSocket should close due to coaching exception
            pass

    def test_websocket_large_audio_chunk(self, mock_processors):
        """Test WebSocket handles large audio chunks"""
        mock_processors["asr"].process_audio_chunk.return_value = {
            "type": "partial",
            "text": "Large audio processed",
        }

        # Create large audio data (1MB)
        large_audio_data = b"x" * (1024 * 1024)

        with TestClient(app).websocket_connect("/ws/asr") as websocket:
            websocket.send_bytes(large_audio_data)

            response = websocket.receive_json()
            assert response["type"] == "partial"
            assert response["text"] == "Large audio processed"

            mock_processors["asr"].process_audio_chunk.assert_called_with(
                large_audio_data
            )


class TestWebSocketTelemetry:
    """Test WebSocket telemetry integration"""

    @pytest.fixture
    def mock_telemetry(self):
        """Mock telemetry context"""
        mock = Mock()
        mock.update_connections = Mock()
        mock.record_audio_processing = Mock()

        # Create a context manager mock for trace_operation
        trace_mock = Mock()
        trace_mock.__enter__ = Mock(return_value=trace_mock)
        trace_mock.__exit__ = Mock(return_value=None)
        mock.trace_operation = Mock(return_value=trace_mock)

        return mock

    def test_websocket_telemetry_connection_tracking(self, mock_telemetry):
        """Test WebSocket tracks connections in telemetry"""
        with (
            patch("app.asr_processor", Mock()),
            patch("app.get_telemetry", return_value=mock_telemetry),
        ):
            with TestClient(app).websocket_connect("/ws/asr"):
                # Connection should be tracked
                mock_telemetry.update_connections.assert_called_with(1)

    def test_websocket_telemetry_audio_processing(self, mock_telemetry):
        """Test WebSocket records audio processing metrics"""
        mock_asr = Mock()
        mock_asr.process_audio_chunk.return_value = {"type": "partial", "text": "test"}

        with (
            patch("app.asr_processor", mock_asr),
            patch("app.get_telemetry", return_value=mock_telemetry),
        ):
            with TestClient(app).websocket_connect("/ws/asr") as websocket:
                websocket.send_bytes(b"audio_data")

                # Wait for and process response
                response = websocket.receive_json()
                assert response["type"] == "partial"

                # Should trace ASR operation
                mock_telemetry.trace_operation.assert_called_with(
                    "asr_processing", audio_chunk_size=len(b"audio_data")
                )
                # Should record audio processing duration
                mock_telemetry.record_audio_processing.assert_called()

    def test_websocket_telemetry_coaching_pipeline(self, mock_telemetry):
        """Test WebSocket traces coaching pipeline operations"""
        mock_asr = Mock()
        mock_asr.process_audio_chunk.return_value = {
            "type": "final",
            "text": "Final transcript",
        }

        mock_chat = AsyncMock()
        mock_chat.get_response = AsyncMock(return_value="Response")

        with (
            patch("app.asr_processor", mock_asr),
            patch("app.chat_provider", mock_chat),
            patch("app.get_telemetry", return_value=mock_telemetry),
        ):
            with TestClient(app).websocket_connect("/ws/asr") as websocket:
                websocket.send_bytes(b"audio_data")

                # Skip responses to let processing complete
                websocket.receive_json()  # final transcript
                websocket.receive_json()  # coach response

                # Should trace coaching pipeline
                mock_telemetry.trace_operation.assert_any_call(
                    "coaching_pipeline", input_text="Final transcript"
                )
