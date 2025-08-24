"""
Unit tests for LLM (Large Language Model) provider module.
"""

import asyncio
from unittest.mock import AsyncMock, Mock, patch

import pytest
from llm import (
    ChatProvider,
    ClaudeProvider,
    DummyProvider,
    OpenAIProvider,
    get_chat_response,
)


class TestChatProvider:
    """Test the abstract ChatProvider base class."""

    def test_chat_provider_is_abstract(self):
        """Test that ChatProvider cannot be instantiated directly."""
        with pytest.raises(TypeError):
            ChatProvider()  # pyright: ignore [reportAbstractUsage]

    def test_chat_provider_subclass_must_implement_get_response(self):
        """Test that subclasses must implement get_response method."""

        class IncompleteProvider(ChatProvider):
            pass

        with pytest.raises(TypeError):
            IncompleteProvider()  # pyright: ignore [reportAbstractUsage]


class TestDummyProvider:
    """Test the DummyProvider implementation."""

    def test_dummy_provider_instantiation(self):
        """Test that DummyProvider can be instantiated."""
        provider = DummyProvider()
        assert isinstance(provider, DummyProvider)
        assert isinstance(provider, ChatProvider)

    @pytest.mark.asyncio
    async def test_dummy_provider_get_response(self):
        """Test DummyProvider response generation."""
        provider = DummyProvider()

        response = await provider.get_response("Здравей", "Test system prompt")

        assert isinstance(response, str)
        assert len(response) > 0
        # DummyProvider should return a Bulgarian response
        assert any(char in response for char in "абвгдежзийклмнопрстуфхцчшщъьюя")

    @pytest.mark.asyncio
    async def test_dummy_provider_different_inputs(self):
        """Test DummyProvider with different input types."""
        provider = DummyProvider()

        # Test with empty string
        response1 = await provider.get_response("", "system")
        assert isinstance(response1, str)

        # Test with long text
        long_text = "Това е много дълъг текст " * 10
        response2 = await provider.get_response(long_text, "system")
        assert isinstance(response2, str)

    @pytest.mark.asyncio
    async def test_dummy_provider_system_prompt_handling(self):
        """Test that DummyProvider handles system prompts."""
        provider = DummyProvider()

        response = await provider.get_response(
            "Здравей", "You are a Bulgarian language teacher. Be encouraging."
        )

        assert isinstance(response, str)
        # Response should still be in Bulgarian regardless of system prompt language


class TestOpenAIProvider:
    """Test the OpenAIProvider implementation."""

    def test_openai_provider_instantiation(self):
        """Test OpenAIProvider instantiation."""
        provider = OpenAIProvider("test-api-key")
        assert isinstance(provider, OpenAIProvider)
        assert isinstance(provider, ChatProvider)
        assert provider.api_key == "test-api-key"

    def test_openai_provider_model_setting(self):
        """Test OpenAIProvider model configuration."""
        provider = OpenAIProvider("test-key")
        # Test that the model is set to a default value
        assert provider.model == "gpt-4o-mini"

    @pytest.mark.asyncio
    @patch("llm.openai")
    async def test_openai_provider_get_response_success(self, mock_openai):
        """Test successful OpenAI API response."""
        # Setup mock
        mock_client = AsyncMock()
        mock_openai.AsyncOpenAI.return_value = mock_client

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Добре дошли!"

        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        provider = OpenAIProvider("test-key")
        result = await provider.get_response("Здравей", "Be helpful")

        assert result == "Добре дошли!"
        mock_client.chat.completions.create.assert_called_once()

    @pytest.mark.asyncio
    @patch("llm.openai")
    async def test_openai_provider_api_error_handling(self, mock_openai):
        """Test OpenAI API error handling."""
        mock_client = AsyncMock()
        mock_openai.AsyncOpenAI.return_value = mock_client
        mock_client.chat.completions.create = AsyncMock(
            side_effect=Exception("API Error")
        )

        provider = OpenAIProvider("test-key")
        result = await provider.get_response("test", "system")

        # Should return fallback message on error
        assert isinstance(result, str)
        assert "error" in result.lower() or "съжалявам" in result.lower()

    @pytest.mark.asyncio
    async def test_openai_provider_missing_openai_package(self):
        """Test behavior when openai package is not available."""
        with patch("llm.openai", None):
            provider = OpenAIProvider("test-key")
            result = await provider.get_response("test", "system")

            assert isinstance(result, str)
            assert "openai" in result.lower() or "недостъпен" in result.lower()


class TestClaudeProvider:
    """Test the ClaudeProvider implementation."""

    def test_claude_provider_instantiation(self):
        """Test ClaudeProvider instantiation."""
        provider = ClaudeProvider("test-api-key")
        assert isinstance(provider, ClaudeProvider)
        assert isinstance(provider, ChatProvider)
        assert provider.api_key == "test-api-key"

    def test_claude_provider_model_setting(self):
        """Test ClaudeProvider model configuration."""
        provider = ClaudeProvider("test-key")
        # Test that the model is set to a default value
        assert provider.model == "claude-3-haiku-20240307"

    @pytest.mark.asyncio
    @patch("llm.anthropic")
    async def test_claude_provider_get_response_success(self, mock_anthropic):
        """Test successful Claude API response."""
        # Setup mock
        mock_client = AsyncMock()
        mock_anthropic.AsyncAnthropic.return_value = mock_client

        mock_response = Mock()
        mock_response.content = [Mock()]
        mock_response.content[0].text = "Радвам се да помогна!"

        mock_client.messages.create = AsyncMock(return_value=mock_response)

        provider = ClaudeProvider("test-key")
        result = await provider.get_response("Помогни ми", "Be helpful")

        assert result == "Радвам се да помогна!"
        mock_client.messages.create.assert_called_once()

    @pytest.mark.asyncio
    @patch("llm.anthropic")
    async def test_claude_provider_api_error_handling(self, mock_anthropic):
        """Test Claude API error handling."""
        mock_client = AsyncMock()
        mock_anthropic.AsyncAnthropic.return_value = mock_client
        mock_client.messages.create = AsyncMock(side_effect=Exception("API Error"))

        provider = ClaudeProvider("test-key")
        result = await provider.get_response("test", "system")

        # Should return fallback message on error
        assert isinstance(result, str)
        assert "error" in result.lower() or "съжалявам" in result.lower()

    @pytest.mark.asyncio
    async def test_claude_provider_missing_anthropic_package(self):
        """Test behavior when anthropic package is not available."""
        with patch("llm.anthropic", None):
            provider = ClaudeProvider("test-key")
            result = await provider.get_response("test", "system")

            assert isinstance(result, str)
            assert "anthropic" in result.lower() or "недостъпен" in result.lower()


class TestProviderFactory:
    """Test the provider factory functionality."""

    def test_create_provider_dummy(self):
        """Test creating dummy provider."""
        from llm import ChatProviderFactory

        provider = ChatProviderFactory.create_provider("dummy")
        assert isinstance(provider, DummyProvider)

    def test_create_provider_openai(self):
        """Test creating OpenAI provider."""
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            from llm import ChatProviderFactory

            provider = ChatProviderFactory.create_provider("openai")
            assert isinstance(provider, OpenAIProvider)

    def test_create_provider_claude(self):
        """Test creating Claude provider."""
        with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key"}):
            from llm import ChatProviderFactory

            provider = ChatProviderFactory.create_provider("claude")
            assert isinstance(provider, ClaudeProvider)

    def test_create_provider_invalid(self):
        """Test creating provider with invalid type."""
        from llm import ChatProviderFactory

        provider = ChatProviderFactory.create_provider("invalid")
        # Should fallback to dummy
        assert isinstance(provider, DummyProvider)

    def test_create_provider_none(self):
        """Test creating provider with None type."""
        from llm import ChatProviderFactory

        provider = ChatProviderFactory.create_provider(None)
        # Should fallback to dummy
        assert isinstance(provider, DummyProvider)


class TestGetChatResponse:
    """Test the get_chat_response convenience function."""

    @pytest.mark.asyncio
    async def test_get_chat_response_with_provider(self):
        """Test get_chat_response with explicit provider."""
        mock_provider = Mock(spec=ChatProvider)
        mock_provider.get_response = AsyncMock(return_value="Test response")

        result = await get_chat_response("Test input", mock_provider)

        assert result == "Test response"
        mock_provider.get_response.assert_called_once_with("Test input", None)

    @pytest.mark.asyncio
    async def test_get_chat_response_without_provider(self):
        """Test get_chat_response without explicit provider."""
        result = await get_chat_response("Test input")

        # Should use default provider (DummyProvider)
        assert isinstance(result, str)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_get_chat_response_with_system_prompt(self):
        """Test get_chat_response uses hardcoded system prompt."""
        mock_provider = Mock(spec=ChatProvider)
        mock_provider.get_response = AsyncMock(return_value="System response")

        result = await get_chat_response("User input", mock_provider)

        assert result == "System response"
        # Verify it uses the hardcoded BULGARIAN_COACH_SYSTEM_PROMPT
        mock_provider.get_response.assert_called_once()
        call_args = mock_provider.get_response.call_args
        assert call_args[0][0] == "User input"  # First argument is user_input
        assert "Bulgarian" in call_args[0][1]  # Second argument contains system prompt


class TestAsyncBehavior:
    """Test async behavior of providers."""

    @pytest.mark.asyncio
    async def test_concurrent_requests(self):
        """Test handling concurrent requests to same provider."""
        provider = DummyProvider()

        # Create multiple concurrent requests
        tasks = [provider.get_response(f"Message {i}", "system") for i in range(5)]

        results = await asyncio.gather(*tasks)

        assert len(results) == 5
        for result in results:
            assert isinstance(result, str)
            assert len(result) > 0

    @pytest.mark.asyncio
    async def test_provider_response_time(self):
        """Test that providers respond within reasonable time."""
        import time

        provider = DummyProvider()

        start_time = time.time()
        await provider.get_response("Quick test", "system")
        end_time = time.time()

        # DummyProvider should respond very quickly (< 1 second)
        assert (end_time - start_time) < 1.0


class TestIntegration:
    """Integration tests for the LLM module."""

    def test_all_providers_implement_interface(self):
        """Test that all providers implement the ChatProvider interface."""
        providers = [DummyProvider(), OpenAIProvider("test"), ClaudeProvider("test")]

        for provider in providers:
            assert isinstance(provider, ChatProvider)
            assert hasattr(provider, "get_response")
            assert callable(provider.get_response)

    @pytest.mark.asyncio
    async def test_error_resilience(self):
        """Test that the system is resilient to provider errors."""
        # Test with a provider that might fail
        provider = DummyProvider()

        # Should handle various edge cases
        test_inputs = ["", "Very long text " * 100, "Special chars: АБВ", None]

        for test_input in test_inputs:
            try:
                if test_input is None:
                    continue  # Skip None input
                result = await provider.get_response(str(test_input), "system")
                assert isinstance(result, str)
            except Exception as e:
                pytest.fail(f"Provider failed on input '{test_input}': {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
