import os
import threading
from collections import deque

import numpy as np
import webrtcvad
from faster_whisper import WhisperModel


class ASRProcessor:
    """Audio Speech Recognition processor using faster-whisper with VAD"""

    def __init__(self):
        self.sample_rate = 16000
        self.frame_duration = 20  # ms
        self.frame_size = int(
            self.sample_rate * self.frame_duration / 1000
        )  # samples per frame

        # Initialize VAD
        self.vad = webrtcvad.Vad(2)  # Aggressiveness level 2 (0-3)

        # Audio buffer for accumulating frames
        self.audio_buffer = deque(maxlen=1000)  # ~20 seconds at 20ms frames
        self.speech_frames = []
        self.silence_count = 0
        self.speech_triggered = False
        self.max_silence_frames = 20  # 400ms of silence to trigger end

        # Initialize Whisper model
        model_path = os.getenv("WHISPER_MODEL_PATH", "medium")
        self.model = WhisperModel(model_path, device="cpu", compute_type="int8")

        self.partial_text = ""
        self.lock = threading.Lock()

    def process_audio_chunk(self, audio_data: bytes) -> dict | None:
        """Process incoming audio chunk and return ASR result"""
        try:
            # Convert bytes to numpy array (assuming int16 PCM)
            audio_array = np.frombuffer(audio_data, dtype=np.int16)

            # Process in frame-sized chunks
            for i in range(0, len(audio_array), self.frame_size):
                frame = audio_array[i : i + self.frame_size]

                # Pad frame if necessary
                if len(frame) < self.frame_size:
                    frame = np.pad(frame, (0, self.frame_size - len(frame)), "constant")

                result = self._process_frame(frame)
                if result:
                    return result

            return None

        except Exception as e:
            print(f"Error processing audio chunk: {e}")
            return None

    def _process_frame(self, frame: np.ndarray) -> dict | None:
        """Process individual audio frame through VAD and ASR"""

        # Convert to bytes for VAD
        frame_bytes = frame.astype(np.int16).tobytes()

        # Check if frame contains speech
        is_speech = self.vad.is_speech(frame_bytes, self.sample_rate)

        with self.lock:
            if is_speech:
                self.speech_frames.append(frame)
                self.silence_count = 0

                if not self.speech_triggered:
                    self.speech_triggered = True
                    print("Speech detected")

                # Return partial transcription if we have enough frames
                if len(self.speech_frames) % 25 == 0:  # Every 500ms
                    return self._get_partial_transcription()

            else:
                if self.speech_triggered:
                    self.silence_count += 1

                    # End of speech detected
                    if self.silence_count >= self.max_silence_frames:
                        return self._finalize_transcription()

        return None

    def _get_partial_transcription(self) -> dict:
        """Get partial transcription from current speech frames"""
        if not self.speech_frames:
            return {"type": "partial", "text": ""}

        try:
            # Concatenate frames
            audio = np.concatenate(self.speech_frames)

            # Normalize audio
            audio = audio.astype(np.float32) / 32768.0

            # Run Whisper inference
            segments, info = self.model.transcribe(
                audio,
                language="bg",
                beam_size=1,
                temperature=0.0,
                no_speech_threshold=0.6,
                condition_on_previous_text=False,
            )

            text = " ".join([segment.text.strip() for segment in segments])
            self.partial_text = text

            return {"type": "partial", "text": text}

        except Exception as e:
            print(f"Error in partial transcription: {e}")
            return {"type": "partial", "text": ""}

    def _finalize_transcription(self) -> dict:
        """Finalize transcription and reset state"""
        if not self.speech_frames:
            return {"type": "final", "text": ""}

        try:
            # Concatenate all speech frames
            audio = np.concatenate(self.speech_frames)

            # Normalize audio
            audio = audio.astype(np.float32) / 32768.0

            # Run final Whisper inference with higher quality settings
            segments, info = self.model.transcribe(
                audio,
                language="bg",
                beam_size=2,
                temperature=0.0,
                no_speech_threshold=0.6,
                condition_on_previous_text=False,
                word_timestamps=True,
            )

            text = " ".join([segment.text.strip() for segment in segments])

            # Reset state
            self.speech_frames = []
            self.silence_count = 0
            self.speech_triggered = False
            self.partial_text = ""

            print(f"Final transcription: {text}")
            return {"type": "final", "text": text}

        except Exception as e:
            print(f"Error in final transcription: {e}")
            # Reset state even on error
            self.speech_frames = []
            self.silence_count = 0
            self.speech_triggered = False
            self.partial_text = ""
            return {"type": "final", "text": ""}

    def reset(self):
        """Reset ASR state"""
        with self.lock:
            self.speech_frames = []
            self.silence_count = 0
            self.speech_triggered = False
            self.partial_text = ""
