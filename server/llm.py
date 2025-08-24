import asyncio
import os
from abc import ABC, abstractmethod


class ChatProvider(ABC):
    """Abstract base class for chat providers"""

    @abstractmethod
    async def get_response(self, user_input: str, system_prompt: str, **kwargs) -> str:
        """Get response from the chat provider"""
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is available and configured"""
        pass


class DummyProvider(ChatProvider):
    """Dummy chat provider that echoes user input with Bulgarian coaching format"""

    bulgarian_responses = [
        "Благодаря ти за опита! Ето една корекция:",
        "Добре се опита! Ето как можеш да кажеш по-добре:",
        "Разбрах те! Ето правилният начин:",
        "Браво! Ето една малка корекция:",
        "Отлично! Сега се опитай така:",
    ]

    def __init__(self):
        self.response_count = 0

    async def get_response(self, user_input: str, system_prompt: str, **kwargs) -> str:
        """Return a dummy response in Bulgarian"""
        await asyncio.sleep(0.1)  # Simulate processing time

        response_template = self.bulgarian_responses[
            self.response_count % len(self.bulgarian_responses)
        ]
        self.response_count += 1

        # Simple echo with some coaching
        if user_input:
            return f"{response_template} '{user_input}' -> Много добре! Продължавай да практикуваш."
        else:
            return "Не те чух добре. Опитай пак, моля!"

    async def is_available(self) -> bool:
        return True


class OpenAIProvider(ChatProvider):
    """OpenAI ChatGPT provider"""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = "gpt-4o-mini"
        self.max_tokens = 500

    async def get_response(self, user_input: str, system_prompt: str, **kwargs) -> str:
        """Get response from OpenAI API"""
        if not await self.is_available():
            raise ValueError("OpenAI API key not configured")

        try:
            import openai

            client = openai.AsyncOpenAI(api_key=self.api_key)

            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input},
                ],
                max_tokens=self.max_tokens,
                temperature=0.7,
            )

            content = response.choices[0].message.content
            return content.strip() if content else ""

        except ImportError as e:
            raise RuntimeError(
                "OpenAI package not installed. Run: pip install openai"
            ) from e
        except Exception as e:
            print(f"OpenAI API error: {e}")
            return "Съжалявам, имам техническа грешка. Опитай пак."

    async def is_available(self) -> bool:
        return bool(self.api_key)


class ClaudeProvider(ChatProvider):
    """Anthropic Claude provider"""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = "claude-3-haiku-20240307"
        self.max_tokens = 500

    async def get_response(self, user_input: str, system_prompt: str, **kwargs) -> str:
        """Get response from Claude API"""
        if not await self.is_available():
            raise ValueError("Claude API key not configured")

        try:
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=self.api_key)

            response = await client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_input}],
            )

            content_block = response.content[0]
            text = getattr(content_block, "text", None)
            if text:
                return text.strip()
            else:
                return str(content_block).strip()

        except ImportError as e:
            raise RuntimeError(
                "Anthropic package not installed. Run: pip install anthropic"
            ) from e
        except Exception as e:
            print(f"Claude API error: {e}")
            return "Съжалявам, имам техническа грешка. Опитай пак."

    async def is_available(self) -> bool:
        return bool(self.api_key)


class ChatProviderFactory:
    """Factory for creating chat providers"""

    @staticmethod
    def create_provider(provider_type: str | None = None) -> ChatProvider:
        """
        Create a chat provider based on configuration

        Args:
            provider_type: Type of provider ("openai", "claude", "dummy", or None for auto-detect)

        Returns:
            ChatProvider instance
        """
        if provider_type is None:
            provider_type = os.getenv("CHAT_PROVIDER", "auto")

        if provider_type == "auto":
            # Auto-detect based on available API keys
            if os.getenv("OPENAI_API_KEY"):
                provider_type = "openai"
            elif os.getenv("ANTHROPIC_API_KEY"):
                provider_type = "claude"
            else:
                provider_type = "dummy"

        if provider_type == "openai":
            return OpenAIProvider()
        elif provider_type == "claude":
            return ClaudeProvider()
        elif provider_type == "dummy":
            return DummyProvider()
        else:
            raise ValueError(f"Unknown provider type: {provider_type}")


# Enhanced system prompt for Bulgarian coaching
BULGARIAN_COACH_SYSTEM_PROMPT = """You are an expert Bulgarian language coach specializing in helping Slavic speakers (Russian, Polish, Ukrainian, Serbian, etc.) learn Bulgarian.

Your role is to:
1. Respond ONLY in Bulgarian using natural, conversational Bulgarian
2. Provide gentle corrections when needed
3. Give brief contrastive notes highlighting differences from other Slavic languages
4. Encourage continued practice
5. Keep responses concise but helpful (max 2-3 sentences)

Key Bulgarian features to focus on:
- Definite articles are postposed (-ът, -та, -то, -те)
- No infinitive - use "да" + present tense
- Future with "ще"
- Clitic pronouns have specific positioning rules

Always maintain an encouraging, patient tone suitable for language learning."""


async def get_chat_response(
    user_input: str, provider: ChatProvider | None = None
) -> str:
    """
    Get a chat response using the specified or default provider

    Args:
        user_input: User's input text
        provider: Chat provider to use (creates default if None)

    Returns:
        Response text in Bulgarian
    """
    if provider is None:
        provider = ChatProviderFactory.create_provider()

    try:
        response = await provider.get_response(
            user_input, BULGARIAN_COACH_SYSTEM_PROMPT
        )
        return response
    except Exception as e:
        print(f"Chat response error: {e}")
        # Fallback to dummy provider
        dummy_provider = DummyProvider()
        return await dummy_provider.get_response(
            user_input, BULGARIAN_COACH_SYSTEM_PROMPT
        )
