import io
import logging
import struct
import subprocess
from collections.abc import Generator
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class VoiceProfile:
    """Voice profile configuration for eSpeak NG"""

    name: str
    speed: int  # Words per minute (80-450)
    pitch: int  # Pitch adjustment (0-99)
    pitch_range: int  # Pitch range (0-99)
    amplitude: int  # Volume/amplitude (0-200)
    word_gap: int  # Gap between words in 10ms units
    description: str

    def to_espeak_args(self) -> list[str]:
        """Convert profile to eSpeak command arguments"""
        return [
            "-s",
            str(self.speed),
            "-p",
            str(self.pitch),
            "-P",
            str(self.pitch_range),
            "-a",
            str(self.amplitude),
            "-g",
            str(self.word_gap),
        ]


class TTSProcessor:
    """Enhanced Text-to-Speech processor using eSpeak-NG for Bulgarian"""

    # Predefined voice profiles optimized for different use cases
    VOICE_PROFILES: dict[str, VoiceProfile] = {
        "default": VoiceProfile(
            name="default",
            speed=160,
            pitch=50,
            pitch_range=50,
            amplitude=100,
            word_gap=10,
            description="Standard Bulgarian voice",
        ),
        "natural": VoiceProfile(
            name="natural",
            speed=150,
            pitch=55,
            pitch_range=60,
            amplitude=110,
            word_gap=8,
            description="More natural-sounding Bulgarian voice",
        ),
        "slow": VoiceProfile(
            name="slow",
            speed=120,
            pitch=45,
            pitch_range=55,
            amplitude=120,
            word_gap=12,
            description="Slower pace for learning",
        ),
        "expressive": VoiceProfile(
            name="expressive",
            speed=140,
            pitch=60,
            pitch_range=70,
            amplitude=105,
            word_gap=6,
            description="More expressive and dynamic voice",
        ),
        "clear": VoiceProfile(
            name="clear",
            speed=130,
            pitch=52,
            pitch_range=45,
            amplitude=115,
            word_gap=15,
            description="Clear pronunciation with pauses",
        ),
    }

    def __init__(self, voice: str = "bg", profile: str = "natural"):
        self.sample_rate = 22050  # eSpeak default
        self.channels = 1  # mono
        self.sample_width = 2  # 16-bit
        self.voice = voice

        # Set voice profile
        if profile in self.VOICE_PROFILES:
            self.profile = self.VOICE_PROFILES[profile]
        else:
            logger.warning(f"Unknown profile '{profile}', using 'natural'")
            self.profile = self.VOICE_PROFILES["natural"]

        # Test if eSpeak-NG is available
        logger.info(
            f"Initializing TTS with voice: {voice}, profile: {self.profile.name} "
            f"({self.profile.description})"
        )
        try:
            result = subprocess.run(
                ["espeak-ng", "--version"], capture_output=True, text=True, timeout=5
            )
            if result.returncode != 0:
                raise RuntimeError("eSpeak-NG not found or not working")
            version_info = (
                result.stdout.strip().split("\n")[0]
                if result.stdout
                else "unknown version"
            )
            logger.info(f"✅ eSpeak-NG initialized successfully ({version_info})")
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            logger.error(f"❌ eSpeak-NG not available: {e}")
            raise RuntimeError(f"eSpeak-NG not available: {e}") from e

    def synthesize(self, text: str | None, language: str = "bg") -> bytes:
        """
        Synthesize text to speech and return complete WAV audio

        Args:
            text: Text to synthesize
            language: Language code (default: "bg" for Bulgarian)

        Returns:
            bytes: Complete WAV audio data
        """
        if not text or not text.strip():
            return b""

        try:
            # Create WAV header
            audio_chunks = [self._create_wav_header()]

            # Synthesize the text
            audio_data = self._synthesize_chunk(text, language)
            if audio_data:
                # Skip the WAV header from eSpeak output (first 44 bytes) if present
                if audio_data.startswith(b"RIFF"):
                    audio_data = audio_data[44:]  # Skip WAV header
                audio_chunks.append(audio_data)

            return b"".join(audio_chunks)

        except Exception as e:
            print(f"Synthesize error: {e}")
            return b""

    def synthesize_streaming(
        self, text: str, language: str = "bg"
    ) -> Generator[bytes, None, None]:
        """
        Synthesize text to speech and yield WAV chunks

        Args:
            text: Text to synthesize
            language: Language code (default: "bg" for Bulgarian)

        Yields:
            bytes: WAV audio chunks
        """
        if not text.strip():
            return

        try:
            # First, yield WAV header
            yield self._create_wav_header()

            # Process text in chunks for streaming
            sentences = self._split_into_sentences(text)

            for sentence in sentences:
                if sentence.strip():
                    audio_data = self._synthesize_chunk(sentence, language)
                    if audio_data:
                        yield audio_data

        except Exception as e:
            print(f"TTS Error: {e}")
            # Yield silence on error
            yield self._create_silence_chunk(0.1)  # 100ms silence

    def _create_wav_header(self) -> bytes:
        """Create WAV file header for streaming"""
        # We'll use a large placeholder size that gets corrected by the client
        data_size = 0xFFFFFFFF - 36  # Maximum size minus header

        header = io.BytesIO()

        # RIFF header
        header.write(b"RIFF")
        header.write(struct.pack("<I", data_size + 36))  # File size
        header.write(b"WAVE")

        # Format chunk
        header.write(b"fmt ")
        header.write(struct.pack("<I", 16))  # Format chunk size
        header.write(struct.pack("<H", 1))  # PCM format
        header.write(struct.pack("<H", self.channels))
        header.write(struct.pack("<I", self.sample_rate))
        header.write(
            struct.pack("<I", self.sample_rate * self.channels * self.sample_width)
        )  # Byte rate
        header.write(
            struct.pack("<H", self.channels * self.sample_width)
        )  # Block align
        header.write(struct.pack("<H", self.sample_width * 8))  # Bits per sample

        # Data chunk header
        header.write(b"data")
        header.write(struct.pack("<I", data_size))  # Data size

        return header.getvalue()

    def _synthesize_chunk(self, text: str, language: str) -> bytes | None:
        """Synthesize a text chunk using eSpeak-NG"""
        try:
            # eSpeak-NG command with voice profile parameters
            cmd = [
                "espeak-ng",
                "-v",
                self.voice if language == "bg" else language,  # Voice/language
                *self.profile.to_espeak_args(),  # Use profile parameters
                "--stdout",  # Output to stdout
                text,
            ]

            # Run eSpeak-NG
            result = subprocess.run(cmd, capture_output=True, timeout=10)

            if result.returncode == 0 and result.stdout:
                return result.stdout
            else:
                print(
                    f"eSpeak-NG error: {result.stderr.decode() if result.stderr else 'Unknown error'}"
                )
                return None

        except subprocess.TimeoutExpired:
            print("eSpeak-NG timeout")
            return None
        except Exception as e:
            print(f"eSpeak-NG synthesis error: {e}")
            return None

    def _split_into_sentences(self, text: str) -> list[str]:
        """Split text into sentences for streaming synthesis"""
        # Simple sentence splitting for Bulgarian
        import re

        # Split on sentence endings but preserve them
        sentences = re.split(r"([.!?]+)", text)

        # Recombine sentences with their punctuation
        result = []
        for i in range(0, len(sentences), 2):
            sentence = sentences[i]
            if i + 1 < len(sentences):
                sentence += sentences[i + 1]

            if sentence.strip():
                result.append(sentence.strip())

        # If no sentence breaks found, split on commas or by length
        if len(result) <= 1 and len(text) > 100:
            parts = text.split(",")
            if len(parts) > 1:
                result = [part.strip() + "," for part in parts[:-1]] + [
                    parts[-1].strip()
                ]
            else:
                # Split by word count (max 20 words per chunk)
                words = text.split()
                result = []
                for i in range(0, len(words), 20):
                    chunk = " ".join(words[i : i + 20])
                    if chunk:
                        result.append(chunk)

        return result if result else [text]

    def _create_silence_chunk(self, duration: float) -> bytes:
        """Create a chunk of silence"""
        samples = int(duration * self.sample_rate)
        silence = b"\x00\x00" * samples  # 16-bit silence
        return silence

    def synthesize_file(
        self, text: str, output_path: str, language: str = "bg"
    ) -> bool:
        """
        Synthesize text to a WAV file

        Args:
            text: Text to synthesize
            output_path: Output file path
            language: Language code

        Returns:
            bool: Success status
        """
        try:
            cmd = [
                "espeak-ng",
                "-v",
                language,
                *self.profile.to_espeak_args(),  # Use profile parameters
                "-w",
                output_path,  # Write to file
                text,
            ]

            result = subprocess.run(cmd, capture_output=True, timeout=30)
            return result.returncode == 0

        except Exception as e:
            print(f"File synthesis error: {e}")
            return False

    def set_profile(self, profile_name: str) -> bool:
        """
        Change the current voice profile

        Args:
            profile_name: Name of the profile to use

        Returns:
            bool: True if profile was set successfully
        """
        if profile_name in self.VOICE_PROFILES:
            self.profile = self.VOICE_PROFILES[profile_name]
            logger.info(
                f"Changed to profile: {self.profile.name} ({self.profile.description})"
            )
            return True
        else:
            logger.warning(f"Unknown profile '{profile_name}', keeping current profile")
            return False

    def get_available_profiles(self) -> dict[str, str]:
        """
        Get available voice profiles with descriptions

        Returns:
            Dict[str, str]: Profile names mapped to descriptions
        """
        return {
            name: profile.description for name, profile in self.VOICE_PROFILES.items()
        }

    def get_current_profile(self) -> str:
        """
        Get the current profile name

        Returns:
            str: Current profile name
        """
        return self.profile.name
