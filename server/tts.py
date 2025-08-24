import subprocess
import wave
import io
import struct
from typing import Generator, Optional


class TTSProcessor:
    """Text-to-Speech processor using eSpeak-NG for Bulgarian"""
    
    def __init__(self):
        self.sample_rate = 22050  # eSpeak default
        self.channels = 1  # mono
        self.sample_width = 2  # 16-bit
        
        # Test if eSpeak-NG is available
        try:
            result = subprocess.run(
                ["espeak-ng", "--version"], 
                capture_output=True, 
                text=True, 
                timeout=5
            )
            if result.returncode != 0:
                raise RuntimeError("eSpeak-NG not found or not working")
            print("eSpeak-NG initialized successfully")
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            raise RuntimeError(f"eSpeak-NG not available: {e}")
    
    def synthesize_streaming(self, text: str, language: str = "bg") -> Generator[bytes, None, None]:
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
        header.write(b'RIFF')
        header.write(struct.pack('<I', data_size + 36))  # File size
        header.write(b'WAVE')
        
        # Format chunk
        header.write(b'fmt ')
        header.write(struct.pack('<I', 16))  # Format chunk size
        header.write(struct.pack('<H', 1))   # PCM format
        header.write(struct.pack('<H', self.channels))
        header.write(struct.pack('<I', self.sample_rate))
        header.write(struct.pack('<I', self.sample_rate * self.channels * self.sample_width))  # Byte rate
        header.write(struct.pack('<H', self.channels * self.sample_width))  # Block align
        header.write(struct.pack('<H', self.sample_width * 8))  # Bits per sample
        
        # Data chunk header
        header.write(b'data')
        header.write(struct.pack('<I', data_size))  # Data size
        
        return header.getvalue()
    
    def _synthesize_chunk(self, text: str, language: str) -> Optional[bytes]:
        """Synthesize a text chunk using eSpeak-NG"""
        try:
            # eSpeak-NG command
            cmd = [
                "espeak-ng",
                "-v", language,  # Voice/language
                "-s", "160",     # Speed (words per minute)
                "-a", "100",     # Amplitude (volume)
                "-p", "50",      # Pitch
                "-g", "10",      # Gap between words (10ms)
                "--stdout",      # Output to stdout
                text
            ]
            
            # Run eSpeak-NG
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=10
            )
            
            if result.returncode == 0 and result.stdout:
                return result.stdout
            else:
                print(f"eSpeak-NG error: {result.stderr.decode() if result.stderr else 'Unknown error'}")
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
        sentences = re.split(r'([.!?]+)', text)
        
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
            parts = text.split(',')
            if len(parts) > 1:
                result = [part.strip() + ',' for part in parts[:-1]] + [parts[-1].strip()]
            else:
                # Split by word count (max 20 words per chunk)
                words = text.split()
                result = []
                for i in range(0, len(words), 20):
                    chunk = ' '.join(words[i:i+20])
                    if chunk:
                        result.append(chunk)
        
        return result if result else [text]
    
    def _create_silence_chunk(self, duration: float) -> bytes:
        """Create a chunk of silence"""
        samples = int(duration * self.sample_rate)
        silence = b'\x00\x00' * samples  # 16-bit silence
        return silence
    
    def synthesize_file(self, text: str, output_path: str, language: str = "bg") -> bool:
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
                "-v", language,
                "-s", "160",
                "-a", "100", 
                "-p", "50",
                "-w", output_path,  # Write to file
                text
            ]
            
            result = subprocess.run(cmd, capture_output=True, timeout=30)
            return result.returncode == 0
            
        except Exception as e:
            print(f"File synthesis error: {e}")
            return False